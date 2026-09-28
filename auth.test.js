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

test('validates signed Mini App data that includes a signature field', () => {
  // Published example from Telegram Mini Apps init-data-golang documentation.
  const raw = 'user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D&chat_instance=8134722200314281151&chat_type=private&auth_date=1733509682&signature=TYJxVcisqbWjtodPepiJ6ghziUL94-KNpG8Pau-X7oNNLNBM72APCpi_RKiUlBvcqo5L-LAxIc3dnTzcZX_PDg&hash=a433d8f9847bd6addcc563bff7cc82c89e97ea0d90c11fe5729cae6796a36d73';
  const token = '7342037359:AAHI25ES9xCOMPokpYoz-p8XVrZUdygo2J4';
  assert.deepEqual(verifyInitData(raw, token, 1733509682), {
    id: 279058397,
    name: '@vdkfrost',
    photoURL: 'https://t.me/i/userpic/320/4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg',
  });
  assert.equal(verifyInitData(raw.replace('TYJxVcis', 'AAAAAAAc'), token, 1733509682), null);
});
