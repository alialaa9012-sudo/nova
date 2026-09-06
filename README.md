# NOVA — AI Restaurant Operations

**RUN SMARTER. SERVE BETTER.**

نظام إدارة مطاعم على واتساب: بوت ذكاء اصطناعي بيستقبل الحجوزات ويرد على
الاستفسارات ويدير الشكاوى — ولوحة تحكم عربية بيدير منها صاحب المطعم كل حاجة.

---

## إيه اللي موجود دلوقتي

| الجزء | الحالة |
|---|---|
| الموقع التعريفي (`index.html`) | ✅ شغّال |
| قاعدة البيانات (Neon Postgres) | ✅ شغّالة وفيها بيانات |
| API لإدارة كل الداتا (`src/`) | ✅ جاهز |
| لوحة التحكم العربية (`dashboard/`) | ✅ جاهزة |
| ربط واتساب (WhatsApp Cloud API) | ⬜ الخطوة الجاية |
| رد البوت بالذكاء الاصطناعي | ⬜ الخطوة الجاية |

---

## انشر اللوحة على الإنترنت (10 دقايق — من غير برمجة)

عشان تفتح اللوحة من أي موبايل أو لابتوب، لازم تكون منشورة. أسهل طريقة **Render** — مجاني ومافيهوش تعقيد.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/alialaa9012-sudo/nova)

### الخطوات

**1) هات رابط قاعدة البيانات من Neon**

ادخل [console.neon.tech](https://console.neon.tech) → اختار مشروع **nova** → اضغط زرار **Connect** →
انسخ الرابط كله (بيبدأ بـ `postgresql://` وفيه كلمة السر جواه).

**2) اضغط زرار Deploy to Render فوق**

- سجّل دخول بحساب GitHub بتاعك.
- Render هيقرأ ملف `render.yaml` ويجهّز كل حاجة لوحده.
- هيسألك على حاجة **واحدة** بس: `DATABASE_URL` → الصق الرابط اللي نسخته.
- اضغط **Apply** واستنى 2-3 دقايق.

**3) افتح لوحتك**

Render هيديك رابط شكله `https://nova-panel-xxxx.onrender.com`.
لوحة التحكم على: `https://nova-panel-xxxx.onrender.com/dashboard`

> **ملاحظة على الخطة المجانية:** لو محدش فتح اللوحة لمدة 15 دقيقة، Render بينيّمها.
> أول فتحة بعد كده بتاخد حوالي 50 ثانية تفتح، وبعدين بتبقى سريعة عادي.
> لما تبدأ تدي اللوحة لمطاعم حقيقية، رقّي للخطة المدفوعة (7 دولار في الشهر) وهتشتغل على طول.

### لو مش عارف تدخل — اعمل كلمة مرور جديدة

```bash
npm install
npm run password owner@test.nova "كلمة-السر-الجديدة"
```

هيطبعلك سطر SQL. انسخه → Neon → **SQL Editor** → الصقه → **Run**.
بعدها ادخل اللوحة بالإيميل ده وكلمة السر الجديدة.

---

## تشغيلها على جهازك (للتجربة السريعة)

```bash
git clone https://github.com/alialaa9012-sudo/nova.git
cd nova
npm install
cp .env.example .env      # حط DATABASE_URL و JWT_SECRET
npm start                 # افتح localhost:3000/dashboard
```

توليد `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ ملف `.env` **مايترفعش على GitHub أبدًا** — هو متجاهَل في `.gitignore` وسيبه كده.

الموقع التعريفي فاضل شغّال زي ما هو على GitHub Pages من ملفات الجذر.

---

## بنية المشروع

```
nova/
├── index.html            الموقع التعريفي (GitHub Pages)
├── privacy.html
├── terms.html
├── db/
│   └── schema.sql        قاعدة البيانات كاملة — تبني الداتابيز من الصفر
├── src/
│   ├── server.js         نقطة التشغيل + ربط كل المسارات
│   ├── db.js             الاتصال بـ Postgres
│   ├── auth.js           تسجيل الدخول والصلاحيات (bcrypt + JWT)
│   ├── audit.js          تسجيل كل عملية في audit_log
│   ├── validate.js       التحقق من المدخلات
│   └── routes/           مسارات الـ API
├── dashboard/            لوحة التحكم (HTML + CSS + JS خالص، بدون build)
└── test/                 اختبارات الـ API
```

---

## الصلاحيات

| الدور | يقدر يعمل إيه |
|---|---|
| **موظف** (staff) | يوقف ويشغّل أصناف، يأكد ويلغي حجوزات، يتعامل مع الشكاوى والمحادثات |
| **مدير** (manager) | كل اللي فوق + يعدّل المنيو والأقسام ومعرفة البوت + يشوف سجل العمليات |
| **مالك** (owner) | كل حاجة + الفروع والمستخدمين وبيانات المطعم |

كل عملية كتابة بتتسجّل في `audit_log` باسم اللي عملها ووقتها.

---

## الـ API

كل المسارات تحت `/api` ومحتاجة كوكي جلسة (`nova_session`) ما عدا
`/api/health` و `/api/auth/login`.

| المسار | الوصف |
|---|---|
| `POST /api/auth/login` | تسجيل الدخول |
| `POST /api/auth/logout` | الخروج |
| `GET /api/auth/me` | بيانات المستخدم الحالي |
| `GET /api/stats` | أرقام لوحة التحكم |
| `GET /api/stats/reservations-trend` | حجوزات آخر 14 يوم |
| `GET /api/menu` | المنيو كامل بالأقسام والأحجام |
| `PATCH /api/menu/items/:id/availability` | إيقاف/تشغيل صنف |
| `GET · POST /api/reservations` | الحجوزات |
| `PATCH /api/reservations/:id` | تأكيد أو إلغاء حجز |
| `GET · POST /api/complaints` | الشكاوى |
| `GET · POST /api/customers` | العملاء |
| `GET /api/conversations` | المحادثات |
| `POST /api/conversations/:id/takeover` | الموظف يستلم المحادثة من البوت |
| `GET · POST /api/kb` | معرفة البوت |
| `GET · POST /api/overrides` | التعليمات الطارئة |
| `GET · POST /api/branches` · `/api/users` | الفروع وفريق العمل |
| `GET /api/audit` | سجل العمليات |
| `GET · PATCH /api/restaurant` | بيانات المطعم |

---

## الاختبارات

```bash
npm test
```

بتغطي: تسجيل الدخول، رفض الحسابات الموقوفة، الصلاحيات لكل دور،
عزل بيانات كل مطعم عن التاني، التحقق من المدخلات، وتسجيل العمليات.

---

## الخطوة الجاية

1. **ربط واتساب** — WhatsApp Cloud API: webhook يستقبل الرسائل ويسجّلها في
   `messages`، وendpoint يبعت الردود.
2. **رد البوت** — يقرأ من `kb_entries` و `menu_items` و `emergency_overrides`
   ويرد على العميل، ويسجّل التكلفة في `daily_costs`.
3. **تقييمات جوجل** — جدول `google_reviews` جاهز مستني الربط.
