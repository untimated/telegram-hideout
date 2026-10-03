import { FOUNTAIN } from './layout.js';
import { buildNewsstand } from './newsstand.js';

// Jukebox against the glass, café tables and the east lounge, and the refreshment island.
export function buildLounge(context) {
  const { models, place, unlit, interactable, seatable } = context;
  const jukebox = place(models.Jukebox(), -6.2, 0, .9, Math.PI / 2);
  jukebox.scale.set(1, .85, .85);
  interactable('jukebox', jukebox, { label: 'Jukebox', approach: { x: -5.1, z: .9, yaw: Math.PI / 2 } });

  for (const z of [-4.8, -3.15]) {
    place(models.CafeTable(), 3.6, 0, z).scale.set(1.12, 1, 1.12);
    const row = z < -4 ? 1 : 2;
    seatable(place(models.CafeChair(), 2.6, 0, z, -Math.PI / 2), [`cafe-${row}w`], 'Café chair');
    seatable(place(models.CafeChair(), 4.6, 0, z, Math.PI / 2), [`cafe-${row}e`], 'Café chair');
    place(models.TableLamp(), 3.6, .88, z);
  }
  seatable(place(models.Sofa(2.6), 3.2, 0, -1.35), ['sofa-north-1', 'sofa-north-2', 'sofa-north-3'], 'Sofa');
  seatable(place(models.Sofa(2.6), 3.2, 0, 1.6, Math.PI), ['sofa-south-1', 'sofa-south-2', 'sofa-south-3'], 'Sofa');
  seatable(place(models.Sofa(1.8), 5.9, 0, .12, -Math.PI / 2), ['sofa-east-1', 'sofa-east-2'], 'Sofa');
  place(models.CoffeeTable(), 3.2, 0, .12).scale.set(1.2, 1, 1.15);
  place(models.TableLamp(), 3.2, .466, .12);

  // A flush tile inset frames the refreshment area without a false sunken pit.
  const { x: fx, z: fz } = FOUNTAIN;
  place(models.FloorInset(3.8, 3.5), fx, 0, fz);
  const pedestal = place(models.FountainPedestal(), fx, .02, fz);
  interactable('fountain', pedestal, { label: 'Refreshments', approach: { x: fx, z: fz + 1.6, yaw: Math.PI }, action: { type: 'menu', menu: 'refreshments' } });
  place(models.ChocolateFountain(), fx - .4, .9, fz).scale.setScalar(.55);
  place(models.DrinkDispenser(), fx + .54, .84, fz, Math.PI).scale.setScalar(.85);
  place(models.Cup(), fx - .74, .84, fz + .36).scale.setScalar(.8);
  place(models.CupStack(3), fx + .7, .84, fz + .34).scale.setScalar(.65);
  for (const [dx, dz] of [[-1.7, -1.4], [1.7, -1.4], [-1.7, 1.4], [1.7, 1.4]]) {
    place(unlit(models.TableLamp()), fx + dx, .02, fz + dz).scale.setScalar(.7);
  }
  [[-3.5, -1.25], [-2.3, -1.25], [-.6, .05], [-.6, 1.25]].forEach(([x, z], index) => seatable(place(models.SquareSeat(), x, 0, z), [`cube-${index + 1}`]));
  // Behind the fountain's east stools, marking the edge of the sofa lounge.
  buildNewsstand(context, .15, .65, Math.PI / 2).scale.setScalar(.5);
}
