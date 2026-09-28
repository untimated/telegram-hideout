import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvatarLoader } from './avatars.js';

test('avatar downloads reject non-images and oversized bodies and cache failures briefly', async () => {
  for (const bytes of [Buffer.from('<html>not a photo</html>'), Buffer.alloc(2 * 1024 * 1024 + 1)]) {
    let time = 0;
    let calls = 0;
    const loader = createAvatarLoader({
      botToken: 'test', telegramAPIBase: 'https://api.telegram.org', now: () => time,
      fetchImpl: async url => {
        calls++;
        if (url.endsWith('/getUserProfilePhotos')) {
          return Response.json({ ok: true, result: { photos: [[{ width: 160, file_id: 'photo' }]] } });
        }
        if (url.endsWith('/getFile')) return Response.json({ ok: true, result: { file_path: 'photos/test.png' } });
        return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
      },
    });
    await assert.rejects(loader.get('1'), /Unsupported Telegram photo|Telegram photo too large/);
    assert.equal(calls, 3);
    await assert.rejects(loader.get('1'));
    assert.equal(calls, 3);
    time = 61;
    await assert.rejects(loader.get('1'));
    assert.equal(calls, 6);
  }
});
