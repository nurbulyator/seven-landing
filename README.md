# seven-landing

Новый сайт Seven Hills of Kazakhstan. Первый этап — главная страница (лендинг).

Стек: Next.js (App Router), TypeScript strict, Tailwind CSS 4. Знак «7» на первом экране отрендерен в Blender (Cycles) покадрово и проигрывается прокруткой.

## Запуск

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## Где что лежит

- `src/content/site.ts` — все тексты страницы.
- `src/components/hero/SevenHero.tsx` — первый экран: кадры знака на canvas, подписи по прокрутке.
- `src/components/sections/` — остальные секции.
- `public/hero/seven/` — 120 кадров знака (WebP с прозрачностью, подходят для светлой и тёмной темы).
- `blender/render_seven.py` — сцена и анимация знака. Пересборка кадров:
  `blender -b -P blender/render_seven.py -- <папка>`, затем конвертация PNG → WebP (`ffmpeg … -c:v libwebp`).
- `PRODUCT.md` — факты о компании и открытые вопросы.
- `_assets/` — исходные ассеты из проекта seven-hills-kz-site, в git не попадают.
