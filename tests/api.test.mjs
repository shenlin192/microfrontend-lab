import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api } from '../server/api.mjs';
import { database } from '../server/sqlite.mjs';
const origin = 'http://localhost:4100';
function client(db) {
  let cookie = '';
  return async (path, method = 'GET', body, extra = {}) => {
    const response = await api(
      new Request(origin + '/api' + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
          Cookie: cookie,
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      db,
    );
    if (response.headers.has('Set-Cookie'))
      cookie = response.headers.get('Set-Cookie').split(';')[0];
    return {
      status: response.status,
      data: await response.json(),
      cookie,
      headers: response.headers,
    };
  };
}
const credentials = (email) => ({ email, password: 'test-password-12345', name: 'Test learner' });
test('real sessions, server prices, idempotency, ownership, persistence and logout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mfl-test-'));
  let db = database(join(dir, 'db.sqlite'));
  try {
    const alice = client(db),
      bob = client(db);
    assert.equal((await alice('/orders')).status, 401);
    const registered = await alice('/register', 'POST', credentials('alice@example.test'));
    assert.equal(registered.status, 200);
    assert.match(registered.headers.get('Set-Cookie'), /HttpOnly/);
    const stored = await db.prepare('SELECT * FROM users').bind().first();
    assert.notEqual(stored.password_hash, 'test-password-12345');
    const order = await alice('/orders', 'POST', {
      productId: 'notes',
      quantity: 2,
      requestKey: 'request-0001',
      unit_price: 1,
    });
    assert.equal(order.status, 201);
    assert.equal(order.data.unit_price, 1400);
    const same = await alice('/orders', 'POST', {
      productId: 'notes',
      quantity: 2,
      requestKey: 'request-0001',
    });
    assert.equal(same.data.id, order.data.id);
    assert.equal((await alice('/orders')).data.length, 1);
    assert.equal(
      (
        await alice('/orders', 'POST', {
          productId: 'notes',
          quantity: -1,
          requestKey: 'bad-quantity',
        })
      ).status,
      400,
    );
    assert.equal((await bob('/register', 'POST', credentials('bob@example.test'))).status, 200);
    assert.equal((await bob('/orders')).data.length, 0);
    assert.equal((await bob('/orders/' + order.data.id)).status, 404);
    assert.equal(
      (await alice('/orders', 'POST', {}, { Origin: 'https://evil.example' })).status,
      403,
    );
    db.close();
    db = database(join(dir, 'db.sqlite'));
    const resumed = client(db);
    assert.equal((await resumed('/login', 'POST', credentials('alice@example.test'))).status, 200);
    assert.equal((await resumed('/orders')).data[0].id, order.data.id);
    const session = await resumed('/session');
    assert.equal(session.data.user.email, 'alice@example.test');
    assert.equal((await resumed('/logout', 'POST', {})).status, 200);
    assert.equal((await resumed('/orders')).status, 401);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test('bad password and cross-origin registration are rejected', async () => {
  const db = database(':memory:');
  try {
    const request = client(db);
    await request('/register', 'POST', credentials('test@example.test'));
    await request('/logout', 'POST', {});
    assert.equal(
      (
        await request('/login', 'POST', {
          email: 'test@example.test',
          password: 'not-the-correct-password',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request('/register', 'POST', credentials('cross@example.test'), {
          Origin: 'https://evil.example',
        })
      ).status,
      403,
    );
    assert.equal((await request('/session')).data.user, null);
  } finally {
    db.close();
  }
});
