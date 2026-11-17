// Places three demo orders through the real interface, moves one to "preparing" and cancels one
// from the staff board, then saves the browser's demo storage as a fixture for later states.
import { BASE, OPEN, VIEWPORTS, context, launch, writeJSON } from './lib.mjs'

const b = await launch()
const ctx = await context(b, VIEWPORTS[3])
const p = await ctx.newPage()
async function order(branch, item, size, type, extra) {
  await p.goto(`${BASE}/branch/${branch}`)
  await p.getByRole('button', { name: `أضف ${item}`, exact: true }).click()
  const sheet = p.getByRole('dialog', { name: item })
  if (size) await sheet.getByRole('radio', { name: new RegExp(`^${size}`) }).click()
  if (extra?.note) {
    await sheet.getByRole('button', { name: /أضف ملاحظة/ }).click()
    await sheet.getByRole('textbox').fill(extra.note)
  }
  await sheet.getByRole('button', { name: /^أضف للسلة/ }).click()
  await p.getByRole('button', { name: /عرض السلة/ }).click()
  await p.getByRole('dialog', { name: 'السلة' }).getByRole('link', { name: 'إتمام الطلب' }).click()
  await p.getByRole('heading', { level: 1, name: 'إتمام الطلب' }).waitFor()
  if (type === 'pickup') await p.getByRole('radio', { name: 'استلام من الفرع' }).click()
  await p.getByLabel('الاسم').fill(extra.name)
  await p.getByLabel('رقم الموبايل').fill(extra.phone)
  if (type === 'delivery') {
    await p.getByRole('combobox', { name: 'المنطقة' }).fill(extra.zone)
    await p.getByRole('option', { name: new RegExp(extra.zone) }).first().click()
    await p.getByLabel('الشارع').fill('شارع تجريبي')
    await p.getByLabel('رقم العمارة').fill('7')
  }
  await p.getByRole('button', { name: /^تأكيد الطلب/ }).click()
  await p.getByRole('heading', { name: 'تم إرسال طلبك' }).waitFor()
  return p.url().split('/order/')[1]
}
const a = await order('ashry', 'صدور فراخ', 'ربع', 'pickup', { name: 'عميل تجريبي أ', phone: '01000000001' })
const t = await order('tagamoa', 'كفتة فراخ', 'ربع', 'delivery', { name: 'عميل تجريبي ت', phone: '01000000002', zone: 'اللوتس الشمالية', note: 'بدون شطة' })
const z = await order('zagazig', 'شيش طاووق', 'ربع', 'delivery', { name: 'عميل تجريبي ز', phone: '01000000003', zone: 'القومية' })
await p.goto(`${BASE}/admin`)
const card = (n) => p.getByRole('list', { name: 'قائمة الطلبات' }).getByRole('listitem').filter({ hasText: n })
await card(t).getByRole('button', { name: /^نقل إلى/ }).click()
await card(z).getByRole('button', { name: 'إلغاء', exact: true }).click()
await p.getByRole('radiogroup', { name: 'سبب الإلغاء' }).getByRole('radio').first().click()
await p.getByRole('dialog').getByRole('button', { name: 'تأكيد الإلغاء' }).click()
await p.waitForTimeout(500)
const storage = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('km.demo') || k === 'km.lastOrder.v1').map((k) => [k, localStorage.getItem(k)])))
const orders = JSON.parse(storage['km.demo.orders.v1']).map((o) => ({ number: o.number, status: o.status, phone: o.phone, branch: o.branchId }))
writeJSON('results/fixture-storage.json', storage)
writeJSON('results/fixture-orders.json', { pickupAshry: a, deliveryTagamoa: t, cancelledZagazig: z, orders })
console.log(orders)
await b.close()
