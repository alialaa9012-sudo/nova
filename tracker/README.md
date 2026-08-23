# Daily Tracker

بوت تليجرام شخصي لمتابعة المهام والعادات والتقدّم اليومي.

مستخدم واحد فقط (allowlist بمعرّف تليجرام)، رسالة "اليوم" واحدة تُحدَّث في مكانها،
وتذكيرات تنجو من إعادة النشر لأنها مخزّنة في قاعدة البيانات لا في الذاكرة.

## التقنيات

| الطبقة | التقنية |
|---|---|
| البوت | aiogram 3 |
| الويب / webhook | FastAPI + uvicorn |
| القاعدة | PostgreSQL (Neon) — وSQLite محلياً |
| ORM والهجرات | SQLAlchemy 2.0 async + Alembic |
| الجدولة | جدول `reminders` + نبضة خارجية على `/cron/tick` |

## التشغيل محلياً

```bash
python3 -m pip install -r tracker/requirements-dev.txt
cp tracker/.env.example tracker/.env      # ثم املأ القيم
cd tracker && python -m alembic upgrade head && cd ..
uvicorn tracker.app:app --reload
```

مع `DATABASE_URL=sqlite+aiosqlite:///./local.db` تعمل بلا أي خادم قواعد بيانات.

## الاختبارات

```bash
python3 -m pytest tracker/tests -q
```

الاختبارات لا تلمس الشبكة إطلاقاً: تليجرام يُحاكى بجلسة تسجّل ما كان سيُرسل
(`tracker/tests/fake_telegram.py`)، والقاعدة SQLite في الذاكرة.

## النشر على Render (الطبقة المجانية)

1. **اربط الريبو**: من Render اختر New → Blueprint وأشر إلى `render.yaml`.
2. **اضبط الأسرار** من لوحة Render (Environment):
   - `BOT_TOKEN` — من BotFather
   - `ALLOWED_USER_ID` — معرّفك من `@userinfobot`
   - `DATABASE_URL` — رابط Neon
   - `PUBLIC_URL` — عنوان الخدمة بعد أول نشر، مثل `https://daily-tracker.onrender.com`
   - `WEBHOOK_SECRET` و`CRON_SECRET` يولّدهما Render تلقائياً
3. **أعد النشر** بعد ضبط `PUBLIC_URL` حتى يُسجَّل الـwebhook.
4. **فعّل النبضة**: أنشئ مهمة على [cron-job.org](https://cron-job.org) كل دقيقة على:
   `https://<your-service>.onrender.com/cron/tick?key=<CRON_SECRET>`

### لماذا النبضة الخارجية ضرورية

خدمة Render المجانية تتوقف بعد ١٥ دقيقة بلا حركة، وتحتاج نحو دقيقة لتستيقظ.
النبضة تبقيها مستيقظة وتُنفّذ التذكيرات المستحقة في آنٍ واحد، فأقصى تأخير
في أي تذكير دقيقة واحدة — ولا يضيع تذكير أبداً لأن الطابور في القاعدة.

> ⚠️ لا تستخدم قاعدة Postgres المجانية على Render: تُحذف بياناتها بعد ٣٠ يوماً.
> استخدم Neon (بلا تاريخ انتهاء) كما في الإعداد أعلاه.

## الأمان

- الأسرار من متغيّرات البيئة فقط — لا شيء منها في الكود أو Git.
- `/webhook` يتحقق من `X-Telegram-Bot-Api-Secret-Token`.
- `/cron/tick` يتحقق من `CRON_SECRET`.
- أي تحديث من غير `ALLOWED_USER_ID` يُتجاهل بصمت.

## بنية المشروع

```
tracker/
├── bot/
│   ├── handlers/        معالِجات الأوامر والأزرار
│   └── middlewares.py   allowlist + جلسة القاعدة لكل تحديث
├── services/
│   ├── timeutil.py      اليوم المنطقي وحدوده الأسبوعية والشهرية
│   └── bootstrap.py     تهيئة المستخدم وعاداته الافتراضية
├── db/
│   ├── models.py        نماذج SQLAlchemy
│   └── migrations/      Alembic
├── app.py               FastAPI: /webhook + /cron/tick + /health
└── tests/
```

## ملاحظة عن اليوم المنطقي

اليوم لا يبدأ من منتصف الليل بل من الساعة ٤ فجراً (`day_boundary_hour`).
لذلك المراجعة الليلية الساعة ١٢:٠٠ تُراجع اليوم الذي انتهى للتو، ومن سهر
بعد منتصف الليل يظل يسجّل على يوم أمس.
