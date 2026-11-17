// Every page and state the audit visits. Each state says how to reach it like a user would.
import { CLOSED, readJSON } from './lib.mjs'

const fixture = () => readJSON('results/fixture-storage.json')
const ids = () => readJSON('results/fixture-orders.json')

async function addItem(p, item = 'صدور فراخ', size = /^ربع/) {
  await p.getByRole('button', { name: `أضف ${item}`, exact: true }).click()
  const sheet = p.getByRole('dialog', { name: item })
  await sheet.waitFor()
  if (size) await sheet.getByRole('radio', { name: size }).click()
  await sheet.getByRole('button', { name: /^أضف للسلة/ }).click()
  await sheet.waitFor({ state: 'hidden' })
}
async function toCheckout(p, branch = 'tagamoa') {
  await p.goto(`/branch/${branch}`)
  await addItem(p)
  await p.getByRole('button', { name: /عرض السلة/ }).click()
  await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await p.getByRole('heading', { level: 1, name: 'إتمام الطلب' }).waitFor()
}
const settle = (p, ms = 500) => p.waitForTimeout(ms)

export const STATES = [
  // ---- home
  { id: 'home', page: 'الرئيسية', title: 'الرئيسية: الفروع مفتوحة', url: '/' },
  { id: 'home-closed', page: 'الرئيسية', title: 'الرئيسية: الفروع مغلقة (9 صباحاً)', url: '/', clock: CLOSED },
  { id: 'home-last-order', page: 'الرئيسية', title: 'الرئيسية: شريط «طلبك الحالي»', url: '/', storage: fixture },
  // ---- menu
  { id: 'menu-ashry', page: 'المنيو', title: 'منيو العاشر من أعلى', url: '/branch/ashry', full: true },
  { id: 'menu-tagamoa', page: 'المنيو', title: 'منيو التجمع (فيه أصناف الحجز المسبق)', url: '/branch/tagamoa' },
  { id: 'menu-zagazig', page: 'المنيو', title: 'منيو الزقازيق', url: '/branch/zagazig' },
  { id: 'menu-scrolled', page: 'المنيو', title: 'المنيو بعد التمرير (الهيدر المصغّر)', url: '/branch/ashry', act: async (p) => { await p.mouse.wheel(0, 1600); await settle(p, 700) } },
  { id: 'menu-search', page: 'المنيو', title: 'بحث «كفته» في المنيو', url: '/branch/ashry', act: async (p) => { await p.getByRole('searchbox').fill('كفته'); await settle(p) } },
  { id: 'menu-search-empty', page: 'المنيو', title: 'بحث بلا نتائج', url: '/branch/ashry', act: async (p) => { await p.getByRole('searchbox').fill('بيتزا'); await settle(p) } },
  { id: 'menu-closed', page: 'المنيو', title: 'المنيو والفرع مغلق', url: '/branch/ashry', clock: CLOSED },
  { id: 'menu-cart-bar', page: 'المنيو', title: 'المنيو بعد إضافة صنف (شريط السلة)', url: '/branch/ashry', act: async (p) => { await addItem(p); await settle(p, 900) } },
  { id: 'item-sheet', page: 'نافذة الصنف', title: 'نافذة صنف بأحجام', url: '/branch/ashry', act: async (p) => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await settle(p, 600) } },
  { id: 'item-sheet-note', page: 'نافذة الصنف', title: 'نافذة الصنف وحقل الملاحظة مفتوح', url: '/branch/ashry', act: async (p) => { await p.getByRole('button', { name: 'أضف صدور فراخ', exact: true }).click(); await p.getByRole('button', { name: /أضف ملاحظة/ }).click(); await settle(p, 600) } },
  { id: 'item-sheet-single', page: 'نافذة الصنف', title: 'نافذة صنف بحجم واحد', url: '/branch/ashry', act: async (p) => { await p.getByRole('link', { name: 'المشروبات' }).first().click(); await settle(p, 900); await p.getByRole('button', { name: 'أضف شاي', exact: true }).click(); await settle(p, 600) } },
  { id: 'cart', page: 'السلة', title: 'السلة وفيها صنفان', url: '/branch/ashry', act: async (p) => { await addItem(p); await addItem(p, 'كفتة فراخ'); await p.getByRole('button', { name: /عرض السلة/ }).click(); await settle(p, 600) } },
  { id: 'cart-closed', page: 'السلة', title: 'السلة والفرع مغلق', url: '/branch/ashry', clock: CLOSED, act: async (p) => { await addItem(p); await p.getByRole('button', { name: /عرض السلة/ }).click(); await settle(p, 600) } },
  // ---- checkout
  { id: 'checkout-empty', page: 'إتمام الطلب', title: 'إتمام الطلب والسلة فارغة', url: '/branch/ashry/checkout' },
  { id: 'checkout-delivery', page: 'إتمام الطلب', title: 'إتمام الطلب: توصيل (التجمع، ضريبة)', url: '/', act: async (p) => toCheckout(p), full: true },
  { id: 'checkout-errors', page: 'إتمام الطلب', title: 'إتمام الطلب: أخطاء الحقول الفارغة', url: '/', act: async (p) => { await toCheckout(p); await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await settle(p) }, full: true },
  { id: 'checkout-zone-list', page: 'إتمام الطلب', title: 'إتمام الطلب: قائمة المناطق مفتوحة', url: '/', act: async (p) => { await toCheckout(p); await p.getByRole('combobox', { name: 'المنطقة' }).fill('ال'); await settle(p, 600) } },
  { id: 'checkout-filled', page: 'إتمام الطلب', title: 'إتمام الطلب: البيانات مكتملة', url: '/', act: async (p) => { await toCheckout(p); await p.getByLabel('الاسم').fill('سارة'); await p.getByLabel('رقم الموبايل').fill('01098765432'); await p.getByRole('combobox', { name: 'المنطقة' }).fill('اللوتس'); await p.getByRole('option').first().click(); await p.getByLabel('الشارع').fill('شارع التسعين'); await p.getByLabel('رقم العمارة').fill('12'); await settle(p) }, full: true },
  { id: 'checkout-pickup', page: 'إتمام الطلب', title: 'إتمام الطلب: استلام من الفرع', url: '/', act: async (p) => { await toCheckout(p, 'ashry'); await p.getByRole('radio', { name: 'استلام من الفرع' }).click(); await settle(p) } },
  { id: 'checkout-closed', page: 'إتمام الطلب', title: 'إتمام الطلب والفرع مغلق (من رابط مباشر؛ زر السلة معطّل)', url: '/branch/ashry', clock: CLOSED, act: async (p) => { await addItem(p); await p.goto('/branch/ashry/checkout'); await p.getByRole('heading', { level: 1, name: 'إتمام الطلب' }).waitFor() } },
  // ---- order and tracking
  { id: 'order-placed', page: 'صفحة الطلب', title: 'تأكيد الطلب بعد الإرسال', url: '/', act: async (p) => { await toCheckout(p, 'ashry'); await p.getByRole('radio', { name: 'استلام من الفرع' }).click(); await p.getByLabel('الاسم').fill('سارة'); await p.getByLabel('رقم الموبايل').fill('01098765432'); await p.getByRole('button', { name: /^تأكيد الطلب/ }).click(); await p.getByRole('heading', { name: 'تم إرسال طلبك' }).waitFor(); await settle(p) }, full: true },
  { id: 'order-preparing', page: 'صفحة الطلب', title: 'طلب جاري تجهيزه (توصيل، ملاحظة صنف)', url: () => `/order/${ids().deliveryTagamoa}`, storage: () => ({ ...fixture(), 'km.lastOrder.v1': JSON.stringify({ number: ids().deliveryTagamoa, phone: '01000000002' }) }), full: true },
  { id: 'order-cancelled', page: 'صفحة الطلب', title: 'طلب ملغي', url: () => `/order/${ids().cancelledZagazig}`, storage: fixture },
  { id: 'order-ask-phone', page: 'صفحة الطلب', title: 'رابط طلب بدون رقم موبايل محفوظ', url: () => `/order/${ids().pickupAshry}` },
  { id: 'order-not-found', page: 'صفحة الطلب', title: 'طلب غير موجود', url: '/order/Z-0042', act: async (p) => { await p.getByLabel('رقم الموبايل').fill('01098765432'); await p.getByRole('button', { name: 'عرض حالة الطلب' }).click(); await p.getByRole('heading', { name: 'لم نجد هذا الطلب' }).waitFor() } },
  { id: 'track', page: 'تتبع طلب', title: 'صفحة التتبع فارغة', url: '/track' },
  { id: 'track-errors', page: 'تتبع طلب', title: 'التتبع: أخطاء الحقول', url: '/track', act: async (p) => { await p.getByRole('button', { name: /عرض حالة الطلب|تتبع/ }).first().click(); await settle(p) } },
  // ---- not found
  { id: 'not-found', page: 'صفحة غير موجودة', title: 'رابط غير موجود', url: '/nope' },
  { id: 'branch-not-found', page: 'صفحة غير موجودة', title: 'فرع غير موجود', url: '/branch/cairo' },
  // ---- staff
  { id: 'admin-empty', page: 'لوحة الكول سنتر', title: 'اللوحة بلا طلبات', url: '/admin' },
  { id: 'admin-orders', page: 'لوحة الكول سنتر', title: 'اللوحة: «الكل» وفيها 3 طلبات', url: '/admin', storage: fixture, act: async (p) => { await p.getByRole('group', { name: 'تصفية حسب الحالة' }).getByRole('button', { name: /^الكل/ }).click(); await settle(p) }, full: true },
  { id: 'admin-details', page: 'لوحة الكول سنتر', title: 'اللوحة: تفاصيل طلب', url: '/admin', storage: fixture, act: async (p) => { await p.getByRole('button', { name: 'التفاصيل' }).first().click(); await settle(p, 700) } },
  { id: 'admin-cancel', page: 'لوحة الكول سنتر', title: 'اللوحة: نافذة الإلغاء', url: '/admin', storage: fixture, act: async (p) => { await p.getByRole('button', { name: 'إلغاء', exact: true }).first().click(); await settle(p, 600) } },
  { id: 'zones', page: 'مناطق التوصيل', title: 'شاشة مناطق التوصيل', url: '/admin/zones', full: true },
  { id: 'zones-errors', page: 'مناطق التوصيل', title: 'المناطق: أخطاء إضافة منطقة', url: '/admin/zones', act: async (p) => { await p.getByRole('button', { name: 'إضافة المنطقة' }).click(); await settle(p) } },
]
export const PAGES = [...new Set(STATES.map((s) => s.page))]
export const urlOf = (s) => (typeof s.url === 'function' ? s.url() : s.url)
export const storageOf = (s) => (typeof s.storage === 'function' ? s.storage() : s.storage ?? null)
export { addItem, toCheckout }
