// The same Request → Response API runs on Node/SQLite and Cloudflare Workers/D1.
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (value) =>
  hex(await crypto.subtle.digest('SHA-256', enc.encode(value)));
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    ),
  );
}
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
export async function api(request, db, options = {}) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  const query = (sql, ...args) => db.prepare(sql).bind(...args);
  try {
    if (!['GET', 'HEAD'].includes(method)) {
      // Browser writes require a same-origin JSON request, preventing form and cross-origin CSRF.
      if (
        request.headers.get('Origin') !== url.origin &&
        request.headers.get('Origin') !== options.devOrigin
      )
        fail(403, 'Cross-origin writes are not allowed.');
      if (!request.headers.get('Content-Type')?.startsWith('application/json'))
        fail(415, 'Send application/json.');
    }
    if (path === '/api/health') {
      await query('SELECT 1 AS ok').first();
      return json({
        ok: true,
        storage: options.storage || 'D1',
        version: options.version || 'local',
      });
    }
    if (path === '/api/products' && method === 'GET')
      return json((await query('SELECT * FROM products ORDER BY price').all()).results);
    if (path === '/api/manifest' && method === 'GET')
      return json(
        options.manifest
          ? await options.manifest()
          : {
              apps: Object.fromEntries(
                (await query('SELECT * FROM deployments').all()).results.map((r) => [r.app, r]),
              ),
            },
      );
    if (path === '/api/releases' && method === 'GET')
      return json(
        options.releases
          ? await options.releases()
          : (
              await query(
                'SELECT app,version,entry,created_at FROM release_history ORDER BY created_at DESC LIMIT 30',
              ).all()
            ).results,
      );
    const rawToken = request.headers
      .get('Cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('mfl_session='))
      ?.slice(12);
    const tokenHash = rawToken ? await digest(rawToken) : '';
    const user = rawToken
      ? await query(
          'SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
          tokenHash,
          Date.now(),
        ).first()
      : null;
    const cookie = (value, age) =>
      `mfl_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${url.protocol === 'https:' ? '; Secure' : ''}`;
    if (path === '/api/session' && method === 'GET') return json({ user });
    if (['/api/register', '/api/login'].includes(path) && method === 'POST') {
      const text = await request.text();
      if (text.length > 4096) fail(413, 'Request too large.');
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        fail(400, 'Invalid JSON.');
      }
      const email = String(body.email || '')
          .trim()
          .toLowerCase(),
        password = String(body.password || ''),
        name = String(body.name || '').trim();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        password.length < 12 ||
        password.length > 128
      )
        fail(400, 'Use a valid email and a password of 12–128 characters.');
      if (path === '/api/register' && (name.length < 1 || name.length > 60))
        fail(400, 'Enter a name of 1–60 characters.');
      const limitKey = path + ':' + email,
        now = Date.now();
      await query(
        'INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',
        limitKey,
        now + 900000,
        now,
        now,
      ).run();
      const rate = await query('SELECT attempts FROM rate_limits WHERE key=?', limitKey).first();
      if (rate.attempts > 10) fail(429, 'Too many attempts. Try again in 15 minutes.');
      let account = await query('SELECT * FROM users WHERE email=?', email).first();
      if (path === '/api/register') {
        if (account) fail(409, 'This email is already registered. Sign in instead.');
        const salt = random(),
          id = crypto.randomUUID(),
          hash = await passwordHash(password, salt);
        try {
          await query('INSERT INTO users VALUES (?,?,?,?,?)', id, email, name, hash, salt).run();
        } catch (error) {
          if (String(error).includes('UNIQUE')) fail(409, 'This email is already registered.');
          throw error;
        }
        account = { id, email, name };
      } else {
        const hash = await passwordHash(password, account?.salt || 'unknown-account-salt');
        // Fixed-length comparison avoids an early-exit comparison of password hashes.
        let difference = 0;
        const expected = account?.password_hash || '0'.repeat(64);
        for (let i = 0; i < 64; i++) difference |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
        if (!account || difference) fail(401, 'Email or password is incorrect.');
      }
      const token = random();
      await db.batch([
        query('DELETE FROM sessions WHERE expires_at<?', now),
        query('DELETE FROM rate_limits WHERE reset_at<?', now),
        query(
          'INSERT INTO sessions VALUES (?,?,?)',
          await digest(token),
          account.id,
          now + 86400000,
        ),
        ...(rawToken ? [query('DELETE FROM sessions WHERE token_hash=?', tokenHash)] : []),
      ]);
      return json({ user: { id: account.id, email: account.email, name: account.name } }, 200, {
        'Set-Cookie': cookie(token, 86400),
      });
    }
    if (path === '/api/logout' && method === 'POST') {
      if (rawToken) await query('DELETE FROM sessions WHERE token_hash=?', tokenHash).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
    }
    if (!user) fail(401, 'Please sign in to continue.');
    const orderSql =
      'SELECT o.*,p.name AS product_name,p.category FROM orders o JOIN products p ON p.id=o.product_id';
    if (path === '/api/orders' && method === 'GET')
      return json(
        (await query(orderSql + ' WHERE o.user_id=? ORDER BY o.created_at DESC', user.id).all())
          .results,
      );
    if (path === '/api/orders' && method === 'POST') {
      const text = await request.text();
      if (text.length > 2048) fail(413, 'Request too large.');
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        fail(400, 'Invalid JSON.');
      }
      if (
        !Number.isInteger(body.quantity) ||
        body.quantity < 1 ||
        body.quantity > 10 ||
        typeof body.productId !== 'string' ||
        typeof body.requestKey !== 'string' ||
        body.requestKey.length > 80 ||
        body.requestKey.length < 8
      )
        fail(400, 'Invalid order.');
      const product = await query('SELECT * FROM products WHERE id=?', body.productId).first();
      if (!product) fail(404, 'Product not found.');
      await query(
        'INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?,?)',
        crypto.randomUUID(),
        user.id,
        product.id,
        body.quantity,
        product.price,
        new Date().toISOString(),
        body.requestKey,
      ).run();
      const order = await query(
        orderSql + ' WHERE o.user_id=? AND o.request_key=?',
        user.id,
        body.requestKey,
      ).first();
      return json(order, 201);
    }
    if (path.startsWith('/api/orders/') && method === 'GET') {
      const order = await query(
        orderSql + ' WHERE o.id=? AND o.user_id=?',
        path.slice(12),
        user.id,
      ).first();
      if (!order) fail(404, 'Order not found.');
      return json(order);
    }
    fail(404, 'Endpoint not found.');
  } catch (error) {
    if (!error.status) console.error(error);
    return json(
      { error: error.status ? error.message : 'An unexpected server error occurred.' },
      error.status || 500,
    );
  }
}
