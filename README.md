# VistaPro Web

A browser-based homage to **[VistaPro](https://en.wikipedia.org/wiki/VistaPro)**,
the classic 1990s 3-D fractal scenery generator. Generate a landscape from a
number, color it by elevation, add water, sky, clouds, haze and sun light, fly a
camera around it, and export the result — **entirely client-side**. No servers,
no backend, no data leaves the browser.

## Features

- **Fractal terrain** generated with the Diamond–Square algorithm; a seed
  reproduces the same landscape every time. Tune roughness, detail, and height.
- **Elevation + slope coloring** — sea → beach → grass → rock → snow, with bare
  rock on steep cliffs. Water/beach/tree/snow lines are all adjustable.
- **Water** surface at a configurable lake level.
- **Sky** with a horizon→zenith gradient, a sun disc, and drifting procedural
  clouds; plus adjustable **atmospheric haze**.
- **Sun lighting** driven by azimuth/elevation, intensity, and color.
- **Hybrid rendering** — a smooth **Modern** mode and a period-accurate
  **Retro** mode (faceted flat shading, posterized palette, ordered dither).
- **Interactive camera** (orbit / zoom / pan) with editable position, target,
  bank, and lens, kept in sync with the controls.
- **Retro control panel** styled after early-90s desktop software.
- **PNG export** and **JSON save/load** of the full scene.

## Tech stack

- [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/) (strict)
- [three.js](https://threejs.org/) for WebGL rendering (vanilla, no UI framework)
- [Vitest](https://vitest.dev/) for unit tests

## Getting started

Requires Node.js 18+ and npm.

```bash
npm install       # install dependencies
npm run dev       # start the dev server (hot reload)
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
npm test          # run the unit tests
```

Open the URL printed by `npm run dev` (default http://localhost:5173).

## Usage

The panel on the left controls every scene parameter; changes update the view
live.

| Group | What it does |
| --- | --- |
| **Terrain** | Seed, detail (grid size), roughness, height, and a *New Landscape* button (random seed). |
| **Camera** | Numeric position/target, bank (roll), and lens (FOV). |
| **Sun & Light** | Sun azimuth/elevation, intensity, and color. |
| **Terrain Levels** | Water, beach, treeline, and snowline as fractions of the height range. |
| **Atmosphere** | Haze density/color, sky top/horizon colors, cloud cover/color. |
| **Render** | Switch between Modern (smooth) and Retro (faceted) modes. |
| **File** | Export a PNG, or save/load the scene as JSON. |

In the viewport: **drag** to orbit, **scroll** to zoom, **right-drag** to pan.

## How it works

A single `SceneParams` object is the source of truth. The UI patches it; the
`App` diffs each change and does the minimum work to reconcile the three.js
scene (regenerate the heightmap, rebuild geometry, recolor, move the sun, resync
the camera, or swap render mode). Expensive terrain work is coalesced to at most
once per frame so dragging sliders stays smooth.

```
src/
  state/      SceneParams model + observable store
  terrain/    seeded PRNG + Diamond–Square heightmap
  render/     renderer, terrain mesh, coloring, water, sky, haze, lighting,
              camera rig, and the retro shading material
  ui/         retro control panel + widgets
  io/         PNG export + JSON scene save/load
  app.ts      wires state ↔ renderer ↔ UI and reconciles changes
```

## Deployment

`npm run build` emits a fully static bundle in `dist/` with **relative** asset
paths, so it runs from any static host (GitHub Pages, S3, Netlify, a plain file
server, …). Just serve the `dist/` directory.

## Credits

Inspired by VistaPro, originally written by John Hinkley (Virtual Reality Labs /
Hypercube Engineering). This is an independent, from-scratch web recreation and
is not affiliated with the original.
