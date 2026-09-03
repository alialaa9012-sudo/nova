/** أخطاء الطلب مع كود HTTP. */
export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

export function notFound(message = 'العنصر غير موجود.') {
  return Object.assign(new Error(message), { status: 404, expose: true });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(value, field = 'المعرّف') {
  const v = String(value ?? '').trim();
  if (!UUID_RE.test(v)) throw badRequest(`${field} غير صالح.`);
  return v;
}

export function optionalUuid(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return uuid(value, field);
}

export function str(value, field, { min = 1, max = 2000 } = {}) {
  const v = String(value ?? '').trim();
  if (v.length < min) throw badRequest(`${field} مطلوب.`);
  if (v.length > max) throw badRequest(`${field} أطول من الحد المسموح (${max} حرف).`);
  return v;
}

export function optionalStr(value, field, opts = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return str(value, field, opts);
}

export function oneOf(value, allowed, field) {
  const v = String(value ?? '').trim();
  if (!allowed.includes(v)) {
    throw badRequest(`${field} يجب أن يكون أحد: ${allowed.join('، ')}.`);
  }
  return v;
}

export function optionalOneOf(value, allowed, field) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return oneOf(value, allowed, field);
}

export function money(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw badRequest(`${field} يجب أن يكون رقمًا موجبًا.`);
  return Math.round(n * 100) / 100;
}

export function int(value, field, { min = -2147483648, max = 2147483647 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${field} يجب أن يكون رقمًا صحيحًا بين ${min} و ${max}.`);
  }
  return n;
}

export function optionalInt(value, field, opts = {}) {
  if (value === undefined || value === null || value === '') return null;
  return int(value, field, opts);
}

export function bool(value, field) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`${field} يجب أن يكون true أو false.`);
}

export function timestamp(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} تاريخ غير صالح.`);
  return d.toISOString();
}

/** حد الصفحة: 1..200 */
export function pageLimit(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.trunc(n)));
}

export function pageOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}
