# Gossip Bar menu icons

14 individually generated icons matching the item IDs in `public/js/game/catalog.js`.

- `<item-id>.webp`: recommended menu asset, 256 x 256, with alpha transparency.
- `<item-id>.png`: equivalent transparent PNG, 256 x 256.
- `originals/<item-id>.png`: full-size generated original.
- `manifest.json`: item IDs, labels, categories, filenames and provisional-art flags.
- `preview.png`: labelled overview for review, not a runtime sprite sheet.
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
