# Low-poly food and drink models

14 portable `.glb` files, one per menu item. Filenames match the current catalog IDs
and the icons in `assets/menu-icons`. No textures or external files are needed.

- Units: metres, +y up, bottom-centre origin at y=0.
- Plate widths: about 26-32 cm. Glass heights: about 11-21 cm.
- 184-442 triangles per model; each exported model is under 42 KB.
- Flat shading, mostly 6-10 sided primitives, basic shared colours.
- Glass uses simple alpha transparency; no transmission, lights or effects.
- Food and drinks are standalone artwork, without gameplay coasters or interaction state.

## Use the GLB files

Load `<item-id>.glb` with Three.js `GLTFLoader` and place its `scene` on the serving
surface. Apply the existing game's 1.25 readability scale if desired.
Expose this folder through a static route or copy the GLB files into a served asset
directory; the running game's item manager has deliberately been left for integration.

## Use the procedural builders instead

```js
import { createFoodDrinkModels } from './models/food_drink/index.js';

const foodDrink = createFoodDrinkModels(THREE);
const burger = foodDrink.create('pierres-smash-burger');
burger.position.set(tableX, tableTopY, tableZ);
scene.add(burger);
```

The factory exposes `ids` and `create(itemID)`. Unknown IDs throw an error.
Each call creates independent geometry; materials are shared within a factory.
Dispose removed geometry normally, but retain shared materials until the factory is
no longer used. No changes to `public/js/items.js` are needed to review this art set.

## Review and provisional designs

`manifest.json` records triangle counts, dimensions and file sizes.
`review.html` displays the actual exported GLB files when served over HTTP.

The two challenge meals use closed serving cloches, matching the provisional icons.
The two special drinks use violet/cyan liquid. These four models are marked provisional;
Thursday's current catalog blurb mentions pasta, so its final dish can replace the
mystery cloche later. The remaining ten models represent their named menu items.

Validation: finite vertex positions and normals, no geometry below the serving surface,
and all GLB files exported and loaded again with matching model bounds.
