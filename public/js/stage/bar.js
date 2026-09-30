// Bar: raised platform in the north-west corner, L-shaped counter around the bartender.
export function buildBar({ models, place, interactable, seatable }) {
  place(models.BarPlatform(6.1, 4.5), -3.45, 0, -4.25);
  place(models.BarPlatformSteps(1.8, 2), -5.4, 0, -1.8, Math.PI);
  const counter = place(models.BarCounterCorner(3.9, 2.3), -2.1, .28, -3.75);
  interactable('bar', counter, { label: 'Bar', approach: { x: -3.5, z: -2.5, yaw: 0 }, action: { type: 'menu', menu: 'bar' } });

  place(models.BarBackCabinet(4.8, 1.9), -3.3, .28, -6.2);
  place(models.BarBottleShelf(4.4), -3.3, .38, -6.1);
  place(models.GossipBarSign(4.6), -3.3, 2.35, -6.36);
  [-4.6, -3.5, -2.4].forEach((x, index) => seatable(place(models.BarStool(), x, .28, -3), [`stool-front-${index + 1}`], 'Bar stool'));
  [-5.4, -4.6, -3.8].forEach((z, index) => seatable(place(models.BarStool(), -1.1, .28, z), [`stool-side-${index + 1}`], 'Bar stool'));

  // Counter top: lamps, a bottle, a glass and a mug; bottles and glasses on the back shelf.
  place(models.TableLamp(), -5.8, 1.32, -3.75);
  place(models.TableLamp(), -2.1, 1.32, -5.8);
  place(models.Bottle(0x36a88c, .34), -5.2, 1.32, -3.75);
  place(models.DrinkingGlass(), -4.9, 1.32, -3.7);
  place(models.Mug(), -2.1, 1.32, -4.6);
  for (const [index, x] of [-4.9, -4.1, -3.3, -2.5, -1.7].entries()) {
    place(models.Bottle(index % 2 ? 0xa73d5a : 0x36a88c, .3), x, .87, -6.08);
    place(models.DrinkingGlass(), x, 1.37, -6.08);
  }
  place(models.PottedPlant(.62, 11), -6.1, .28, -6);
}
