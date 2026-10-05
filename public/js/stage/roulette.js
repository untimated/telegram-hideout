import { ROULETTE } from '../game/roulette.js';

export function buildRoulette({ models, place, interactable }) {
  const { x, z, yaw } = ROULETTE;
  const machine = place(models.Roulette(), x, 0, z, yaw);
  interactable('roulette', machine, {
    label: 'Play Roulette',
    action: { type: 'roulette' },
  });
  for (const [control, object] of Object.entries(machine.userData.roulette.buttons)) {
    interactable(`roulette-${control}`, object, {
      label: control === 'spin' ? 'Spin' : `Choose ${control === 'red' ? 'Red' : 'Black'}`,
      action: { type: 'roulette_control', control },
    });
  }
  return machine;
}
