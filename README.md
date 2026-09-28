# Telegram Hideout relay prototype

Install dependencies with `pnpm install`, then run `pnpm start` (or `node server.js`).
Open http://localhost:8080/hideout in two tabs or browser windows. Each connection
gets its own guest name. Send a message from either tab: both logs should show
the same server-delivered message, including the sender's tab.

Run `pnpm test` for the HTTP and two-client relay check.

This prototype has no Telegram login, membership checks, saved history, or game.
It is a local flow test; anyone who can reach it can join. Refreshing clears the
tab's log and assigns a new guest identity. Disconnected tabs reconnect automatically;
messages sent while they are offline are not replayed. Restarting the server resets
guest numbering. All clients must connect to the same server process to share a room.

The server listens on `0.0.0.0` and uses `PORT` (default `8080`). No cloud deployment
is required for local testing.

## Cloud Run prototype

Create a **Cloud Run service** from this GitHub repository using **Buildpacks**.
The repository connection creates the build and deployment trigger; this project
does not need a separate `cloudbuild.yaml` or Dockerfile. The Node buildpack reads
`package.json`, detects `pnpm-lock.yaml`, installs dependencies, and runs `start`.

For the first shared-room test, use these service settings:

- Allow public access so browsers can load the page and connect to `/ws`.
- Request-based billing and minimum instances `0` are fine for the prototype.
- Set maximum instances to `1` while chat state lives only in one process.
- Increase the request timeout for WebSocket sessions (for example, `3600` seconds).
- Keep HTTP/2 end-to-end disabled for WebSockets.

Open `https://YOUR_SERVICE_URL/hideout` in two browsers and send a message from
each. A new Cloud Run revision or instance restart clears the room. Maximum
instances `1` is only a prototype aid: Cloud Run can temporarily exceed an
instance limit, and different revisions can coexist during deployment. Shared
state across instances will be needed before treating this as a reliable room.

The service is **public and unauthenticated** at this stage. Do not share its URL
as a members-only room until Telegram identity and membership checks protect
both the page's login flow and the WebSocket connection.
