import { ApiError } from './types'

const MESSAGES: Record<string, string> = {
  BRANCH_NOT_FOUND: 'الفرع غير موجود.',
  BRANCH_PAUSED: 'الفرع أوقف استقبال الطلبات مؤقتاً. جرّب بعد قليل أو اتصل بالفرع.',
  BRANCH_CLOSED: 'الفرع مغلق الآن. يمكنك الطلب في مواعيد العمل.',
  INVALID_ORDER_TYPE: 'اختر التوصيل أو الاستلام من الفرع.',
  INVALID_NAME: 'اكتب الاسم، حرفان على الأقل.',
  INVALID_PHONE: 'اكتب رقم موبايل مصري صحيح من 11 رقماً يبدأ بـ 01.',
  TOO_MANY_ORDERS: 'وصلتنا عدة طلبات من نفس الرقم خلال دقائق. انتظر قليلاً أو اتصل بالفرع.',
  INVALID_ZONE: 'اختر منطقة التوصيل من القائمة.',
  ADDRESS_REQUIRED: 'اكتب الشارع ورقم العمارة.',
  EMPTY_CART: 'السلة فارغة.',
  TOO_MANY_LINES: 'عدد الأصناف كبير جداً، اتصل بالفرع.',
  INVALID_LINE: 'في السلة صنف غير صحيح. راجع السلة.',
  INVALID_QTY: 'الكمية يجب أن تكون من 1 إلى 50.',
  ITEM_UNAVAILABLE: 'أحد الأصناف لم يعد متاحاً. راجع السلة.',
  ADVANCE_BOOKING_REQUIRED: 'هذا الصنف بالحجز المسبق فقط. اتصل بالفرع.',
  ORDER_NOT_FOUND: 'الطلب غير موجود.',
  NOT_ALLOWED: 'ليست لديك صلاحية لهذا الإجراء.',
  INVALID_TRANSITION: 'لا يمكن نقل الطلب لهذه الحالة.',
  CANCEL_REASON_REQUIRED: 'اختر سبب الإلغاء.',
  INVALID_ZONE_NAME: 'اكتب اسم المنطقة، حتى 60 حرفاً.',
  INVALID_ZONE_TYPE: 'اختر نوع المنطقة من القائمة.',
  INVALID_ZONE_FEE: 'اكتب رسوم التوصيل رقماً صحيحاً من 0 إلى 5000 جنيه.',
  ZONE_EXISTS: 'هذه المنطقة موجودة بالفعل في هذا الفرع.',
  ZONE_NOT_FOUND: 'المنطقة غير موجودة.',
  ZONE_NOT_REMOVABLE: 'هذه المنطقة من القائمة الأصلية للفرع ولا تُحذف من هنا.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && MESSAGES[error.code]) return MESSAGES[error.code]
  return 'حدث خطأ غير متوقع. حاول مرة أخرى أو اتصل بالفرع.'
}
