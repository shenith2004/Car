# NOIRVAL — Bespoke Automotive Atelier

A cinematic, dark-luxury website for a bespoke car atelier: scroll-driven path-traced imagery, a cursor image trail, and a real-time, physically based 3D car studio.

> *For those who refuse ordinary.*

## What's inside

| Section | What it does |
| --- | --- |
| **Preloader** | Brand mark, counter, and progress line while the first hero frames stream in. |
| **Hero** | 100 path-traced frames (Blender Cycles), scrubbed by scroll on a `<canvas>` and cross-faded so motion stays fluid. The camera dollies from a three-car line-up into the red roadster, over the bonnet, through the windscreen, and into the cabin. The headline dissolves letter by letter into blur, the light shaft fades, then the scene goes to black. |
| **Manifesto** | *"We Don't Modify Vehicles — We Build Them For You"*: letters sharpen in from blur, and moving the cursor drops a trail of detail shots (wheels, LEDs, cabin, carbon…). On touch devices or when idle, an automatic path keeps the trail moving. |
| **Approach** | A leather-stitching macro (also rendered in Cycles) glides in from the corner. The heading masks up, the red arc draws itself, and the marques and copy fade in. |
| **Builds** | Pinned horizontal gallery of commissions with clip-reveal and inner parallax. |
| **Studio** | Real-time three.js scene: clear-coated paint, transmission glass, studio soft-box reflections (PMREM), a wet reflective floor shader, baked contact shadow, bloom on the LEDs. Drag to orbit; change paint, wheel finish, and camera view; toggle lights and turntable. |
| **Process** | Sticky image that changes as the four steps scroll past (clay → wireframe → cabin → reveal). |
| **Stats · Contact · Footer** | Count-up figures, a floating-label enquiry form, and a giant gradient wordmark. |

Global details: Lenis smooth scrolling synced with GSAP ScrollTrigger, an inset rounded "bezel" frame, animated film grain, a custom ring cursor (hover, label, and drag states, plus magnetic buttons), a scroll-progress HUD, a full-screen mobile menu, and `prefers-reduced-motion` support.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in /dist
npm run preview   # serve the production build
```

The build uses a relative base (`./`), so `/dist` works on any static host or sub-path.

### Deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Merge into `main` (or run the workflow manually from the **Actions** tab).

## Customise

- **Brand name**: `src/config.js` (`BRAND.name`). Every `[data-brand]` element updates. Also change the `<title>`/meta tags in `index.html` and the logo mark (`<symbol id="mark">`).
- **Copy, builds, and process steps**: plain HTML in `index.html`.
- **Paint and wheel options in the studio**: the `data-paint` / `data-rim` buttons in `index.html`.
- **Contact form**: validates on the page. To receive enquiries, paste a form-service endpoint (Formspree, Getform, or your own API) into `CONTACT.endpoint` in `src/config.js`. Until you do, the form tells visitors plainly that nothing was sent.

## Project structure

```
index.html                 markup for every section
src/main.js                smooth scroll, ScrollTrigger choreography, preloader
src/config.js              brand name, hero frame paths, trail images
src/modules/
  hero-sequence.js         canvas frame-sequence player (cover fit + cross-fade)
  image-trail.js           cursor image trail
  studio.js                real-time three.js studio (lazy-loaded)
  cursor.js, split-text.js, utils.js
src/styles/main.css        all styles (responsive down to small phones)
public/media/              rendered imagery (WebP)
public/models/             3D model (Draco-compressed GLB) and baked AO shadow
tools/blender/             the Cycles render pipeline used to create /public/media
```

## Credits

- 3D model: [“Ferrari 458 Italia”](https://sketchfab.com/3d-models/ferrari-458-italia-57bf6cc56931426e87494f554df1dab6) by **vicent091036**, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), via the three.js examples. The emblems were removed and the materials re-authored. Keep this attribution if you reuse the model; it is also shown in the site footer.
- Fonts: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and [Inter](https://rsms.me/inter/), SIL Open Font License, self-hosted via Fontsource.
- Libraries: [three.js](https://threejs.org), [GSAP](https://gsap.com), [Lenis](https://lenis.darkroom.engineering), [Vite](https://vite.dev).
- All imagery was rendered for this project in Blender Cycles (see `tools/blender/README.md`).
- "NOIRVAL" and the partner marques are fictional placeholders.
