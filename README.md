# Vista ⛰️

A browser-based homage to **[VistaPro](https://en.wikipedia.org/wiki/VistaPro)**,
the classic 1990s 3-D fractal scenery generator. Generate a landscape from a
number, color it by elevation, add water, sky, clouds, haze and sun light, fly a
camera around it, and export the result — **entirely client-side**. No servers,
no backend, no data leaves the browser.

## Features

- **Fractal terrain** generated with the Diamond–Square algorithm; a seed
  reproduces the same landscape every time. Tune roughness, detail, and height.
- **Terrain shaping** — deterministic, seed-reproducible passes for smoothing,
  valley biasing, cliffs, downhill river carving, and basin-filling lakes.
- **Elevation + slope coloring** — sea → beach → grass → rock → snow, with bare
  rock on steep cliffs. Water/beach/tree/snow lines are all adjustable.
- **Editable palette** — RGB band colors, palette posterization (NumClr),
  palette lock, and a natural/contour (CMap) coloring mode.
- **Scenery** — instanced trees between the waterline and treeline, a night-sky
  star field, and toggleable sky, clouds, and horizon.
- **Water** surface at a configurable lake level, plus local lakes.
- **Sky** with a horizon→zenith gradient, a sun disc, and drifting procedural
  clouds; plus adjustable **atmospheric haze**.
- **Sun lighting** driven by azimuth/elevation, intensity, and color.
- **Render quality** — polygon LOD (Poly), Gouraud/faceted shading (GShade),
  backface culling (BFCull), band blending (Blend), ordered dither (Dither/PDithr),
  a detail texture (O/L/M/H), and a bounding-box overlay.
- **Hybrid rendering** — a smooth **Modern** mode and a period-accurate
  **Retro** mode (faceted flat shading, posterized palette, ordered dither).
- **Explicit render workflow** — the 3-D perspective shows by default; a fast
  2-D **overview map** (with a camera frustum overlay) is available via **View**.
  **Render** rebuilds the 3-D scene and **ReDraw** refreshes it. Output
  resolution (GrMode) and image quality / supersampling (IQ) are configurable.
- **Interactive camera** (orbit / zoom / pan) with editable position, target,
  bank, lens, and VistaPro-style **Head / Pitch / Range** plus dX/dY/dZ/dR
  readouts, kept in sync with the controls.
- **Retro control panel + top menu bar** styled after early-90s desktop software.
- **Import / export** — import a grayscale-PNG heightmap, export a PNG image, an
  OBJ mesh, or the full scene as JSON; plus a simple camera **flythrough** script.

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
| **Menu bar** | Project (new), Load, Save, GrMode (resolution), Script (flythrough), ImpExp (import/export), IQ (image quality). |
| **Render** | View readout, GrMode, IQ, and the Render / ReDraw / View workflow buttons. |
| **Terrain** | Seed, detail (grid size), roughness, VScale (height), and a *New Landscape* button (random seed). |
| **Terrain Features** | Lake, River, Valley, Cliffs, Smooth, Trees, Stars, Sky, Clouds, Horizon (toggles + strengths). |
| **Camera** | Position/target, edit mode (Camera/Target), Head/Pitch/Range, bank, lens, and dX/dY/dZ/dR readouts. |
| **Sun & Light** | Sun azimuth/elevation, intensity, and color. |
| **Terrain Levels** | SeaLvl, beach, TreeLn, and SnowLn as fractions of the height range. |
| **Palette** | Band colors (RGBPal), NumClr, LckPal, and CMap (natural/contour). |
| **Atmosphere** | HazeDn/color, sky top/horizon colors, cloud cover/color. |
| **Render Quality** | Mode (Modern/Retro), Poly, GShade, BFCull, Blend, Dither, PDithr, Texture, Bound. |
| **Scaling** | Enlarge / Shrink / Smooth. |
| **Project / File** | New, Save, Load, Import DEM, Export PNG, Export OBJ, and Fly (flythrough). |

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
  terrain/    seeded PRNG, Diamond–Square heightmap, shaping passes + pipeline,
              and heightmap resample/decimate helpers
  render/     renderer, terrain mesh, coloring/palette, water, sky + stars, haze,
              lighting, trees, camera rig + Head/Pitch/Range math, overview map,
              detail texture, and the retro shading material
  ui/         top menu bar + retro control panel + widgets
  io/         PNG/OBJ export, heightmap import, camera flythrough, JSON save/load
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
