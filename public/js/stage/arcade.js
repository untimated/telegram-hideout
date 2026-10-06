import { SLOTS } from '../game/slots.js';

// Against the pool glass beside the roulette machine, facing into the room.
export function buildArcade({ models, place, interactable }, { x = SLOTS.x, z = SLOTS.z, yaw = SLOTS.yaw } = {}) {
  const machine = place(models.SlotMachine(), x, 0, z, yaw);
  interactable('gossip-jackpot', machine, {
    label: 'Play Gossip Jackpot',
    approach: { x: x + Math.sin(yaw) * 1.6, z: z + Math.cos(yaw) * 1.6, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)) },
    action: { type: 'arcade' },
  });
  return machine;
}
