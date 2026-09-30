// The stage in the south-east corner, facing north into the room.
export function buildStageArea({ models, place, interactable }) {
  const platform = place(models.StagePlatform(4.2, 3.6), 4.3, 0, 4.6);
  interactable('stage', platform, { label: 'Stage', approach: { x: 4.3, z: 2.3, yaw: Math.PI } });
  place(models.StageSteps(1.6, 3), 1.9, 0, 4.6, Math.PI / 2);
  place(models.StageSpeaker(), 3, .4, 5.6);
  place(models.StageSpeaker(), 5.6, .4, 5.6);
  const micStand = place(models.MicrophoneStand(), 4.3, .4, 4.4);
  const microphone = models.Microphone();
  microphone.position.set(.28, 1.25, 0);
  micStand.add(microphone);
}
