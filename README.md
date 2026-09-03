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

## تشغيل اللوحة في 4 خطوات

### 1) نزّل المشروع وثبّت المكتبات

```bash
git clone https://github.com/alialaa9012-sudo/nova.git
cd nova
npm install
```

### 2) جهّز ملف الإعدادات

```bash
cp .env.example .env
```

افتح `.env` واملأ حاجتين:

- **`DATABASE_URL`** — من [Neon](https://console.neon.tech) → مشروع `nova` →
  زرار **Connect** → انسخ الرابط بالكامل (بيبدأ بـ `postgresql://`).
- **`JWT_SECRET`** — أي نص عشوائي طويل. تقدر تولّده بالأمر ده:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> ⚠️ ملف `.env` **مايترفعش على GitHub أبدًا** — هو متجاهَل في `.gitignore` وسيبه كده.

### 3) شغّل

```bash
npm start
```

### 4) افتح اللوحة

<http://localhost:3000/dashboard>

ادخل بإيميل وباسورد أي مستخدم موجود في جدول `users`.

---

## لو نسيت باسورد الدخول

شغّل الأمر ده وهو هيطبعلك SQL جاهز تنسخه وتشغّله في Neon SQL Editor:

```bash
node -e "
const b=require('bcryptjs');
const email='owner@test.nova';        // غيّر الإيميل
const pass='YourNewPassword123';      // غيّر الباسورد
console.log(\`UPDATE users SET password_hash='\${b.hashSync(pass,10)}' WHERE lower(email)=lower('\${email}');\`);
"
```

---

## النشر على الإنترنت (عشان تفتحها من الموبايل)

اللوحة سيرفر Node عادي — تنشرها على أي استضافة بتدعم Node 20+
(Render أو Railway أو Fly.io). الإعدادات:

| الإعداد | القيمة |
|---|---|
| Build command | `npm install` |
| Start command | `npm start` |
| Environment variables | `DATABASE_URL` و `JWT_SECRET` و `NODE_ENV=production` |

> مهم: لما تنشر، خلي `NODE_ENV=production` — كوكي الجلسة ساعتها بيتبعت
> على HTTPS بس، وده اللي بيحمي حساب المطعم.

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
