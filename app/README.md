# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## أدوات الواجهة والاختبار (تم إعدادها)

- **UI:** Tailwind CSS v4 + shadcn/ui (قاعدة Radix، دعم RTL مفعّل، أيقونات Lucide، خط Cairo محلي).
- **اختبارات الوحدة:** Vitest + React Testing Library (بيئة jsdom). الملفات: `src/**/*.test.tsx`، الإعداد في `vitest.config.ts` و`src/test/setup.ts`.
- **اختبارات المتصفح:** Playwright (مجلد `e2e/`، الإعداد في `playwright.config.ts`). يبني المشروع ويشغّل `vite preview` تلقائياً.
- **إمكانية الوصول:** axe-core عبر `@axe-core/playwright` (اختبار `e2e/a11y.spec.ts` موسوم `@a11y`).

### الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل التطوير |
| `npm run build` | فحص الأنواع + بناء الإنتاج |
| `npm run preview` | معاينة نسخة الإنتاج |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript فقط |
| `npm test` | اختبارات الوحدة مرة واحدة |
| `npm run test:watch` | اختبارات الوحدة في وضع المراقبة |
| `npm run test:coverage` | اختبارات الوحدة مع تقرير تغطية في `coverage/` |
| `npm run test:e2e` | اختبارات Playwright (كروم مكتبي + موبايل) |
| `npm run test:e2e:ui` | واجهة Playwright التفاعلية |
| `npm run test:a11y` | اختبارات إمكانية الوصول فقط |

### على جهاز جديد
```bash
cd app
npm install
npx playwright install chromium   # مرة واحدة فقط لتنزيل المتصفح
npm test && npm run test:e2e
```

إضافة مكوّن shadcn جديد: `npx shadcn@latest add <component>`.
