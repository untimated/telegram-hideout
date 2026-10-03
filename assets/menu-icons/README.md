# Gossip Bar menu icons

15 individually generated icons matching the item IDs in `public/js/game/catalog.js`.

- `<item-id>.webp`: recommended menu asset, 256 x 256, with alpha transparency.
- `<item-id>.png`: equivalent transparent PNG, 256 x 256.
- `originals/<item-id>.png`: full-size generated original.
- `manifest.json`: item IDs, labels, categories, filenames and provisional-art flags.
- `preview.png`: labelled overview of the original 14 icons, not a runtime sprite sheet.
- `validation.json`: original dimensions, transparency checks and PNG file sizes.

Each menu icon is centered on a transparent square with roughly 24 pixels of padding.
Display at 64-96 CSS pixels; names, prices and menu frames belong in HTML.
The style is faceted 3D illustration with warm light and restrained cyan/magenta accents.

## Integration

Read the filename from the manifest or use `${item.id}.webp`.
These assets are intentionally staged in `assets`, as requested; connect the server's
static routes or copy the selected runtime files into a served public directory.
No gameplay or menu rendering code was changed for this asset delivery.

## Provisional designs

`saturday-special` and `wednesday-special` are violet/cyan special-drink illustrations.
`saturday-challenge` and `thursday-challenge` use closed serving cloches as mystery-meal
icons. Their recipes were unspecified in the requested `plan.md` art brief.
The current catalog provides more descriptive blurbs (including Thursday pasta), so
these four icons are flagged `provisional: true` until final dish designs are agreed.

Icons were generated with OpenAI image generation and resized with alpha preserved.
The originals are retained for future art edits.

Coffee was added using the built-in imagegen tool on 3 October 2026 with
`transparent_background: true`. Final prompt:

> Use case: stylized-concept. Asset type: a single square transparent inventory/menu icon for a low-poly 3D cafe-bar game. Subject: one small ivory ceramic coffee cup filled with dark black coffee, on an ivory saucer, with a loop handle on the right. Style: polished faceted 3D illustration, simple chunky polygonal surfaces, warm key light from upper left, restrained cyan rim highlight and a very thin muted magenta accent stripe around the cup and saucer. Matching an existing faceted food/drink icon set, readable at 64 pixels. Composition: three-quarter view slightly from above, centered, cup and saucer occupy about 75% of the canvas with ample transparent margin; the coffee surface clearly visible. A subtle small wisp of steam is acceptable. Actual transparent background, no environment, no floor plane, no text, letters, labels, price, logo, coffee beans or extra food.

The generated original is `originals/coffee.png`; the runtime copies are
`coffee.png` and `coffee.webp`, both 256 × 256 with the alpha preserved.
