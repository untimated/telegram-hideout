import {
  BAND, DAILY_COINS, ITEM_BY_ID, isDrink, ITEM_LIFETIME_MS, JUKEBOX, MAX_COINS, MENUS, SONG_BY_ID, SPOTS, STARTING_COINS,
  itemAvailable,
} from './public/js/game/catalog.js';
import { hideoutTime } from './public/js/game/clock.js';
import { npcPresent, NPC_BY_ID } from './public/js/game/npcs.js';
import { FRESH_VITALS, applyEffects, hourlyTick, isAsleep, splashAwake } from './public/js/game/rules.js';
import { SEAT_BY_ID } from './public/js/game/seats.js';
import { SLOTS, maxSlotBet, rollSlots } from './public/js/game/slots.js';

// Server-side reach is looser than the client's 3 m crosshair rule, to absorb position lag.
const USE_REACH = 4;
const SPLASH_COOLDOWN_MS = 5 * 60_000;
const JUKEBOX_GRACE_MS = 3000;

// Server-side game state: wallets and moods, served items, and the jukebox. Nothing here touches
// sockets; server.js supplies `send` (to every socket of one player), `broadcast` and positions.
// Wallets live in memory. After a restart, a returning player's first `restore` message (their
// localStorage copy) is accepted once, before they spend anything.
export function createGame({ now = () => Date.now(), send, broadcast, getPosition, setPosition = () => {}, getName, mapID = 'main', random = Math.random }) {
  const wallets = new Map();
  const online = new Set();
  const items = new Map();
  let nextItemID = 0;
  let jukebox = null;
  let band = null;
  let arcade = null;
  let nextSpinID = 0;
  const seated = new Map(); // playerID -> seat id

  const notice = (playerID, text, tone = 'error') => send(playerID, { type: 'notice', text, tone });
  const near = (playerID, x, z, reach) => {
    const position = getPosition(playerID);
    return Boolean(position) && Math.hypot(position.x - x, position.z - z) <= reach;
  };
  const selfState = wallet => {
    const state = {
      type: 'self', coins: wallet.coins, drunk: wallet.drunk, fuel: wallet.fuel, asleep: isAsleep(wallet),
      dayKey: wallet.dayKey, spent: wallet.spent, visits: wallet.visits, lastVisitAt: wallet.lastVisitAt,
    };
    if (wallet.pendingSlotPayout && now() < wallet.pendingSlotPayout.revealAt) {
      state.pendingSlotPayout = wallet.pendingSlotPayout;
    }
    return state;
  };

  function startDay(wallet, time) {
    wallet.coins = Math.min(MAX_COINS, wallet.coins + DAILY_COINS);
    Object.assign(wallet, FRESH_VITALS, { dayKey: time.dayKey, hourKey: time.hourKey });
  }

  // Day rollovers happen in join() and tick() only, so every one of them is announced.
  function walletFor(playerID) {
    let wallet = wallets.get(playerID);
    if (!wallet) {
      const time = hideoutTime(now());
      wallet = { coins: STARTING_COINS, spent: 0, visits: 0, lastVisitAt: null, ...FRESH_VITALS, dayKey: time.dayKey, hourKey: time.hourKey, restorable: true, splashedAt: -Infinity };
      wallets.set(playerID, wallet);
    }
    return wallet;
  }

  // Applies a change to a wallet, then tells the owner and, if they fell asleep or woke, everyone.
  function update(playerID, change) {
    const wallet = walletFor(playerID);
    const wasAsleep = isAsleep(wallet);
    const spent = wallet.spent;
    const visits = wallet.visits;
    change(wallet);
    wallet.restorable = false;
    send(playerID, selfState(wallet));
    if (wallet.spent !== spent || wallet.visits !== visits) broadcast(leaderboard());
    const asleep = isAsleep(wallet);
    if (asleep) stand(playerID);
    if (asleep !== wasAsleep) {
      broadcast({ type: 'player_state', id: playerID, asleep });
      broadcast({ type: 'activity', text: asleep ? `${getName(playerID)} passed out 💤` : `${getName(playerID)} is back on their feet` });
    }
  }

  // Only joined human players have a saved name; guests use the same wallet path.
  // Keep that name after disconnecting so offline spenders stay on the board.
  function topSpenders() {
    return ranking('spent');
  }

  function topVisitors() {
    return ranking('visits');
  }

  function ranking(metric) {
    return [...wallets].filter(([id, wallet]) => wallet.name && wallet[metric] > 0 && !NPC_BY_ID.has(id))
      .map(([id, wallet]) => ({ id, name: wallet.name, [metric]: wallet[metric] }))
      .sort((a, b) => b[metric] - a[metric] || a.id.localeCompare(b.id))
      .slice(0, 5);
  }

  function leaderboard() {
    return { type: 'leaderboard', spenders: topSpenders(), visitors: topVisitors() };
  }

  // A visit is a main-room entry on a new Hideout day (01:00 boundary).
  function visit(playerID, wallet, time) {
    if (mapID !== 'main' || NPC_BY_ID.has(playerID)) return;
    if (wallet.lastVisitAt === null || hideoutTime(wallet.lastVisitAt).dayKey !== time.dayKey) {
      wallet.visits = Math.min(Number.MAX_SAFE_INTEGER, wallet.visits + 1);
    }
    wallet.lastVisitAt = now();
  }

  function spend(wallet, amount) {
    wallet.coins -= amount;
    wallet.spent = Math.min(Number.MAX_SAFE_INTEGER, wallet.spent + amount);
  }

  function snapshot(playerID) {
    const wallet = walletFor(playerID);
    return {
      serverTime: now(),
      self: selfState(wallet),
      items: [...items.values()],
      jukebox,
      band,
      arcade,
      spenders: topSpenders(),
      visitors: topVisitors(),
      sleepers: [...online].filter(id => isAsleep(walletFor(id))),
      seated: Object.fromEntries(seated),
    };
  }

  function join(playerID) {
    online.add(playerID);
    const wallet = walletFor(playerID);
    wallet.name = getName(playerID);
    const time = hideoutTime(now());
    visit(playerID, wallet, time);
    if (wallet.dayKey !== time.dayKey) startDay(wallet, time);
    // Hours spent offline do not count against the meters.
    wallet.hourKey = time.hourKey;
    if (isAsleep(wallet)) broadcast({ type: 'player_state', id: playerID, asleep: true });
    return snapshot(playerID);
  }

  function leave(playerID) {
    stand(playerID);
    online.delete(playerID);
  }

  // Sitting: one player per seat, NPC seats are taken during the NPC's shift. The sitter's server
  // position moves onto the seat; any walking stands them up again (see server.js).
  function sit(playerID, seatID) {
    const seat = SEAT_BY_ID.get(seatID);
    if (!seat) return;
    if (isAsleep(walletFor(playerID))) return notice(playerID, 'You are passed out.');
    if (!near(playerID, seat.x, seat.z, USE_REACH)) return notice(playerID, `Walk closer to the ${seat.label.toLowerCase()}.`);
    const taken = [...seated].some(([id, other]) => other === seatID && id !== playerID) ||
      (seat.npc && npcPresent(seat.npc, hideoutTime(now())));
    if (taken) return notice(playerID, 'Someone is sitting there.');
    seated.set(playerID, seatID);
    setPosition(playerID, seat.x, seat.z);
    broadcast({ type: 'player_state', id: playerID, seat: seatID });
  }

  function stand(playerID) {
    if (!seated.delete(playerID)) return;
    broadcast({ type: 'player_state', id: playerID, seat: null });
  }

  const canMove = playerID => !isAsleep(walletFor(playerID));

  // Admin-only commands typed in chat (server.js decides who may use them and never relays them):
  //   money N   add N coins (negative takes them away)
  //   sober     drunk 0, fuel 1
  // Returns false for anything it does not understand, so nothing is ever echoed.
  function cheat(playerID, command) {
    const [name, value] = command.trim().split(/\s+/);
    if (name === 'money' && /^-?\d+$/.test(value ?? '')) {
      const amount = Number(value);
      update(playerID, wallet => { wallet.coins = Math.max(0, Math.min(MAX_COINS, wallet.coins + amount)); });
    } else if (name === 'sober') {
      update(playerID, wallet => Object.assign(wallet, FRESH_VITALS));
    } else {
      return false;
    }
    notice(playerID, '✓', 'ok');
    return true;
  }

  function restore(playerID, message) {
    const wallet = walletFor(playerID);
    if (!wallet.restorable) {
      send(playerID, selfState(wallet));
      return;
    }
    const { coins, drunk, fuel, dayKey, spent = 0, visits = 0, lastVisitAt = null } = message;
    if (!Number.isSafeInteger(coins) || coins < 0 || coins > MAX_COINS) return;
    if (![drunk, fuel].every(value => typeof value === 'number' && value >= 0 && value <= 1)) return;
    if (typeof dayKey !== 'string' || dayKey.length > 16) return;
    if (!Number.isSafeInteger(spent) || spent < 0) return;
    if (!Number.isSafeInteger(visits) || visits < 0) return;
    if (lastVisitAt !== null && (!Number.isSafeInteger(lastVisitAt) || lastVisitAt < 0 || lastVisitAt > now())) return;
    const time = hideoutTime(now());
    wallet.coins = coins;
    if (dayKey === time.dayKey) Object.assign(wallet, { drunk, fuel });
    else startDay(wallet, time);
    update(playerID, wallet => {
      wallet.spent = spent;
      if (mapID === 'main' && !NPC_BY_ID.has(playerID)) {
        // join() already counted today's entry. A same-day backup includes it;
        // a previous-day backup needs exactly one additional visit, never missed days.
        const extra = lastVisitAt === null || hideoutTime(lastVisitAt).dayKey !== time.dayKey ? 1 : 0;
        wallet.visits = Math.max(wallet.visits, Math.min(Number.MAX_SAFE_INTEGER, visits + extra));
      }
    });
  }

  function buy(playerID, itemID) {
    const item = ITEM_BY_ID.get(itemID);
    if (!item) return;
    const menu = MENUS[item.menu];
    const time = hideoutTime(now());
    const wallet = walletFor(playerID);
    if (isAsleep(wallet)) return notice(playerID, 'You are passed out.');
    if (!near(playerID, menu.x, menu.z, menu.reach)) return notice(playerID, `Walk up to the ${menu.title.toLowerCase()} to order.`);
    if (menu.vendor && !npcPresent(menu.vendor, time)) {
      return notice(playerID, `${NPC_BY_ID.get(menu.vendor).name} is off shift. Come back later.`);
    }
    if (!itemAvailable(item, time.weekday)) return notice(playerID, `${item.name} is not on today.`);
    if (wallet.coins < item.price) return notice(playerID, `Not enough coins for ${item.name}.`);
    const taken = new Set([...items.values()].map(served => served.spot));
    const spot = SPOTS[menu.spots].find(candidate => !taken.has(candidate.id));
    if (!spot) return notice(playerID, `Every ${menu.spots} spot is full. Finish something first!`);

    update(playerID, wallet => spend(wallet, item.price));
    const served = {
      id: String(++nextItemID), item: item.id, spot: spot.id, x: spot.x, y: spot.y, z: spot.z,
      byID: playerID, by: getName(playerID), at: now(),
    };
    items.set(served.id, served);
    broadcast({ type: 'item_added', item: served });
    broadcast({ type: 'activity', text: `${served.by} ${menu.id === 'refreshments' ? 'took' : 'ordered'} ${item.icon} ${item.name}` });
  }

  function consume(playerID, servedID) {
    const served = items.get(String(servedID));
    if (!served) return notice(playerID, 'Someone got there first.');
    const item = ITEM_BY_ID.get(served.item);
    if (isAsleep(walletFor(playerID))) return notice(playerID, 'You are passed out.');
    if (!near(playerID, served.x, served.z, USE_REACH)) return notice(playerID, `Walk closer to the ${item.name}.`);
    items.delete(served.id);
    broadcast({ type: 'item_removed', id: served.id, byID: playerID });
    const verb = isDrink(item) ? 'drank' : 'ate';
    const whose = served.byID === playerID ? 'their' : `${served.by}'s`;
    broadcast({ type: 'activity', text: `${getName(playerID)} ${verb} ${whose} ${item.icon} ${item.name}` });
    update(playerID, wallet => Object.assign(wallet, applyEffects(wallet, item)));
  }

  function playSong(playerID, songID) {
    const song = SONG_BY_ID.get(songID);
    if (!song) return;
    const wallet = walletFor(playerID);
    if (isAsleep(wallet)) return notice(playerID, 'You are passed out.');
    if (!near(playerID, JUKEBOX.x, JUKEBOX.z, JUKEBOX.reach)) return notice(playerID, 'Walk up to the jukebox.');
    if (band && now() < band.startedAt + BAND.duration * 1000) return notice(playerID, 'Let the live band finish first.');
    if (wallet.coins < song.price) return notice(playerID, `Not enough coins for ${song.title}.`);
    update(playerID, wallet => spend(wallet, song.price));
    jukebox = { song: song.id, startedAt: now(), byID: playerID, by: getName(playerID) };
    broadcast({ type: 'jukebox', jukebox });
    broadcast({ type: 'activity', text: `${jukebox.by} put on ♪ ${song.title}` });
  }

  function stopSong(playerID) {
    if (!jukebox) return;
    if (!near(playerID, JUKEBOX.x, JUKEBOX.z, JUKEBOX.reach)) return notice(playerID, 'Walk up to the jukebox.');
    if (isAsleep(walletFor(playerID))) return notice(playerID, 'You are passed out.');
    const song = SONG_BY_ID.get(jukebox.song);
    jukebox = null;
    broadcast({ type: 'jukebox', jukebox });
    broadcast({ type: 'activity', text: `${getName(playerID)} stopped ♪ ${song.title}` });
  }

  function playBand(playerID) {
    const wallet = walletFor(playerID);
    if (isAsleep(wallet)) return notice(playerID, 'You are passed out.');
    if (!near(playerID, BAND.x, BAND.z, BAND.reach)) return notice(playerID, 'Walk up to the stage.');
    if (band && now() < band.startedAt + BAND.duration * 1000) return notice(playerID, 'Let the live band finish first.');
    if (!BAND.members.every(id => npcPresent(id, hideoutTime(now())))) return notice(playerID, 'The band is off shift. Come back later.');
    if (wallet.coins < BAND.price) return notice(playerID, `You need ${BAND.price} coins for live music.`);
    band = { startedAt: now(), byID: playerID, by: getName(playerID) };
    update(playerID, wallet => spend(wallet, BAND.price));
    broadcast({ type: 'band', band });
    broadcast({ type: 'activity', text: `${band.by} paid for a live song ♪` });
  }

  function spinSlots(playerID, bet = SLOTS.minBet) {
    if (mapID !== SLOTS.map) return notice(playerID, 'This machine is not in this map.');
    const wallet = walletFor(playerID);
    if (isAsleep(wallet)) return notice(playerID, 'You are passed out.');
    if (!near(playerID, SLOTS.x, SLOTS.z, USE_REACH)) return notice(playerID, 'Walk up to Gossip Jackpot.');
    if (arcade && now() < arcade.startedAt + SLOTS.duration) return notice(playerID, 'The machine is still spinning.');
    if (!Number.isSafeInteger(bet) || bet < SLOTS.minBet) return notice(playerID, `Bet at least ${SLOTS.minBet} whole coins.`);
    if (wallet.coins < bet) return notice(playerID, `You need ${bet} coins for that bet.`);
    if (bet > maxSlotBet(wallet.coins)) return notice(playerID, 'Choose a smaller bet to leave room for the prize.');
    arcade = { ...rollSlots(bet, random), bet, id: ++nextSpinID, byID: playerID, by: getName(playerID), startedAt: now() };
    // Settle once on the server, even if the player disconnects during the reel animation.
    update(playerID, wallet => {
      spend(wallet, bet);
      wallet.coins += arcade.payout;
      // Include the reveal time in the wallet update, which arrives before the reel event.
      wallet.pendingSlotPayout = arcade.payout > 0
        ? { amount: arcade.payout, revealAt: arcade.startedAt + SLOTS.duration } : null;
      if (arcade.kind === 'loss') Object.assign(wallet, applyEffects(wallet, { fuel: -SLOTS.lossFuel }));
    });
    broadcast({ type: 'arcade_spin', spin: arcade });
  }

  function transfer(playerID, to, amount) {
    to = String(to);
    if (to === playerID || !online.has(to)) return notice(playerID, 'That player is not here.');
    if (!Number.isSafeInteger(amount) || amount < 1) return notice(playerID, 'Pick a whole number of coins.');
    const wallet = walletFor(playerID);
    if (wallet.coins < amount) return notice(playerID, 'You do not have that many coins.');
    const receiver = walletFor(to);
    if (amount > MAX_COINS - receiver.coins) return notice(playerID, 'Their wallet is full.');
    update(playerID, wallet => { wallet.coins -= amount; });
    update(to, wallet => { wallet.coins += amount; });
    notice(playerID, `Sent ${amount} 🪙 to ${getName(to)}.`, 'ok');
    notice(to, `${getName(playerID)} sent you ${amount} 🪙.`, 'ok');
  }

  function splash(playerID, targetID) {
    targetID = String(targetID);
    if (!online.has(targetID) || targetID === playerID) return;
    const target = walletFor(targetID);
    if (!isAsleep(target)) return notice(playerID, `${getName(targetID)} is awake already.`);
    const position = getPosition(targetID);
    if (!position || !near(playerID, position.x, position.z, USE_REACH)) return notice(playerID, `Walk closer to ${getName(targetID)}.`);
    if (now() - target.splashedAt < SPLASH_COOLDOWN_MS) return notice(playerID, 'Let them rest a few minutes first.');
    target.splashedAt = now();
    broadcast({ type: 'activity', text: `${getName(playerID)} splashed water on ${getName(targetID)} 💦` });
    update(targetID, wallet => Object.assign(wallet, splashAwake(wallet)));
  }

  // Handles one parsed client message. Returns false for message types this module does not own.
  function handle(playerID, message) {
    // Main-room fixtures do not exist in the prototype room.
    if (mapID !== 'main' && ['buy', 'jukebox_play', 'jukebox_stop', 'band_play', 'sit'].includes(message?.type)) {
      notice(playerID, 'This fixture is not in this map.');
      return true;
    }
    switch (message?.type) {
      case 'restore': restore(playerID, message); break;
      case 'buy': if (typeof message.item === 'string') buy(playerID, message.item); break;
      case 'consume': if (typeof message.id === 'string') consume(playerID, message.id); break;
      case 'jukebox_play': if (typeof message.song === 'string') playSong(playerID, message.song); break;
      case 'jukebox_stop': stopSong(playerID); break;
      case 'band_play': playBand(playerID); break;
      case 'arcade_spin': spinSlots(playerID, message.bet); break;
      case 'transfer': if (typeof message.to === 'string') transfer(playerID, message.to, message.amount); break;
      case 'splash': if (typeof message.id === 'string') splash(playerID, message.id); break;
      case 'sit': if (typeof message.seat === 'string') sit(playerID, message.seat); break;
      case 'stand': stand(playerID); break;
      default: return false;
    }
    return true;
  }

  // Hour and day rollovers, stale items and finished songs. server.js calls this every few seconds.
  function tick() {
    const time = hideoutTime(now());
    for (const playerID of online) {
      const wallet = walletFor(playerID);
      if (wallet.dayKey !== time.dayKey) {
        update(playerID, wallet => startDay(wallet, time));
        notice(playerID, `A new Hideout day: +${DAILY_COINS} 🪙, and you feel fresh.`, 'ok');
      } else if (wallet.hourKey !== time.hourKey) {
        wallet.hourKey = time.hourKey;
        update(playerID, wallet => Object.assign(wallet, hourlyTick(wallet)));
      }
    }
    for (const served of items.values()) {
      if (now() - served.at > ITEM_LIFETIME_MS) {
        items.delete(served.id);
        broadcast({ type: 'item_removed', id: served.id, byID: null });
      }
    }
    if (jukebox && now() - jukebox.startedAt > SONG_BY_ID.get(jukebox.song).duration * 1000 + JUKEBOX_GRACE_MS) {
      jukebox = null;
      broadcast({ type: 'jukebox', jukebox });
    }
    if (band && now() >= band.startedAt + BAND.duration * 1000) {
      band = null;
      broadcast({ type: 'band', band });
    }
  }

  return { join, leave, handle, tick, canMove, snapshot, stand, cheat, topSpenders, topVisitors, leaderboard };
}
