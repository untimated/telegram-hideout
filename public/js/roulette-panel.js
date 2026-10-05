import { ROULETTE } from './game/roulette.js';
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
  const buttons = machine.userData.roulette.buttons;
  const idleY = Object.fromEntries(Object.entries(buttons).map(([id, object]) => [id, object.position.y]));
  let step = 0;
  let bet = 7;
  let color = null;
  let spinning = false;
  let spinTimer;
  let input, next, note, cash, choiceStatus;
  const presses = new Map();
  const requestedAt = Date.now();

  const validBet = () => Number.isSafeInteger(bet) && bet >= 1 && bet <= game.state().self.coins;
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
      highlight();
      update();
      spinTimer = setTimeout(() => {
        spinning = false;
        game.audio.setRouletteSpin(false);
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
      highlight();
      setHeading('1 OF 3 · BET', 'Place your bet');
      cash = element('p', 'roulette-cash');
      const row = element('label', 'slot-bet');
      input = element('input', 'modal-input');
      Object.assign(input, { type: 'number', min: 1, step: 1, inputMode: 'numeric', value: String(bet) });
      row.append(element('span', '', 'Bet (coins)'), input);
      note = element('p', 'panel-note');
      next = button('primary', 'Next', () => { if (validBet()) render(2); });
      input.addEventListener('input', () => { bet = input.valueAsNumber; update(); });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); if (!next.disabled) next.click(); }
      });
      body.append(cash, row, note);
      foot.append(next, button('secondary', 'Leave', close));
      input.focus();
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
        element('p', 'slot-result', 'Rewards will appear here.'),
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
      input.max = String(self.coins);
      input.setAttribute('aria-invalid', String(!validBet()));
      next.disabled = !validBet();
      note.textContent = !Number.isSafeInteger(bet) || bet < 1 ? 'Enter a whole number of coins.'
        : bet > self.coins ? `You have ${self.coins} coins.` : 'Preview only · no coins are charged.';
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
