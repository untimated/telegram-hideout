import { ROULETTE, ROULETTE_BETS } from './game/roulette.js';
import { SEAT_BY_ID } from './game/seats.js';

// UI preview only: sitting is authoritative; bet, color and result stay local to the wizard.
export function buildRoulettePanel({ body, foot, game, machine, setHeading, close }) {
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, action) => {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const seat = SEAT_BY_ID.get(ROULETTE.seatID);
  const { buttons, animation } = machine.userData.roulette;
  const idleY = Object.fromEntries(Object.entries(buttons).map(([id, object]) => [id, object.position.y]));
  let step = 0;
  let bet = 0;
  const wagerCoins = [];
  let color = null;
  let spinning = false;
  let previewResult;
  let spinTimer;
  let next, note, cash, choiceStatus, total, undo, clearBet;
  const betButtons = new Map();
  const betCounts = new Map();
  const presses = new Map();
  const requestedAt = Date.now();

  const validBet = () => Number.isSafeInteger(bet) && bet >= 10 && bet % 10 === 0 && bet <= game.state().self.coins;
  function highlight() {
    for (const [id, object] of Object.entries(buttons)) {
      const selected = step === 2 && id === color;
      object.position.y = idleY[id] - (selected ? .012 : 0) - (presses.has(id) ? .022 : 0);
      object.userData.setSelected?.(selected);
      object.userData.hint.visible = step === 2 && !spinning && (color ? id === 'spin' : id !== 'spin');
    }
  }
  function press(id) {
    clearTimeout(presses.get(id));
    presses.set(id, setTimeout(() => { presses.delete(id); highlight(); }, 140));
    game.audio.pressRouletteButton();
    highlight();
  }
  function control(id) {
    if (step === 0 || !buttons[id]) return;
    // Every hit feels physical, but only the first color and first valid Spin register this round.
    press(id);
    if (step !== 2 || spinning || !validBet()) return;
    if ((id === 'red' || id === 'black') && !color) {
      color = id;
      highlight();
      update();
    } else if (id === 'spin' && color) {
      spinning = true;
      setHeading('2 OF 3 · SPIN', 'Spinning…');
      game.audio.setRouletteSpin(true);
      previewResult = animation.start(game.audio.rouletteSpinDuration, { color, winChance: ROULETTE.winChance });
      highlight();
      update();
      spinTimer = setTimeout(() => {
        spinning = false;
        game.audio.setRouletteSpin(false);
        animation.finish(previewResult.color === color);
        game.audio.setRouletteResult(previewResult.color === color);
        render(3);
      }, game.audio.rouletteSpinDuration);
    }
  }
  function render(value) {
    step = value;
    body.replaceChildren();
    foot.replaceChildren();
    highlight();
    if (step === 1) {
      color = null;
      bet = 0;
      wagerCoins.length = 0;
      game.audio.setRouletteResult(null);
      highlight();
      setHeading('1 OF 3 · BET', 'Place your bet');
      cash = element('p', 'roulette-cash');
      const row = element('div', 'roulette-bets');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Bet amount');
      betButtons.clear();
      betCounts.clear();
      for (const value of ROULETTE_BETS) {
        const coin = button('roulette-bet-coin', '', () => {
          const amount = bet + value;
          if (!Number.isSafeInteger(amount) || amount > game.state().self.coins) return;
          wagerCoins.push(value);
          bet = amount;
          game.audio.addRouletteCoin();
          update();
        });
        coin.setAttribute('data-value', String(value));
        coin.setAttribute('aria-label', `Add ${value} coins`);
        coin.append(element('span', 'roulette-bet-value', String(value)), element('span', 'roulette-bet-unit', 'COINS'));
        const count = element('span', 'roulette-bet-count');
        coin.append(count);
        betCounts.set(value, count);
        betButtons.set(value, coin);
        row.append(coin);
      }
      const summary = element('div', 'roulette-bet-summary');
      total = element('p', 'roulette-bet-total');
      total.setAttribute('role', 'status');
      undo = button('secondary', 'Undo', () => { bet -= wagerCoins.pop() ?? 0; update(); });
      clearBet = button('secondary', 'Clear', () => { wagerCoins.length = 0; bet = 0; update(); });
      summary.append(total, undo, clearBet);
      note = element('p', 'panel-note');
      next = button('primary', 'Next', () => { if (validBet()) render(2); });
      body.append(cash, row, summary, note);
      foot.append(next, button('secondary', 'Leave', close));
      betButtons.get(ROULETTE_BETS[0]).focus();
    } else if (step === 2) {
      setHeading('2 OF 3 · COLOR', 'Choose a color');
      body.append(element('p', 'roulette-cash', `Bet: ${bet} coins`));
      note = element('p', 'panel-note');
      choiceStatus = element('p', 'roulette-selection');
      choiceStatus.setAttribute('role', 'status');
      body.append(note, choiceStatus);
    } else {
      setHeading('3 OF 3 · RESULT', 'Result preview');
      body.append(element('p', 'roulette-cash', `${bet} coins on ${color === 'red' ? 'Red' : 'Black'}`),
        element('p', 'slot-result', `Landed on ${previewResult.color.toUpperCase()} · ${previewResult.color === color ? 'You win!' : 'You lose.'}`),
        element('p', 'panel-note', 'Preview only · no coins were charged.'));
      foot.append(button('primary', 'Play Again', () => render(1)), button('secondary', 'Leave', close));
    }
    update();
  }
  function update() {
    const { self, selfID, seated } = game.state();
    if (self.asleep) return close();
    if (step === 0) {
      if (seated.get(selfID) === seat.id) {
        game.faceSeat?.(seat);
        game.inspect?.(machine);
        render(1);
      } else if (Date.now() - requestedAt > 5000) {
        game.toast?.('Could not take the seat. Try again.');
        close();
      }
      return;
    }
    if (seated.get(selfID) !== seat.id || !game.isInspecting?.()) return close();
    if (step === 1) {
      cash.textContent = `Cash: ${self.coins} coins`;
      for (const [value, coin] of betButtons) {
        const count = wagerCoins.filter(amount => amount === value).length;
        coin.disabled = !Number.isSafeInteger(bet + value) || bet + value > self.coins;
        coin.setAttribute('aria-pressed', String(count > 0));
        betCounts.get(value).hidden = count === 0;
        betCounts.get(value).textContent = `×${count}`;
      }
      total.textContent = `Bet: ${bet} coins`;
      undo.disabled = clearBet.disabled = wagerCoins.length === 0;
      next.disabled = !validBet();
      note.textContent = self.coins < ROULETTE_BETS[0] ? 'You need at least 10 coins to bet.'
        : bet > self.coins ? 'Your balance changed. Undo or clear the bet.'
        : bet === 0 ? 'Tap coins to build your bet. Repeated taps stack.' : 'Preview only · no coins are charged.';
    } else if (step === 2) {
      note.textContent = spinning ? 'Spinning… please wait.'
        : !validBet() ? 'Your balance changed. Leave and adjust the bet.' : color
        ? 'Press SPIN on the cabinet.'
        : 'Press RED or BLACK on the cabinet. Your first press locks the color.';
      choiceStatus.hidden = !color;
      choiceStatus.textContent = color ? `${color.toUpperCase()} selected · locked for this round.` : '';
    }
  }
  setHeading('', 'Taking your seat…');
  body.append(element('p', 'panel-note', 'Please wait.'));
  foot.append(button('secondary', 'Leave', close));
  return {
    update, control,
    rejected() { if (step === 0) close(); },
    dispose() {
      clearTimeout(spinTimer);
      spinning = false;
      game.audio.setRouletteSpin(false);
      animation.cancel();
      for (const timer of presses.values()) clearTimeout(timer);
      presses.clear();
      for (const [id, object] of Object.entries(buttons)) {
        object.position.y = idleY[id];
        object.userData.setSelected?.(false);
        object.userData.hint.visible = false;
      }
      game.endInspect?.();
      if (step === 0 || game.state().seated.get(game.state().selfID) === seat.id) game.send({ type: 'stand' });
    },
  };
}
