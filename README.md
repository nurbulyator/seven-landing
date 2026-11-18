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

## Вторая версия — `/v2`

Обычный постраничный лендинг с одной сквозной фишкой — бирюзовой 3D-лентой. Она ползёт за прокруткой:
обвивает знак «7» на первом экране, расталкивает слова заголовка, заливает карточку и вытягивает её
в большой ролик, проходит через все секции и в конце складывается в «7».

- `src/content/v2.ts` — тексты второй версии (факты общие с `site.ts`).
- `src/components/v2/gl/PageGL.tsx` — общий WebGL-слой поверх страницы: лента, знак «7» из кадров Blender
  (поворачивается за курсором), карточка-«морф» (вступление → ролик), сдвиг строк (`data-shift`)
  и расталкивание слов (`data-push`). Без WebGL или при «уменьшить движение» остаются обычные `<img>`/`<video>`.
- `src/components/v2/gl/ribbon.ts` и `src/components/v2/ribbonRoute.ts` — сама лента и её маршрут:
  шаги привязаны к элементам с `data-ribbon="ключ"`, поэтому маршрут подстраивается под ширину экрана.
- `src/components/v2/hero/` — первый экран: «Знак» (по умолчанию), «Поток», «Рельеф» — переключатель внизу или `/v2#hero-flow`.
- `src/components/v2/sections/` — секции; `ProductUIs.tsx` — условные интерфейсы продуктов, нарисованные кодом.
- `public/v2/seven/` — 61 кадр знака (WebP с прозрачностью):
  `blender -b -P blender/render_seven.py -- <папка> --turn 61 --size 1200 --samples 128`, затем PNG → WebP.
- `public/v2/media/corridor.mp4` — видео-петля коридора ЦОД:
  `blender -b -P blender/render_v2.py -- corridor <папка>/corridor --samples 64 --w 1600 --h 900`,
  затем `scripts/encode-v2-media.sh <папка>`.
- `scripts/build-globe.mjs` — точки суши и контуры трёх стран для глобуса → `public/v2/globe.json`.
