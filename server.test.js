import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createHideoutServer } from './server.js';

test('serves hideout and relays both directions, including sender echo', { timeout: 10000 }, async t => {
  const { server, sockets } = createHideoutServer();
  t.after(async () => {
    for (const client of sockets.clients) client.terminate();
    sockets.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `127.0.0.1:${server.address().port}`;
  const page = await fetch(`http://${base}/hideout`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /GossipBoy Hideout/);

  const a = new WebSocket(`ws://${base}/ws`);
  const welcomeA = JSON.parse((await once(a, 'message'))[0].toString());
  const b = new WebSocket(`ws://${base}/ws`);
  const welcomeB = JSON.parse((await once(b, 'message'))[0].toString());
  assert.notEqual(welcomeA.name, welcomeB.name);

  for (const [sender, name, text] of [[a, welcomeA.name, 'hello from A'], [b, welcomeB.name, 'hello from B']]) {
    const received = Promise.all([once(a, 'message'), once(b, 'message')]);
    sender.send(JSON.stringify({ type: 'chat', text, name: 'spoofed name' }));
    for (const [data] of await received) {
      assert.deepEqual(JSON.parse(data.toString()), { type: 'chat', name, text });
    }
  }
  a.terminate();
  b.terminate();
});
