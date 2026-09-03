// ==========================================================
// NOVA — لوحة التحكم
// كل البيانات بتيجي من /api (نفس السيرفر)، والجلسة في كوكي httpOnly.
// ==========================================================

const state = {
  user: null,
  page: 'overview',
  stats: {},
  cache: {},
};

// ---------- أدوات ----------

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children.flat()) {
    if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: options.body ? { 'content-type': 'application/json' } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && state.user) {
    state.user = null;
    showLogin('انتهت الجلسة. سجّل دخول تاني.');
    throw new Error('unauthorized');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'حصل خطأ. حاول تاني.');
  return data;
}

const CURRENCY_LABEL = { EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ' };

function money(value) {
  const c = CURRENCY_LABEL[state.user?.restaurant?.currency] ?? '';
  return `${Number(value ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ${c}`;
}

function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'medium', timeStyle: 'short',
    timeZone: state.user?.restaurant?.timezone || undefined,
  });
}

function relative(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'دلوقتي';
  if (Math.abs(mins) < 60) return `من ${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `من ${hrs} ساعة`;
  return `من ${Math.round(hrs / 24)} يوم`;
}

function canManage() { return ['owner', 'manager'].includes(state.user?.role); }
function isOwner() { return state.user?.role === 'owner'; }

function toast(message, kind = 'ok') {
  const box = el('div', { className: `msg msg-${kind}`, textContent: message });
  Object.assign(box.style, {
    position: 'fixed', insetInlineEnd: '20px', bottom: '20px', zIndex: 200, maxWidth: '340px',
  });
  document.body.append(box);
  setTimeout(() => box.remove(), 3600);
}

// ---------- الترجمات ----------

const T = {
  status: {
    pending: 'قيد الانتظار', confirmed: 'مؤكد', cancelled: 'ملغي',
    new: 'جديدة', in_progress: 'جاري الحل', resolved: 'تم الحل',
    ai: 'البوت', human: 'موظف', closed: 'مقفولة',
  },
  priority: { high: 'عالية', mid: 'متوسطة', low: 'منخفضة' },
  source: {
    whatsapp: 'واتساب', instagram: 'إنستجرام', facebook: 'فيسبوك',
    voice: 'صوتي', call: 'مكالمة', manual: 'يدوي',
  },
  classification: { new: 'جديد', repeat: 'متكرر', vip: 'VIP' },
  role: { owner: 'مالك', manager: 'مدير', staff: 'موظف' },
  reason: { kitchen: 'المطبخ', staff: 'نقص عمالة', seasonal: 'موسمي' },
  category: {
    stock_outage: 'نفاد صنف', price_change: 'تغيير سعر',
    closure: 'إغلاق', promo: 'عرض', general: 'عام',
  },
  channel: { whatsapp: 'واتساب', instagram: 'إنستجرام', facebook: 'فيسبوك', google_reviews: 'تقييمات جوجل' },
};

const TAG_CLASS = {
  confirmed: 'tag-ok', pending: 'tag-warn', cancelled: 'tag-muted',
  resolved: 'tag-ok', in_progress: 'tag-warn', new: 'tag-danger',
  ai: 'tag-lime', human: 'tag-warn', closed: 'tag-muted',
  high: 'tag-danger', mid: 'tag-warn', low: 'tag-muted',
  vip: 'tag-lime', repeat: 'tag-ok',
};

const tag = (value, dict = T.status) =>
  el('span', { className: `tag ${TAG_CLASS[value] ?? 'tag-muted'}`, textContent: dict[value] ?? value });

// ---------- الدخول ----------

function showLogin(message) {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  const err = $('#login-error');
  if (message) { err.textContent = message; err.hidden = false; } else { err.hidden = true; }
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = 'جاري الدخول...';
  $('#login-error').hidden = true;
  try {
    const { user } = await api('/auth/login', {
      method: 'POST',
      body: { email: $('#email').value, password: $('#password').value },
    });
    state.user = user;
    $('#password').value = '';
    startApp();
  } catch (err) {
    const box = $('#login-error');
    box.textContent = err.message;
    box.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* تجاهل */ }
  state.user = null;
  showLogin();
});

$('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

// ---------- التنقل ----------

const PAGES = [
  { id: 'overview',      label: 'نظرة عامة',        render: renderOverview },
  { id: 'reservations',  label: 'الحجوزات',          render: renderReservations, badge: 'reservations_pending' },
  { id: 'complaints',    label: 'الشكاوى',           render: renderComplaints,   badge: 'complaints_open' },
  { id: 'conversations', label: 'المحادثات',         render: renderConversations, badge: 'conversations_human' },
  { id: 'menu',          label: 'المنيو',            render: renderMenu },
  { id: 'customers',     label: 'العملاء',           render: renderCustomers },
  { id: 'overrides',     label: 'تعليمات طارئة',     render: renderOverrides,    badge: 'overrides_active' },
  { id: 'kb',            label: 'معرفة البوت',       render: renderKb,           minRole: 'manager' },
  { id: 'settings',      label: 'الإعدادات',         render: renderSettings },
];

function buildNav() {
  const nav = $('#nav');
  nav.replaceChildren();
  for (const p of PAGES) {
    if (p.minRole === 'manager' && !canManage()) continue;
    const badgeValue = p.badge ? Number(state.stats[p.badge] ?? 0) : 0;
    const btn = el('button', {
      className: `nav-item${state.page === p.id ? ' active' : ''}`,
      onclick: () => go(p.id),
    }, el('span', { textContent: p.label }));
    if (badgeValue > 0) btn.append(el('span', { className: 'nav-badge', textContent: badgeValue }));
    nav.append(btn);
  }
}

async function go(pageId) {
  state.page = pageId;
  $('#sidebar').classList.remove('open');
  buildNav();
  const page = PAGES.find((p) => p.id === pageId) ?? PAGES[0];
  $('#page').replaceChildren(el('div', { className: 'loading', textContent: 'جاري التحميل...' }));
  try {
    await page.render();
  } catch (err) {
    $('#page').replaceChildren(el('div', { className: 'msg msg-error', textContent: err.message }));
  }
}

async function refreshStats() {
  try {
    state.stats = await api('/stats');
    buildNav();
  } catch { /* تجاهل */ }
}

function startApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#rest-name').textContent = state.user.restaurant.name;
  $('#user-name').textContent = state.user.name;
  $('#user-role').textContent = T.role[state.user.role] ?? state.user.role;
  refreshStats().then(() => go('overview'));
}

// ---------- عناصر مشتركة ----------

function pageHead(title, subtitle, ...actions) {
  return el('div', { className: 'page-head' },
    el('div', {}, el('h2', { textContent: title }), subtitle ? el('p', { textContent: subtitle }) : null),
    actions.length ? el('div', { className: 'filters' }, ...actions) : null
  );
}

function panel(title, body, ...headActions) {
  return el('div', { className: 'panel' },
    el('div', { className: 'panel-head' },
      el('h3', { textContent: title }),
      headActions.length ? el('div', { className: 'filters' }, ...headActions) : null),
    body);
}

function table(headers, rows, emptyText = 'مفيش بيانات هنا.') {
  if (!rows.length) return el('div', { className: 'empty', textContent: emptyText });
  return el('div', { className: 'table-scroll' },
    el('table', {},
      el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', { textContent: h })))),
      el('tbody', {}, ...rows)));
}

function select(options, value, onchange) {
  const s = el('select', { onchange: (e) => onchange(e.target.value) });
  for (const [val, label] of options) {
    s.append(el('option', { value: val, textContent: label, selected: val === value }));
  }
  return s;
}

function modal(title, fields, onSubmit, submitLabel = 'حفظ') {
  const root = $('#modal-root');
  const inputs = {};
  const form = el('form', { className: 'modal' });
  form.append(el('h3', { textContent: title }));
  const errBox = el('div', { className: 'msg msg-error', hidden: true });
  form.append(errBox);

  for (const f of fields) {
    const id = `f_${f.name}`;
    let input;
    if (f.type === 'select') {
      input = el('select', { id });
      for (const [val, label] of f.options) {
        input.append(el('option', { value: val, textContent: label, selected: val === f.value }));
      }
    } else if (f.type === 'textarea') {
      input = el('textarea', { id, value: f.value ?? '' });
    } else {
      input = el('input', { id, type: f.type ?? 'text', value: f.value ?? '' });
      if (f.dir) input.dir = f.dir;
      if (f.step) input.step = f.step;
    }
    inputs[f.name] = input;
    form.append(el('div', { className: 'field' }, el('label', { htmlFor: id, textContent: f.label }), input));
  }

  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary', textContent: submitLabel });
  form.append(el('div', { className: 'modal-actions' },
    submitBtn,
    el('button', {
      type: 'button', className: 'btn btn-ghost', textContent: 'إلغاء',
      onclick: () => root.replaceChildren(),
    })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    errBox.hidden = true;
    const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
    try {
      await onSubmit(values);
      root.replaceChildren();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
      submitBtn.disabled = false;
    }
  });

  const backdrop = el('div', { className: 'modal-backdrop' }, form);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) root.replaceChildren(); });
  root.replaceChildren(backdrop);
  form.querySelector('input, select, textarea')?.focus();
}

function confirmAction(message, onYes) {
  modal(message, [], onYes, 'أيوه، نفّذ');
}

// ---------- نظرة عامة ----------

async function renderOverview() {
  const [stats, trend] = await Promise.all([api('/stats'), api('/stats/reservations-trend')]);
  state.stats = stats;
  buildNav();

  const kpi = (label, value, hint, cls = '') =>
    el('div', { className: 'kpi' },
      el('div', { className: 'label', textContent: label }),
      el('div', { className: `value ${cls}`, textContent: value }),
      hint ? el('div', { className: 'hint', textContent: hint }) : null);

  const maxTrend = Math.max(1, ...trend.map((d) => Number(d.total)));
  const chart = el('div', {
    style: 'display:flex;align-items:flex-end;gap:6px;height:120px;padding:18px;',
  });
  for (const d of trend) {
    const h = Math.round((Number(d.total) / maxTrend) * 100);
    chart.append(el('div', {
      title: `${new Date(d.day).toLocaleDateString('ar-EG')}: ${d.total} حجز`,
      style: `flex:1;min-width:12px;height:${Math.max(3, h)}%;border-radius:4px 4px 0 0;`
           + `background:${Number(d.total) ? 'var(--lime)' : 'rgba(255,255,255,.07)'};`,
    }));
  }

  $('#page').replaceChildren(
    pageHead('نظرة عامة', `${state.user.restaurant.name} — آخر تحديث ${new Date().toLocaleTimeString('ar-EG')}`,
      el('button', { className: 'btn btn-ghost btn-sm', textContent: 'تحديث', onclick: () => go('overview') })),

    el('div', { className: 'kpis' },
      kpi('حجوزات النهاردة', stats.reservations_today ?? 0, null,
          Number(stats.reservations_today) ? 'good' : ''),
      kpi('حجوزات مستنية تأكيد', stats.reservations_pending ?? 0, 'محتاجة تأكيد',
          Number(stats.reservations_pending) ? 'alert' : ''),
      kpi('شكاوى مفتوحة', stats.complaints_open ?? 0,
          `${stats.complaints_high ?? 0} عالية الأولوية`,
          Number(stats.complaints_open) ? 'alert' : ''),
      kpi('محادثات مع موظف', stats.conversations_human ?? 0,
          `${stats.conversations_ai ?? 0} مع البوت`),
      kpi('أصناف موقوفة', stats.menu_items_unavailable ?? 0,
          `من ${stats.menu_items_total ?? 0} صنف`,
          Number(stats.menu_items_unavailable) ? 'alert' : ''),
      kpi('العملاء', stats.customers_total ?? 0, `${stats.customers_vip ?? 0} عميل VIP`),
      kpi('تعليمات فعّالة', stats.overrides_active ?? 0, 'البوت شغال بيها'),
      kpi('تكلفة البوت النهاردة', `$${Number(stats.ai_cost_today ?? 0).toFixed(3)}`, 'دولار'),
    ),

    panel('حجوزات آخر 14 يوم', chart),
  );
}

// ---------- الحجوزات ----------

let reservationFilter = { status: '', branchId: '' };

async function renderReservations() {
  const params = new URLSearchParams();
  if (reservationFilter.status) params.set('status', reservationFilter.status);
  if (reservationFilter.branchId) params.set('branchId', reservationFilter.branchId);

  const [data, branchData] = await Promise.all([
    api(`/reservations?${params}`),
    api('/branches'),
  ]);
  state.cache.branches = branchData.items;

  const rows = data.items.map((r) => el('tr', {},
    el('td', {}, el('div', { textContent: dateTime(r.reservation_time) }),
                 el('div', { style: 'font-size:12px;color:var(--muted)', textContent: T.source[r.source] ?? r.source })),
    el('td', {}, el('div', { textContent: r.customer_name || 'بدون اسم' }),
                 el('div', { style: 'font-size:12px;color:var(--muted);direction:ltr;text-align:start', textContent: r.customer_phone })),
    el('td', { className: 'num' }, String(r.guests)),
    el('td', {}, r.branch_name),
    el('td', {}, tag(r.status)),
    el('td', {}, el('div', { className: 'cell-actions' },
      r.status !== 'confirmed' ? el('button', {
        className: 'btn btn-primary btn-sm', textContent: 'تأكيد',
        onclick: () => setReservation(r.id, 'confirmed'),
      }) : null,
      r.status !== 'cancelled' ? el('button', {
        className: 'btn btn-danger btn-sm', textContent: 'إلغاء',
        onclick: () => setReservation(r.id, 'cancelled'),
      }) : null,
    )),
  ));

  const branchOptions = [['', 'كل الفروع'], ...branchData.items.map((b) => [b.id, b.name])];

  $('#page').replaceChildren(
    pageHead('الحجوزات', `${data.total} حجز`,
      select([['', 'كل الحالات'], ['pending', 'قيد الانتظار'], ['confirmed', 'مؤكد'], ['cancelled', 'ملغي']],
        reservationFilter.status, (v) => { reservationFilter.status = v; go('reservations'); }),
      select(branchOptions, reservationFilter.branchId,
        (v) => { reservationFilter.branchId = v; go('reservations'); }),
      el('button', { className: 'btn btn-primary btn-sm', textContent: '+ حجز جديد', onclick: newReservation })),
    panel('الحجوزات',
      table(['الوقت', 'العميل', 'الأفراد', 'الفرع', 'الحالة', ''], rows, 'مفيش حجوزات بالفلاتر دي.')),
  );
}

async function setReservation(id, status) {
  try {
    await api(`/reservations/${id}`, { method: 'PATCH', body: { status } });
    toast(status === 'confirmed' ? 'تم تأكيد الحجز.' : 'تم إلغاء الحجز.');
    await refreshStats();
    go('reservations');
  } catch (err) { toast(err.message, 'error'); }
}

function newReservation() {
  const branches = state.cache.branches ?? [];
  if (!branches.length) return toast('لازم تضيف فرع الأول.', 'error');

  modal('حجز جديد', [
    { name: 'branchId', label: 'الفرع', type: 'select', options: branches.map((b) => [b.id, b.name]) },
    { name: 'customerPhone', label: 'رقم العميل', dir: 'ltr', value: '+20' },
    { name: 'customerName', label: 'اسم العميل (اختياري)' },
    { name: 'reservationTime', label: 'وقت الحجز', type: 'datetime-local' },
    { name: 'guests', label: 'عدد الأفراد', type: 'number', value: '2' },
    { name: 'notes', label: 'ملاحظات (اختياري)', type: 'textarea' },
  ], async (v) => {
    await api('/reservations', {
      method: 'POST',
      body: {
        branchId: v.branchId,
        customerPhone: v.customerPhone,
        customerName: v.customerName || undefined,
        reservationTime: new Date(v.reservationTime).toISOString(),
        guests: Number(v.guests),
        source: 'manual',
        status: 'confirmed',
        notes: v.notes || undefined,
      },
    });
    toast('تم تسجيل الحجز.');
    await refreshStats();
    go('reservations');
  }, 'احجز');
}

// ---------- الشكاوى ----------

let complaintFilter = { status: '' };

async function renderComplaints() {
  const params = new URLSearchParams();
  if (complaintFilter.status) params.set('status', complaintFilter.status);
  const data = await api(`/complaints?${params}`);

  const rows = data.items.map((c) => el('tr', {},
    el('td', {}, tag(c.priority, T.priority)),
    el('td', {}, el('div', { textContent: c.summary })),
    el('td', {}, el('div', { textContent: c.customer_name || 'بدون اسم' }),
                 el('div', { style: 'font-size:12px;color:var(--muted);direction:ltr;text-align:start', textContent: c.customer_phone })),
    el('td', {}, el('div', { textContent: relative(c.created_at) }),
                 el('div', { style: 'font-size:12px;color:var(--muted)', textContent: c.branch_name ?? '' })),
    el('td', {}, tag(c.status)),
    el('td', {}, el('div', { className: 'cell-actions' },
      c.status === 'new' ? el('button', {
        className: 'btn btn-ghost btn-sm', textContent: 'ابدأ الحل',
        onclick: () => setComplaint(c.id, { status: 'in_progress' }),
      }) : null,
      c.status !== 'resolved' ? el('button', {
        className: 'btn btn-primary btn-sm', textContent: 'تم الحل',
        onclick: () => setComplaint(c.id, { status: 'resolved' }),
      }) : null,
    )),
  ));

  $('#page').replaceChildren(
    pageHead('الشكاوى', `${data.total} شكوى — الأهم فوق`,
      select([['', 'الكل'], ['new', 'جديدة'], ['in_progress', 'جاري الحل'], ['resolved', 'تم الحل']],
        complaintFilter.status, (v) => { complaintFilter.status = v; go('complaints'); })),
    panel('الشكاوى',
      table(['الأولوية', 'الشكوى', 'العميل', 'من إمتى', 'الحالة', ''], rows, 'مفيش شكاوى — تمام كده. ✅')),
  );
}

async function setComplaint(id, body) {
  try {
    await api(`/complaints/${id}`, { method: 'PATCH', body });
    toast('تم تحديث الشكوى.');
    await refreshStats();
    go('complaints');
  } catch (err) { toast(err.message, 'error'); }
}

// ---------- المحادثات ----------

async function renderConversations() {
  const data = await api('/conversations');

  const rows = data.items.map((c) => el('tr', {},
    el('td', {}, el('div', { textContent: c.customer_name || 'بدون اسم' }),
                 el('div', { style: 'font-size:12px;color:var(--muted);direction:ltr;text-align:start', textContent: c.customer_phone })),
    el('td', {}, el('div', {
      style: 'max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)',
      textContent: c.last_message ?? '—',
    })),
    el('td', {}, T.channel[c.channel] ?? c.channel),
    el('td', {}, relative(c.last_message_at)),
    el('td', {}, tag(c.status)),
    el('td', {}, el('div', { className: 'cell-actions' },
      el('button', { className: 'btn btn-ghost btn-sm', textContent: 'افتح', onclick: () => openConversation(c) }),
    )),
  ));

  $('#page').replaceChildren(
    pageHead('المحادثات', `${data.total} محادثة`),
    panel('المحادثات',
      table(['العميل', 'آخر رسالة', 'القناة', 'آخر نشاط', 'الحالة', ''], rows, 'مفيش محادثات لسه.')),
  );
}

async function openConversation(conv) {
  const { items } = await api(`/conversations/${conv.id}/messages`);

  const chat = el('div', { className: 'chat' });
  if (!items.length) {
    chat.append(el('div', { className: 'empty', textContent: 'مفيش رسائل في المحادثة دي.' }));
  }
  for (const m of items) {
    chat.append(el('div', { className: `bubble ${m.direction === 'inbound' ? 'in' : 'out'}` },
      el('div', { textContent: m.body ?? `[${m.message_type}]` }),
      el('div', { className: 'meta', textContent: `${m.sender === 'customer' ? 'العميل' : m.sender === 'ai' ? 'البوت' : 'موظف'} · ${dateTime(m.created_at)}` })));
  }

  const input = el('input', { placeholder: 'اكتب ردك...', style: 'flex:1' });
  const sendBar = el('form', {
    style: 'display:flex;gap:8px;padding:14px 18px;border-top:1px solid var(--line)',
  }, input, el('button', { type: 'submit', className: 'btn btn-primary btn-sm', textContent: 'سجّل الرد' }));

  sendBar.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    try {
      await api(`/conversations/${conv.id}/messages`, { method: 'POST', body: { body: input.value } });
      input.value = '';
      toast('اتسجّل الرد في المحادثة.');
      openConversation(conv);
    } catch (err) { toast(err.message, 'error'); }
  });

  $('#page').replaceChildren(
    pageHead(conv.customer_name || conv.customer_phone, `${T.channel[conv.channel]} — ${T.status[conv.status]}`,
      el('button', { className: 'btn btn-ghost btn-sm', textContent: '→ رجوع', onclick: () => go('conversations') }),
      conv.status === 'ai' ? el('button', {
        className: 'btn btn-primary btn-sm', textContent: 'استلم المحادثة',
        onclick: () => convAction(conv.id, 'takeover'),
      }) : null,
      conv.status === 'human' ? el('button', {
        className: 'btn btn-ghost btn-sm', textContent: 'رجّعها للبوت',
        onclick: () => convAction(conv.id, 'handback'),
      }) : null,
      conv.status !== 'closed' ? el('button', {
        className: 'btn btn-danger btn-sm', textContent: 'اقفل',
        onclick: () => convAction(conv.id, 'close'),
      }) : null),
    el('div', { className: 'panel' }, chat, conv.status !== 'closed' ? sendBar : null),
    el('div', { style: 'color:var(--muted);font-size:12.5px' },
      'ملاحظة: الردود بتتسجّل في قاعدة البيانات. الإرسال الفعلي على واتساب بيتم لما تربط WhatsApp Cloud API.'),
  );
}

async function convAction(id, action) {
  try {
    await api(`/conversations/${id}/${action}`, { method: 'POST' });
    toast('تم.');
    await refreshStats();
    go('conversations');
  } catch (err) { toast(err.message, 'error'); }
}

// ---------- المنيو ----------

const openCategories = new Set();

async function renderMenu() {
  const { categories } = await api('/menu');
  const container = el('div');

  for (const cat of categories) {
    const key = cat.id ?? 'none';
    const isOpen = openCategories.has(key);
    const offCount = cat.items.filter((i) => !i.available).length;

    const head = el('div', { className: 'menu-cat-head', onclick: () => {
      isOpen ? openCategories.delete(key) : openCategories.add(key);
      renderMenu();
    } },
      el('div', {}, el('h4', { textContent: `${isOpen ? '▾' : '◂'} ${cat.name}` })),
      el('div', { className: 'filters' },
        offCount ? el('span', { className: 'tag tag-danger', textContent: `${offCount} موقوف` }) : null,
        el('span', { className: 'count', textContent: `${cat.items.length} صنف` })));

    const box = el('div', { className: 'menu-cat' }, head);

    if (isOpen) {
      const items = el('div', { className: 'menu-items' });
      for (const item of cat.items) {
        const toggle = el('input', { type: 'checkbox', checked: item.available });
        toggle.addEventListener('change', () => toggleItem(item, toggle.checked));

        items.append(el('div', { className: `menu-item${item.available ? '' : ' off'}` },
          el('label', { className: 'switch' }, toggle, el('span', { className: 'slider' })),
          el('div', { className: 'name' },
            el('div', { textContent: item.name }),
            !item.available && item.unavailableReason
              ? el('div', { className: 'reason', style: 'font-size:11.5px;color:var(--muted)',
                            textContent: `السبب: ${T.reason[item.unavailableReason] ?? item.unavailableReason}` })
              : null),
          el('div', { className: 'price', textContent: money(item.price) }),
          canManage() ? el('button', {
            className: 'btn btn-ghost btn-sm', textContent: 'تعديل',
            onclick: () => editItem(item),
          }) : null));

        if (item.variants?.length) {
          items.append(el('div', { className: 'variants',
            textContent: item.variants.map((v) => `${v.label}: ${money(v.price)}`).join('  •  ') }));
        }
      }
      if (!cat.items.length) items.append(el('div', { className: 'empty', textContent: 'القسم فاضي.' }));
      box.append(items);
    }

    container.append(box);
  }

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  const totalOff = categories.reduce((n, c) => n + c.items.filter((i) => !i.available).length, 0);

  $('#page').replaceChildren(
    pageHead('المنيو', `${totalItems} صنف · ${totalOff} موقوف دلوقتي`,
      el('button', {
        className: 'btn btn-ghost btn-sm',
        textContent: openCategories.size ? 'اقفل الكل' : 'افتح الكل',
        onclick: () => {
          if (openCategories.size) openCategories.clear();
          else categories.forEach((c) => openCategories.add(c.id ?? 'none'));
          renderMenu();
        },
      }),
      canManage() ? el('button', { className: 'btn btn-primary btn-sm', textContent: '+ صنف', onclick: () => newItem(categories) }) : null),
    container,
  );
}

async function toggleItem(item, available) {
  try {
    await api(`/menu/items/${item.id}/availability`, {
      method: 'PATCH',
      body: available ? { available: true } : { available: false, reason: 'kitchen' },
    });
    toast(available ? `${item.name} رجع متاح.` : `${item.name} اتوقف.`);
    await refreshStats();
    renderMenu();
  } catch (err) {
    toast(err.message, 'error');
    renderMenu();
  }
}

function editItem(item) {
  modal(`تعديل: ${item.name}`, [
    { name: 'name', label: 'اسم الصنف', value: item.name },
    { name: 'price', label: 'السعر', type: 'number', step: '0.01', value: String(item.price) },
  ], async (v) => {
    await api(`/menu/items/${item.id}`, {
      method: 'PATCH', body: { name: v.name, price: Number(v.price) },
    });
    toast('تم التعديل.');
    renderMenu();
  });
}

function newItem(categories) {
  const options = categories.filter((c) => c.id).map((c) => [c.id, c.name]);
  modal('صنف جديد', [
    { name: 'name', label: 'اسم الصنف' },
    { name: 'price', label: 'السعر', type: 'number', step: '0.01', value: '0' },
    { name: 'categoryId', label: 'القسم', type: 'select', options },
  ], async (v) => {
    await api('/menu/items', {
      method: 'POST', body: { name: v.name, price: Number(v.price), categoryId: v.categoryId },
    });
    toast('تمت الإضافة.');
    await refreshStats();
    renderMenu();
  }, 'أضف');
}

// ---------- العملاء ----------

let customerSearch = '';

async function renderCustomers() {
  const params = new URLSearchParams();
  if (customerSearch) params.set('search', customerSearch);
  const data = await api(`/customers?${params}`);

  const rows = data.items.map((c) => el('tr', {},
    el('td', {}, c.name || 'بدون اسم'),
    el('td', { style: 'direction:ltr;text-align:start' }, c.phone),
    el('td', {}, tag(c.classification, T.classification)),
    el('td', { className: 'num' }, String(c.reservations_count)),
    el('td', { className: 'num' }, String(c.complaints_count)),
    el('td', {}, relative(c.last_visit_at)),
    el('td', {}, el('button', {
      className: 'btn btn-ghost btn-sm', textContent: 'تعديل', onclick: () => editCustomer(c),
    })),
  ));

  const searchInput = el('input', { placeholder: 'ابحث باسم أو رقم...', value: customerSearch });
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { customerSearch = searchInput.value; go('customers'); }, 350);
  });

  $('#page').replaceChildren(
    pageHead('العملاء', `${data.total} عميل`,
      searchInput,
      el('button', { className: 'btn btn-primary btn-sm', textContent: '+ عميل', onclick: newCustomer })),
    panel('العملاء',
      table(['الاسم', 'الرقم', 'التصنيف', 'حجوزات', 'شكاوى', 'آخر زيارة', ''], rows, 'مفيش عملاء بالبحث ده.')),
  );
}

function editCustomer(c) {
  modal(`تعديل: ${c.name || c.phone}`, [
    { name: 'name', label: 'الاسم', value: c.name ?? '' },
    { name: 'classification', label: 'التصنيف', type: 'select',
      options: [['new', 'جديد'], ['repeat', 'متكرر'], ['vip', 'VIP']], value: c.classification },
    { name: 'favoriteItem', label: 'الصنف المفضّل', value: c.favorite_item ?? '' },
  ], async (v) => {
    await api(`/customers/${c.id}`, {
      method: 'PATCH',
      body: { name: v.name || null, classification: v.classification, favoriteItem: v.favoriteItem || null },
    });
    toast('تم التعديل.');
    go('customers');
  });
}

function newCustomer() {
  modal('عميل جديد', [
    { name: 'phone', label: 'رقم التليفون', dir: 'ltr', value: '+20' },
    { name: 'name', label: 'الاسم (اختياري)' },
    { name: 'classification', label: 'التصنيف', type: 'select',
      options: [['new', 'جديد'], ['repeat', 'متكرر'], ['vip', 'VIP']] },
  ], async (v) => {
    await api('/customers', {
      method: 'POST',
      body: { phone: v.phone, name: v.name || undefined, classification: v.classification },
    });
    toast('تمت الإضافة.');
    await refreshStats();
    go('customers');
  }, 'أضف');
}

// ---------- تعليمات طارئة ----------

async function renderOverrides() {
  const data = await api('/overrides?all=true');

  const rows = data.items.map((o) => el('tr', {},
    el('td', {}, el('span', { className: 'tag tag-lime', textContent: T.category[o.category] ?? o.category })),
    el('td', {}, o.text),
    el('td', {}, el('div', { textContent: relative(o.created_at) }),
                 el('div', { style: 'font-size:12px;color:var(--muted);direction:ltr;text-align:start', textContent: o.added_by ?? '' })),
    el('td', {}, o.active
      ? el('span', { className: 'tag tag-ok', textContent: 'فعّالة' })
      : el('span', { className: 'tag tag-muted', textContent: 'ملغاة' })),
    el('td', {}, o.active ? el('button', {
      className: 'btn btn-danger btn-sm', textContent: 'إلغاء',
      onclick: () => cancelOverride(o.id),
    }) : null),
  ));

  $('#page').replaceChildren(
    pageHead('تعليمات طارئة للبوت',
      'اكتب هنا أي حاجة لازم البوت يقولها للعملاء فورًا — صنف خلص، الفرع مقفول، عرض جديد.',
      el('button', { className: 'btn btn-primary btn-sm', textContent: '+ تعليمة', onclick: newOverride })),
    panel('التعليمات',
      table(['النوع', 'النص', 'اتضافت', 'الحالة', ''], rows, 'مفيش تعليمات — البوت شغال بالمعرفة الأساسية.')),
  );
}

function newOverride() {
  modal('تعليمة طارئة', [
    { name: 'category', label: 'النوع', type: 'select', options: [
      ['stock_outage', 'نفاد صنف'], ['closure', 'إغلاق'], ['promo', 'عرض'],
      ['price_change', 'تغيير سعر'], ['general', 'عام'],
    ] },
    { name: 'text', label: 'النص اللي البوت هيقوله', type: 'textarea' },
  ], async (v) => {
    await api('/overrides', { method: 'POST', body: { category: v.category, text: v.text } });
    toast('التعليمة اتفعّلت.');
    await refreshStats();
    go('overrides');
  }, 'فعّل');
}

async function cancelOverride(id) {
  try {
    await api(`/overrides/${id}/cancel`, { method: 'POST' });
    toast('تم الإلغاء.');
    await refreshStats();
    go('overrides');
  } catch (err) { toast(err.message, 'error'); }
}

// ---------- معرفة البوت ----------

async function renderKb() {
  const data = await api('/kb');

  const rows = data.items.map((k) => el('tr', {},
    el('td', {}, el('strong', { textContent: k.topic })),
    el('td', {}, el('div', { style: 'color:var(--muted);max-width:520px', textContent: k.content })),
    el('td', {}, relative(k.updated_at)),
    el('td', {}, el('div', { className: 'cell-actions' },
      el('button', { className: 'btn btn-ghost btn-sm', textContent: 'تعديل', onclick: () => editKb(k) }),
      el('button', { className: 'btn btn-danger btn-sm', textContent: 'حذف', onclick: () => deleteKb(k) }))),
  ));

  $('#page').replaceChildren(
    pageHead('معرفة البوت', 'المعلومات اللي البوت بيرد بيها على العملاء.',
      el('button', { className: 'btn btn-primary btn-sm', textContent: '+ معلومة', onclick: newKb })),
    panel('المعرفة', table(['الموضوع', 'المحتوى', 'آخر تحديث', ''], rows, 'مفيش معلومات لسه.')),
  );
}

function newKb() {
  modal('معلومة جديدة', [
    { name: 'topic', label: 'الموضوع (مثال: مواعيد العمل)' },
    { name: 'content', label: 'المحتوى', type: 'textarea' },
  ], async (v) => {
    await api('/kb', { method: 'POST', body: { topic: v.topic, content: v.content } });
    toast('تمت الإضافة.');
    go('kb');
  }, 'أضف');
}

function editKb(k) {
  modal('تعديل المعلومة', [
    { name: 'topic', label: 'الموضوع', value: k.topic },
    { name: 'content', label: 'المحتوى', type: 'textarea', value: k.content },
  ], async (v) => {
    await api(`/kb/${k.id}`, { method: 'PATCH', body: { topic: v.topic, content: v.content } });
    toast('تم التعديل.');
    go('kb');
  });
}

function deleteKb(k) {
  confirmAction(`تحذف "${k.topic}"؟`, async () => {
    await api(`/kb/${k.id}`, { method: 'DELETE' });
    toast('تم الحذف.');
    go('kb');
  });
}

// ---------- الإعدادات ----------

async function renderSettings() {
  const [restaurant, branches, users, audit] = await Promise.all([
    api('/restaurant'),
    api('/branches'),
    canManage() ? api('/users') : Promise.resolve({ items: [] }),
    canManage() ? api('/audit') : Promise.resolve({ items: [] }),
  ]);

  const branchRows = branches.items.map((b) => el('tr', {},
    el('td', {}, b.name),
    el('td', {}, b.address ?? '—'),
    el('td', { className: 'num' }, String(b.upcoming_reservations)),
    el('td', {}, b.active
      ? el('span', { className: 'tag tag-ok', textContent: 'مفتوح' })
      : el('span', { className: 'tag tag-muted', textContent: 'مقفول' })),
    el('td', {}, isOwner() ? el('button', {
      className: 'btn btn-ghost btn-sm', textContent: 'تعديل', onclick: () => editBranch(b),
    }) : null),
  ));

  const userRows = users.items.map((u) => el('tr', {},
    el('td', {}, u.name),
    el('td', { style: 'direction:ltr;text-align:start' }, u.email),
    el('td', {}, el('span', { className: 'tag tag-lime', textContent: T.role[u.role] ?? u.role })),
    el('td', {}, u.active
      ? el('span', { className: 'tag tag-ok', textContent: 'نشط' })
      : el('span', { className: 'tag tag-muted', textContent: 'موقوف' })),
    el('td', {}, relative(u.last_login_at)),
    el('td', {}, isOwner() ? el('button', {
      className: 'btn btn-ghost btn-sm', textContent: 'تعديل', onclick: () => editUser(u),
    }) : null),
  ));

  const auditRows = audit.items.slice(0, 40).map((a) => el('tr', {},
    el('td', { style: 'direction:ltr;text-align:start;font-size:12.5px' }, a.action),
    el('td', { style: 'direction:ltr;text-align:start;font-size:12.5px;color:var(--muted)' }, a.actor),
    el('td', {}, dateTime(a.created_at)),
  ));

  const page = el('div', {},
    pageHead('الإعدادات', restaurant.name),

    panel('بيانات المطعم',
      el('div', { style: 'padding:18px;display:grid;gap:10px;font-size:14px' },
        el('div', {}, `الاسم: ${restaurant.name}`),
        el('div', {}, `العملة: ${restaurant.currency}`),
        el('div', {}, `المنطقة الزمنية: ${restaurant.timezone}`),
        el('div', {},
          'واتساب: ',
          restaurant.whatsapp_connected
            ? el('span', { className: 'tag tag-ok', textContent: 'متصل' })
            : el('span', { className: 'tag tag-warn', textContent: 'مش متصل' })),
      ),
      isOwner() ? el('button', {
        className: 'btn btn-ghost btn-sm', textContent: 'تعديل',
        onclick: () => editRestaurant(restaurant),
      }) : null),

    panel('الفروع',
      table(['الاسم', 'العنوان', 'حجوزات قادمة', 'الحالة', ''], branchRows, 'مفيش فروع.'),
      isOwner() ? el('button', { className: 'btn btn-primary btn-sm', textContent: '+ فرع', onclick: newBranch }) : null),
  );

  if (canManage()) {
    page.append(
      panel('فريق العمل',
        table(['الاسم', 'البريد', 'الدور', 'الحالة', 'آخر دخول', ''], userRows, 'مفيش مستخدمين.'),
        isOwner() ? el('button', { className: 'btn btn-primary btn-sm', textContent: '+ مستخدم', onclick: newUser }) : null),
      panel('سجل العمليات',
        table(['العملية', 'المستخدم', 'الوقت'], auditRows, 'مفيش عمليات مسجّلة.')),
    );
  }

  $('#page').replaceChildren(page);
}

function editRestaurant(r) {
  modal('بيانات المطعم', [
    { name: 'name', label: 'اسم المطعم', value: r.name },
    { name: 'currency', label: 'العملة', type: 'select',
      options: [['EGP', 'جنيه مصري'], ['SAR', 'ريال سعودي'], ['AED', 'درهم إماراتي']], value: r.currency },
    { name: 'timezone', label: 'المنطقة الزمنية', type: 'select', value: r.timezone,
      options: [['Africa/Cairo', 'القاهرة'], ['Asia/Riyadh', 'الرياض'], ['Asia/Dubai', 'دبي']] },
  ], async (v) => {
    await api('/restaurant', { method: 'PATCH', body: v });
    state.user.restaurant = { ...state.user.restaurant, ...v };
    $('#rest-name').textContent = v.name;
    toast('تم الحفظ.');
    go('settings');
  });
}

function newBranch() {
  modal('فرع جديد', [
    { name: 'name', label: 'اسم الفرع' },
    { name: 'address', label: 'العنوان' },
  ], async (v) => {
    await api('/branches', { method: 'POST', body: { name: v.name, address: v.address || undefined } });
    toast('تمت إضافة الفرع.');
    go('settings');
  }, 'أضف');
}

function editBranch(b) {
  modal(`تعديل: ${b.name}`, [
    { name: 'name', label: 'اسم الفرع', value: b.name },
    { name: 'address', label: 'العنوان', value: b.address ?? '' },
    { name: 'active', label: 'الحالة', type: 'select',
      options: [['true', 'مفتوح'], ['false', 'مقفول']], value: String(b.active) },
  ], async (v) => {
    await api(`/branches/${b.id}`, {
      method: 'PATCH', body: { name: v.name, address: v.address || null, active: v.active === 'true' },
    });
    toast('تم الحفظ.');
    go('settings');
  });
}

function newUser() {
  modal('مستخدم جديد', [
    { name: 'name', label: 'الاسم' },
    { name: 'email', label: 'البريد الإلكتروني', type: 'email', dir: 'ltr' },
    { name: 'password', label: 'كلمة المرور (8 أحرف على الأقل)', type: 'password', dir: 'ltr' },
    { name: 'role', label: 'الدور', type: 'select',
      options: [['staff', 'موظف'], ['manager', 'مدير'], ['owner', 'مالك']] },
  ], async (v) => {
    await api('/users', { method: 'POST', body: v });
    toast('تمت إضافة المستخدم.');
    go('settings');
  }, 'أضف');
}

function editUser(u) {
  modal(`تعديل: ${u.name}`, [
    { name: 'name', label: 'الاسم', value: u.name },
    { name: 'role', label: 'الدور', type: 'select',
      options: [['staff', 'موظف'], ['manager', 'مدير'], ['owner', 'مالك']], value: u.role },
    { name: 'active', label: 'الحالة', type: 'select',
      options: [['true', 'نشط'], ['false', 'موقوف']], value: String(u.active) },
    { name: 'password', label: 'كلمة مرور جديدة (سيبها فاضية لو مش عايز تغيّرها)', type: 'password', dir: 'ltr' },
  ], async (v) => {
    const body = { name: v.name, role: v.role, active: v.active === 'true' };
    if (v.password) body.password = v.password;
    await api(`/users/${u.id}`, { method: 'PATCH', body });
    toast('تم الحفظ.');
    go('settings');
  });
}

// ---------- البداية ----------

(async function boot() {
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    startApp();
  } catch {
    showLogin();
  }
})();
