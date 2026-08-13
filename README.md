# UPRES — Ampliador de resolución EDIPA

Herramienta web 100% en el navegador para aumentar la resolución de imágenes raster.

- **Modo Fiel (Lanczos):** reescalado de alta calidad sin alterar el contenido original.
- **Modo IA (próximamente):** super-resolución (Real-ESRGAN) para reconstruir detalle.

Todo el procesamiento ocurre localmente en el navegador (Web Worker + Canvas), por lo que
las imágenes no se suben a ningún servidor. Gratis y privado.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19
- [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/postcss`)
- TypeScript
- [Zustand](https://github.com/pmndrs/zustand) para el estado del estudio
- `lucide-react` para iconos
- Vitest para pruebas

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000
```

Otros scripts:

```bash
npm run build      # build de producción
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
```

## Estructura

```
src/
  app/
    globals.css    # Tailwind v4 + variables de tema (light/dark)
    layout.tsx
    page.tsx       # UI del estudio (carga, factor, modo, ampliar, descargar)
  components/
    LogoEdipa.tsx
    Providers.tsx
  hooks/useTheme.ts
  lib/
    image.ts       # carga/descarga de imágenes
    lanczos.ts     # núcleo del reescalado Lanczos (con pruebas)
  store/useStudioStore.ts
  workers/scale.worker.ts
```

## Despliegue

El proyecto se despliega en [Vercel](https://vercel.com/) conectado al repositorio
`editorialpatriang-lang/UPRES`. Cada push a `main` dispara un redeploy automático.

- Producción: https://upres-eight.vercel.app
