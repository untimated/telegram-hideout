# Telegram Hideout

Install dependencies with `pnpm install`, set `TELEGRAM_BOT_TOKEN` and numeric
`ALLOWED_GROUP_ID`, then run `pnpm start` (or `node server.js`). For local
development, copy `.env.example` to `.env`, fill in those values, and run
`npm run dev` (or `pnpm dev`); the dev command loads `.env` automatically. The
Cloud Run `start` command uses the service's configured environment variables.
The group setting
accepts one numeric ID or a comma-separated list; members of any listed group
share the same room. Open the page
through the BotFather Mini App link. A plain browser URL cannot authenticate.

Run `pnpm test` for the HTTP and two-client relay check.

Hideout validates Telegram's signed Mini App `initData` and checks the configured
group with `getChatMember`. Prato must be a group administrator for this lookup
to be reliable. Only current members receive a one-hour session cookie. The
WebSocket checks that session and group membership before joining, then checks
membership every five minutes. Expired login data requires closing and reopening
the Mini App. Chat uses the verified Telegram username, or first name when no
username is available. The on-screen chat history keeps the latest 50 messages
for the current page session; the server does not save or replay messages sent
while disconnected.

The current game shell places a responsive HUD over a procedural Gossip Bar
blockout assembled from reusable Three.js model factories. It follows the
concept layout, authored in metres (1 world unit = 1 m) from `GossipBar - Layout -
Concept.png`: a 13 × 13 m main floor with a glass wall and 3 m planted pool strip
to the west, the raised bar in the north-west corner, an open kitchen alcove and
buffet to the north-east, a fountain and drinks island on a flat tile inset, the
jukebox against the glass, a lounge and café tables along the east wall, and a
stage in the south-east corner. The entrance is left of centre in the south wall.
Props keep their natural size; nothing is scaled to fit. New players arrive by the
entrance, facing the
fountain, bar, and kitchen. Each connected player appears as a small articulated robot
assembled from PBR primitives, with a short procedural walk cycle and a smaller
camera-facing profile photo above it, or generated initials when no photo is
available. Robot colors come from a fixed palette selected by stable player ID.
The same character builder supports player, guest, and NPC instances. The
perspective camera sits at the local player's eye level; your own robot is
hidden in first person. Drag the scene with a mouse or finger to look around;
camera orientation is relayed to other players so each robot turns and tilts
its head with its player's view. Join, move, and leave events keep the visible
player set synchronized, with movement interpolated between server positions.
Press Enter to focus the message input; sending a message returns keyboard focus
to the room. Other players' speech bubbles remain HTML elements, projected over
their speakers every frame so they follow player movement and shrink with
distance. Your own messages appear only in the chat history. The history starts
visible and can be toggled beside Send; the input log has a separate show/hide
control.

Telegram photos load through an authenticated same-origin route. The server
uses `getUserProfilePhotos` and `getFile`, caches the image briefly, and keeps
token-bearing Telegram download URLs private. If the bot cannot retrieve a
photo, the server tries Telegram's signed Mini App photo URL from a Telegram
host, then the client retains initials. Profile-photo privacy settings can
still prevent access. Guests also use initials. No additional environment
variables are needed.

Holding an arrow button, arrow key, or WASD sends at most one direction every
`200ms`, including rapid direction changes. Up/W move forward, Down/S backward,
and Left/A and Right/D strafe relative to the camera heading. Looking up or down
does not change walking speed. Typing in chat or leaving the window stops held
movement. The server enforces a `160ms` minimum between steps per player, applies
a fixed `0.3` step using the submitted heading, clamps positions inside the stage
boundary, and broadcasts the result. While a direction is held, the local camera
moves smoothly every frame at roughly the same speed; remote players ease between
server updates. Releasing input stops local movement immediately. The input log
distinguishes local input from server-registered movement. There is no object
collision yet. Players and positions live only in the current server process.

## Frontend structure

The browser code is split by responsibility so the room layout and later
interactions can grow without mixing DOM, networking, and rendering code:

- `public/js/app.js` coordinates authentication, WebSocket messages, and input.
- `public/js/ui.js` owns the HUD, profile, chat history, help, logs, and speech bubbles.
- `public/js/world.js` owns the Three.js renderer, camera, actor updates, and projection.
- `public/js/characters.js` builds the shared player, guest, and NPC robot.
- `public/js/stage.js` builds the Gossip Bar by running one module per area from
  `public/js/stage/` (lighting, shell, pool, bar, kitchen, lounge, stage area, dressing, NPCs,
  ceiling, backdrop). `stage/context.js` supplies the shared model kit, `place()`, `unlit()`,
  the interactable registry and the per-frame animators; `stage/layout.js` holds shared
  dimensions (room, fountain, pool). To add an area, write `stage/<area>.js` exporting
  `buildX(context)` and add it to the list in `stage.js`.
- `public/js/models/` contains shared PBR materials (`core.js`, including procedural stone,
  ripple, caustic and glow textures) and procedural generators for architecture, bar and
  kitchen fixtures, furniture, decor, roof/ceiling pieces and palms. Factories return named
  Three.js groups so later maps and interactions can reuse the same models.
- `public/js/sky.js` draws the static glitter night sky and the floor's reflection environment.
- `public/js/config.js` shares the room size, movement bounds, spawn, character scale and eye
  height between the scene, local movement, and server validation.
- `public/hideout.html` and `public/hideout.css` contain the page shell and styling.

The server serves every `.js` file under `public/js/` automatically (read once at startup, so
restart after edits). Textures and paintings under `assets/` are listed explicitly in
`server.js`. Keep them small: the pool tile maps are about 2.4 MB and the paintings are WebP.
Songs (`/music/<song id>.mp3`, from the files named in `catalog.js`) are served with Range
support so clients can seek to the shared position; menu icons are served from
`assets/menu-icons/` for catalog item ids only.

## Gameplay

Walk up to something: when it is within 3 m of your eye under the crosshair it gets a warm rim
light and an "E · …" hint, and E or a tap opens its panel (taps from further away do nothing):

- **Bar / Wolfred**, **Buffet / Pierre** and the **Refreshments** island open menus. Orders cost
  coins and are served as a 3D item on a free spot (bar counter, café tables, the island).
  Anyone can then tap a served item and eat or drink it; the effects go to whoever consumes it.
  The bar and buffet only sell while their NPC is on shift.
- **Chalkboard easels** by the bar and the kitchen show the weekday specials.
- **Jukebox**: pay 10 coins to play a song for the whole room, synced by start time; anyone can
  stop it. Volume falls off with distance, and the bar ambience loops underneath.
- **Seats**: bar stools, café chairs, the fountain cubes and the sofas (`game/seats.js`). Tap one to
  sit (one player per seat; Plain Joe keeps his chair during his shift); walking stands you up.
- **Other players**: send coins, or splash water on someone who passed out.
- **Mood**: `drunk` (0..1) blurs and sways the view above 0.5 and knocks you out at 1; `fuel`
  (1..0) knocks you out at 0. Passed-out players lie on the floor and cannot move. Each
  wall-clock hour online sobers you by 0.3 and burns 0.1 fuel (and a nap restores some fuel).
- **Coins**: 100 to start, +100 each Hideout day (days roll over at 1 AM), carried over.

Where the pieces live:

- `public/js/game/` is shared by the server and the browser: `catalog.js` (menus, prices,
  effects, songs, serving spots), `npcs.js` (NPC shifts, spots and activities), `rules.js` (mood
  rules) and `clock.js` (the shared Hideout time zone, `Asia/Jakarta` by default).
- `game.js` is the authoritative server side: wallets and moods, served items, the jukebox,
  transfers and hourly/daily ticks. Wallets live in memory; after a server restart each player's
  first `restore` message (their localStorage copy) is accepted once.
- `public/js/interaction.js` raycasts taps against `level.userData.interactables`, served items
  and other players; `public/js/panels.js` is the HUD (meters, menus, modals, toasts);
  `public/js/items.js` builds the served food and drink models; `public/js/audio.js` plays the
  jukebox and ambience; `public/js/stage/npcs.js` shows NPCs during their shifts and animates
  them; `public/js/stage/boards.js` draws the specials easels.
- Menu pictures are optional: `assets/menu-icons/<item id>.webp` (or .png) replaces the emoji.

Socket messages on top of move/orientation/chat: the client sends `buy`, `consume`,
`jukebox_play`, `jukebox_stop`, `transfer`, `splash` and `restore`; the server sends `self` (your
coins and mood), `item_added`, `item_removed`, `jukebox`, `player_state` (asleep), `notice`
(to one player) and `activity` (a line in everyone's chat log). `welcome` carries a `game`
snapshot.

Debug guests can preview another hour's NPCs and specials with `&hour=14` in the URL. This is
view only: the server still sells by real Hideout time.

## Performance

"Show log" prints live render stats (fps, frame time, draw calls, triangles, shaders, resolution).

- `public/js/stage/bake.js` merges the static level by material after it is built (about 1,600
  meshes into 66) and merges each robot's rigid parts (about 100 meshes per robot into 20-ish).
  Interactables, NPCs, served items, transparent meshes and anything marked
  `userData.dynamic = true` are left separate; mark new moving props that way.
- The shadow map is rendered once after loading (`shadowMap.autoUpdate = false`); characters
  and items use blob shadows.
- `public/js/quality.js` lowers the render resolution on slow devices (down to 0.75x) and, as a
  last step, turns off the small lamp point lights.

Three.js already frustum-culls every object; with the level merged, draw calls and per-pixel
lighting (22 real-time lights) are what cost frames, not culling.

## Debug guest access

For testing outside Telegram, set both `DEBUG_GUEST_USERNAME` and
`DEBUG_GUEST_PASSWORD` on the Hideout service, then open:

```text
https://YOUR-CLOUD-RUN-URL/hideout?guest=1
```

The browser shows its native Basic Auth prompt. Valid credentials create a
signed one-hour debug session for each tab (`Guest 1`, `Guest 2`, and so on), so
you can open two tabs in the same browser and see two separate players. Guest
sessions can use chat and movement without a Telegram membership lookup. The
ordinary `/hideout` URL still requires Telegram.
Leave both debug variables unset to remove the guest route; keep the password in
Secret Manager and use this only over HTTPS.

If the Mini App says its Telegram login could not be verified, close it fully and
launch it again from Telegram. A repeated `401` also means the Hideout service's
`TELEGRAM_BOT_TOKEN` may not belong to the bot whose Mini App was opened. Group
membership checks happen only after Telegram login succeeds.

The server listens on `0.0.0.0` and uses `PORT` (default `8080`). No cloud deployment
is required for local testing.

## Cloud Run prototype

Create a **Cloud Run service** from this GitHub repository using **Buildpacks**.
The repository connection creates the build and deployment trigger; this project
does not need a separate `cloudbuild.yaml` or Dockerfile. The Node buildpack reads
`package.json`, detects `pnpm-lock.yaml`, installs dependencies, and runs `start`.

For the first shared-room test, use these service settings:

- Allow public access so Telegram can load the page; `/auth` and `/ws` enforce
  Telegram membership themselves.
- Configure `TELEGRAM_BOT_TOKEN` as a secret on this service and set
  `ALLOWED_GROUP_ID` to the numeric group ID or a comma-separated list, such as
  `-1001234567890,-1009876543210`. Use the same bot configured in BotFather;
  it must be an administrator in every listed group for reliable membership
  checks. Debug guest access stays disabled unless explicitly configured above.
- Request-based billing and minimum instances `0` are fine for the prototype.
- Set maximum instances to `1` while chat state lives only in one process.
- Increase the request timeout for WebSocket sessions (for example, `3600` seconds).
- Keep HTTP/2 end-to-end disabled for WebSockets.

Wallets (coins, drunk, fuel) live in server memory and are lost when the instance
restarts or scales to zero. Each client keeps a backup copy, in Telegram
CloudStorage inside Telegram and in localStorage elsewhere (`public/js/wallet-store.js`).
The server accepts that copy once per player after a restart, before they spend
anything. It is not tamper-proof, which is fine for a friends' bar.

Open the BotFather Mini App link from two Telegram accounts and send a message
from each. A new Cloud Run revision or instance restart clears the room. Maximum
instances `1` is only a prototype aid: Cloud Run can temporarily exceed an
instance limit, and different revisions can coexist during deployment. Shared
state across instances will be needed before treating this as a reliable room.

On the Prato bot service, set `HIDEOUT_MINI_APP_URL` to the exact BotFather link.
The `/hideout` command then replies with an Enter Hideout button. Push and deploy
both repositories before testing the command and the new access checks.
