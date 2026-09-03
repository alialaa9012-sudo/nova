import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';

import { query } from './db.js';
import authRoutes from './routes/auth.routes.js';
import statsRoutes from './routes/stats.routes.js';
import menuRoutes from './routes/menu.routes.js';
import reservationsRoutes from './routes/reservations.routes.js';
import complaintsRoutes from './routes/complaints.routes.js';
import customersRoutes from './routes/customers.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import kbRoutes from './routes/kb.routes.js';
import overridesRoutes from './routes/overrides.routes.js';
import teamRoutes from './routes/team.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // رؤوس أمان أساسية
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // ----- API -----
  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ ok: true, db: 'up' });
    } catch (err) {
      res.status(503).json({ ok: false, db: 'down', error: err.message });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/reservations', reservationsRoutes);
  app.use('/api/complaints', complaintsRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/kb', kbRoutes);
  app.use('/api/overrides', overridesRoutes);
  app.use('/api', teamRoutes); // /api/branches, /api/users, /api/audit, /api/restaurant

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // ----- الملفات الثابتة -----
  // لوحة التحكم
  app.use('/dashboard', express.static(path.join(ROOT, 'dashboard'), { extensions: ['html'] }));
  // الموقع التعريفي (نفس ملفات GitHub Pages)
  for (const page of ['index.html', 'privacy.html', 'terms.html']) {
    app.get(`/${page === 'index.html' ? '' : page}`, (_req, res) =>
      res.sendFile(path.join(ROOT, page))
    );
  }

  // ----- معالج الأخطاء -----
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({
      error: status >= 500 ? 'server_error' : 'bad_request',
      message: status >= 500 ? 'حصل خطأ في السيرفر. حاول تاني.' : err.message,
    });
  });

  return app;
}

// التشغيل المباشر فقط (مش عند الاستيراد من الاختبارات)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`NOVA control panel جاهزة على http://localhost:${port}/dashboard`);
  });
}
