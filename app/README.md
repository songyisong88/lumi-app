# LUMI web app (frontend)

Vite + React + TypeScript + CSS Modules, installable PWA. Live: https://songyisong88.github.io/lumi-app/app/

```
npm install
npm run dev      # http://localhost:5173/lumi-app/app/
npm run build    # -> dist/ (deployed by .github/workflows/pages.yml)
```

## Structure
- `src/data/types.ts` – data shapes (Product, Creator, Story…)
- `src/data/sampleData.ts` – **sample data only** (ข้อมูลตัวอย่าง); replace with Supabase
- `src/services/favorites.ts` – `FavoritesService` interface + localStorage impl (swap for Supabase)
- `src/services/FavoritesContext.tsx` – React state for hearts
- `src/components/` – Header (+ desktop top nav, mobile BottomNav), StoriesRow, FilterChips,
  MasonryFeed (2/3/4/5/6 cols), ProductCard (image, template, tool, bot, course, commission, coming-soon), HeartButton, ComingSoonBand
- `src/pages/` – Home, Favorites (ที่ชอบ), StoryViewer, Placeholder (search, product, sell, chat… not built yet)

Routing uses HashRouter (`#/favorites`) because GitHub Pages has no SPA fallback.
Images in `public/img` are copied from `/v2/img`.
