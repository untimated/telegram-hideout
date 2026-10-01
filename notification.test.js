import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createHideoutServer } from './server.js';

const botToken = '123:test-token';
const now = 1_800_000_000;
function loginData(user) {
  const params = new URLSearchParams({ auth_date: String(now), user: JSON.stringify(user) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', key).update(check).digest('hex'));
  return params.toString();
}

test('entry notifications use verified login names, exclude rejected logins and guests, and tolerate delivery failure', async t => {
  const notices = [];
  let failure = false;
  const notificationURL = 'https://bot.example/hideout/entered';
  const { server, sockets } = createHideoutServer({
    botToken, groupID: '-100123', now: () => now,
    notificationURL, notificationSecret: 'entry-secret',
    debugGuestUsername: 'debug', debugGuestPassword: 'secret',
    fetchImpl: async (url, options) => {
      if (url.endsWith('/getChatMember')) {
        const { user_id } = JSON.parse(options.body);
        return Response.json({ ok: true, result: { status: user_id === 9 ? 'left' : 'member' } });
      }
      assert.equal(url, notificationURL);
      notices.push(options);
      return new Response(null, { status: failure ? 502 : 204 });
    },
  });
  t.after(async () => {
    sockets.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const auth = initData => fetch(`${origin}/auth`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  assert.equal((await auth('invalid')).status, 401);
  assert.equal((await auth(loginData({ id: 9, first_name: 'Outsider' }))).status, 403);
  const guest = await fetch(`${origin}/auth/guest`, {
    method: 'POST', headers: { Origin: origin, Authorization: `Basic ${Buffer.from('debug:secret').toString('base64')}` },
  });
  assert.equal(guest.status, 200);
  assert.equal(notices.length, 0);
  const signed = loginData({ id: 1, first_name: 'Michael', username: 'hermanmichael' });
  for (let i = 0; i < 2; i++) assert.equal((await auth(signed)).status, 200);
  failure = true;
  const response = await auth(loginData({ id: 2, first_name: 'Alice' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /hideout_session=/);
  assert.deepEqual(notices.map(notice => JSON.parse(notice.body)), [
    { name: '@hermanmichael' }, { name: '@hermanmichael' }, { name: 'Alice' },
  ]);
  for (const notice of notices) {
    assert.equal(notice.method, 'POST');
    assert.equal(notice.headers.Authorization, 'Bearer entry-secret');
    assert.equal(notice.redirect, 'error');
  }
});
