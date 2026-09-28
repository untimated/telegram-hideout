# Telegram Hideout

Install dependencies with `pnpm install`, set `TELEGRAM_BOT_TOKEN` and numeric
`ALLOWED_GROUP_ID`, then run `pnpm start` (or `node server.js`). The group setting
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
username is available. The chat still has no saved history or game; messages
sent while disconnected are not replayed.

The current game shell places a responsive HUD over a small enclosed Three.js
stage. Each connected player appears as a solid-color capsule with a smaller
camera-facing profile photo above it, or generated initials when no photo is
available. The perspective camera sits at the local player's eye level; your
own capsule is hidden. Drag the scene with a
mouse or finger to look around. Join, move, and leave events keep the visible
player set synchronized, with movement interpolated between server positions.

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
moves smoothly every frame at roughly the same speed; on release it eases toward
the last server position. The input log distinguishes local input from
server-registered movement. There is no object collision yet. Players and
positions live only in the current server process.

## Debug guest access

For testing outside Telegram, set both `DEBUG_GUEST_USERNAME` and
`DEBUG_GUEST_PASSWORD` on the Hideout service, then open:

```text
https://YOUR-CLOUD-RUN-URL/hideout?guest=1
```

The browser shows its native Basic Auth prompt. Valid credentials create a
signed one-hour session named `Guest`, which can use chat and movement without a
Telegram membership lookup. The ordinary `/hideout` URL still requires Telegram.
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

Open the BotFather Mini App link from two Telegram accounts and send a message
from each. A new Cloud Run revision or instance restart clears the room. Maximum
instances `1` is only a prototype aid: Cloud Run can temporarily exceed an
instance limit, and different revisions can coexist during deployment. Shared
state across instances will be needed before treating this as a reliable room.

On the Prato bot service, set `HIDEOUT_MINI_APP_URL` to the exact BotFather link.
The `/hideout` command then replies with an Enter Hideout button. Push and deploy
both repositories before testing the command and the new access checks.
