import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyInitData } from './auth.js';

test('validates the published Telegram Mini App HMAC example', () => {
  // Public example from Telegram Mini Apps documentation.
  const raw = 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2';
  const token = '5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8';
  assert.deepEqual(verifyInitData(raw, token, 1662771648), { id: 279058397, name: '@vdkfrost' });
  assert.equal(verifyInitData(raw, token, 1662771648 + 3601), null);
  assert.equal(verifyInitData(raw.replace('Vladislav', 'SomeoneElse'), token, 1662771648), null);
});
