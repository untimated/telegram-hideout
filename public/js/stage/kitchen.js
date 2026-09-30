// Open kitchen against the alcove's back wall, with the buffet line across its mouth.
export function buildKitchen({ models, place, interactable }) {
  const kz = -9.05;
  place(models.KitchenBaseCabinet(1.18), 1.3, 0, kz);
  place(models.KitchenBaseCabinet(1.18), 3.6, 0, kz);
  place(models.KitchenBaseCabinet(1.18), 4.75, 0, kz);
  for (const x of [3.6, 4.75]) place(models.KitchenWorktop(1.18, .73), x, .78, kz);
  place(models.KitchenBacksplash(5.4, .78), 3.55, .96, -9.36);
  place(models.KitchenSink(), 1.3, 0, kz);
  place(models.KitchenFaucet(), 1.3, .88, kz - .07);
  place(models.Stove(), 2.55, 0, kz);
  place(models.ExtractorHood(), 2.55, 1.4, kz - .13);
  place(models.Refrigerator(), 5.85, 0, kz);
  place(models.KitchenShelf(2.2), 4.2, 2.0, -9.3);
  place(models.CookingPot(), 2.4, .97, kz - .07);
  place(models.FryingPan(), 2.7, .98, kz + .1);
  place(models.PotLid(), 3.9, .92, kz);
  place(models.UtensilHolder(), 1.7, .92, kz - .05);
  place(models.CuttingBoard(), 3.5, .92, kz);
  place(models.CookingUtensil('spatula'), 4.2, .94, kz);

  const buffet = place(models.BuffetCounter(5.4), 3.5, 0, -7);
  interactable('buffet', buffet, { label: 'Buffet', approach: { x: 3.5, z: -5.9, yaw: 0 }, action: { type: 'menu', menu: 'food' } });
  for (const x of [2.0, 2.9, 3.8, 4.7]) place(models.ChafingDish(), x, .98, -7);
  place(models.PlateStack(5), 5.6, .98, -7);
  place(models.CupStack(3), 1.2, .98, -7);
  place(models.WallLight('warm'), 5.85, 2.2, -9.36);
}
