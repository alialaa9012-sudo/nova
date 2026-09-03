import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
process.env.NODE_ENV = 'test';

const { __setPool } = await import('../src/db.js');
const { createApp } = await import('../src/server.js');

/** Pool وهمي: نسجّل كل استعلام ونرجّع ردًا مبرمجًا. */
let handlers = [];
let calls = [];

const fakePool = {
  query(text, params) {
    calls.push({ text, params });
    for (const h of handlers) {
      if (h.match.test(text)) return Promise.resolve(h.result);
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  },
  connect() {
    return Promise.resolve({
      query: (t, p) => fakePool.query(t, p),
      release() {},
    });
  },
};

function reply(match, rows) {
  handlers.unshift({ match, result: { rows, rowCount: rows.length } });
}

const OWNER_ID = '05a1fe28-d31d-4e1d-b67c-83d32b3095a4';
const RESTAURANT_ID = '3b49c6d8-eaaa-4b21-a39a-604e127028e1';
let PASSWORD_HASH;

let server, baseUrl;

before(async () => {
  __setPool(fakePool);
  PASSWORD_HASH = await bcrypt.hash('correct-horse', 10);
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  handlers = [];
  calls = [];
});

function userRow(role = 'owner') {
  return {
    id: OWNER_ID, restaurant_id: RESTAURANT_ID, branch_id: null,
    name: 'علي', email: 'owner@test.nova', password_hash: PASSWORD_HASH,
    role, active: true, restaurant_name: 'مطعم تجريبي',
    currency: 'SAR', timezone: 'Asia/Riyadh', restaurant_ok: true,
  };
}

async function login(role = 'owner') {
  reply(/FROM users u\s+JOIN restaurants r/, [userRow(role)]);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.nova', password: 'correct-horse' }),
  });
  assert.equal(res.status, 200, 'login should succeed');
  const cookie = res.headers.getSetCookie().join('; ');
  handlers = [];
  calls = [];
  return cookie;
}

function api(pathname, cookie, init = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });
}

// ---------- الصحة ----------

test('health يرجّع ok لما قاعدة البيانات شغالة', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, db: 'up' });
});

// ---------- الدخول ----------

test('الدخول بكلمة مرور خاطئة يرفض بـ 401', async () => {
  reply(/FROM users u\s+JOIN restaurants r/, [userRow()]);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.nova', password: 'wrong' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('الدخول بإيميل غير موجود يرفض بـ 401 بنفس الرسالة', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ghost@test.nova', password: 'whatever' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('الحساب الموقوف مايدخلش', async () => {
  reply(/FROM users u\s+JOIN restaurants r/, [{ ...userRow(), active: false }]);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.nova', password: 'correct-horse' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'inactive');
});

test('الدخول الصحيح يرجّع كوكي جلسة httpOnly', async () => {
  reply(/FROM users u\s+JOIN restaurants r/, [userRow()]);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.nova', password: 'correct-horse' }),
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.getSetCookie().join('; ');
  assert.match(cookie, /nova_session=/);
  assert.match(cookie, /HttpOnly/i);
  const body = await res.json();
  assert.equal(body.user.email, 'owner@test.nova');
  assert.equal(body.user.restaurant.id, RESTAURANT_ID);
  assert.equal(body.user.password_hash, undefined, 'ما ينفعش نرجّع الهاش');
});

// ---------- الحماية ----------

test('كل مسارات البيانات مقفولة من غير جلسة', async () => {
  for (const p of ['/api/stats', '/api/menu', '/api/reservations', '/api/complaints',
                   '/api/customers', '/api/conversations', '/api/kb', '/api/overrides',
                   '/api/branches', '/api/users', '/api/audit', '/api/restaurant']) {
    const res = await fetch(`${baseUrl}${p}`);
    assert.equal(res.status, 401, `${p} لازم يرجّع 401`);
  }
});

test('كوكي مزوّر يترفض', async () => {
  const res = await api('/api/stats', 'nova_session=not.a.real.token');
  assert.equal(res.status, 401);
});

test('الموظف مايقدرش يضيف قسم في المنيو (403)', async () => {
  const cookie = await login('staff');
  const res = await api('/api/menu/categories', cookie, {
    method: 'POST', body: JSON.stringify({ name: 'قسم جديد' }),
  });
  assert.equal(res.status, 403);
});

test('المدير مايقدرش يضيف مستخدم — للمالك بس (403)', async () => {
  const cookie = await login('manager');
  const res = await api('/api/users', cookie, {
    method: 'POST',
    body: JSON.stringify({ name: 'x', email: 'x@y.com', role: 'staff', password: 'password1' }),
  });
  assert.equal(res.status, 403);
});

test('الموظف يقدر يوقف صنف — ده شغله اليومي', async () => {
  const cookie = await login('staff');
  reply(/UPDATE menu_items/, [{ id: 'f0e1d2c3-1111-2222-3333-444455556666', name: 'شوربة عدس', available: false }]);
  const res = await api('/api/menu/items/f0e1d2c3-1111-2222-3333-444455556666/availability', cookie, {
    method: 'PATCH', body: JSON.stringify({ available: false, reason: 'kitchen' }),
  });
  assert.equal(res.status, 200);
});

// ---------- عزل المطاعم ----------

test('كل استعلام بيتقيّد بمطعم المستخدم', async () => {
  const cookie = await login('owner');
  await api('/api/complaints', cookie);
  const dataCalls = calls.filter((c) => /FROM complaints/.test(c.text));
  assert.ok(dataCalls.length > 0, 'لازم يكون فيه استعلام');
  for (const c of dataCalls) {
    assert.equal(c.params[0], RESTAURANT_ID, 'أول باراميتر لازم يكون معرّف المطعم');
  }
});

test('محاولة تعديل صنف تمرّر معرّف المطعم مع المعرّف', async () => {
  const cookie = await login('owner');
  reply(/UPDATE menu_items/, [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }]);
  await api('/api/menu/items/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/availability', cookie, {
    method: 'PATCH', body: JSON.stringify({ available: true }),
  });
  const c = calls.find((x) => /UPDATE menu_items/.test(x.text));
  assert.equal(c.params[1], RESTAURANT_ID);
});

// ---------- التحقق من المدخلات ----------

test('معرّف غير صالح يرجّع 400 مش 500', async () => {
  const cookie = await login('owner');
  const res = await api('/api/menu/items/not-a-uuid/availability', cookie, {
    method: 'PATCH', body: JSON.stringify({ available: true }),
  });
  assert.equal(res.status, 400);
});

test('حجز بعدد أفراد صفر يترفض', async () => {
  const cookie = await login('owner');
  const res = await api('/api/reservations', cookie, {
    method: 'POST',
    body: JSON.stringify({
      branchId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      reservationTime: '2026-09-10T19:00:00Z',
      guests: 0,
      customerPhone: '+201000000000',
    }),
  });
  assert.equal(res.status, 400);
});

test('حالة غير موجودة في الشكاوى تترفض', async () => {
  const cookie = await login('owner');
  const res = await api('/api/complaints/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'deleted' }),
  });
  assert.equal(res.status, 400);
});

test('سعر سالب في المنيو يترفض', async () => {
  const cookie = await login('owner');
  const res = await api('/api/menu/items', cookie, {
    method: 'POST', body: JSON.stringify({ name: 'صنف', price: -5 }),
  });
  assert.equal(res.status, 400);
});

test('العنصر غير الموجود يرجّع 404', async () => {
  const cookie = await login('owner');
  const res = await api('/api/menu/items/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/availability', cookie, {
    method: 'PATCH', body: JSON.stringify({ available: true }),
  });
  assert.equal(res.status, 404);
});

// ---------- المالك ما يقفلش على نفسه ----------

test('المالك مايقدرش يوقف حساب نفسه', async () => {
  const cookie = await login('owner');
  const res = await api(`/api/users/${OWNER_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ active: false }),
  });
  assert.equal(res.status, 400);
});

test('المالك مايقدرش ينزّل دوره لموظف', async () => {
  const cookie = await login('owner');
  const res = await api(`/api/users/${OWNER_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ role: 'staff' }),
  });
  assert.equal(res.status, 400);
});

// ---------- سجل العمليات ----------

test('كل عملية كتابة بتتسجّل في audit_log', async () => {
  const cookie = await login('owner');
  reply(/UPDATE menu_items/, [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', available: false }]);
  await api('/api/menu/items/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/availability', cookie, {
    method: 'PATCH', body: JSON.stringify({ available: false, reason: 'kitchen' }),
  });
  const auditCall = calls.find((c) => /INSERT INTO audit_log/.test(c.text));
  assert.ok(auditCall, 'لازم يتسجّل في audit_log');
  assert.equal(auditCall.params[0], RESTAURANT_ID);
  assert.equal(auditCall.params[1], 'owner@test.nova');
  assert.equal(auditCall.params[2], 'menu_item.disable');
});

test('الخروج يمسح الكوكي', async () => {
  const cookie = await login('owner');
  const res = await api('/api/auth/logout', cookie, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.match(res.headers.getSetCookie().join('; '), /nova_session=;/);
});

// إغلاق السيرفر بعد الاختبارات عشان العملية تنتهي.
import { after } from 'node:test';
after(() => { server?.close(); });
