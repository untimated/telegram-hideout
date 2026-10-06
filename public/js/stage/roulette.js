import { ROULETTE } from '../game/roulette.js';
import { createRouletteAnimator } from '../roulette-animation.js';

export function buildRoulette({ models, place, interactable, animators }) {
  const { x, z, yaw } = ROULETTE;
  const machine = place(models.Roulette(), x, 0, z, yaw);
  const animation = createRouletteAnimator(machine);
  machine.userData.roulette.animation = animation;
  animators.push(() => animation.update());
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
