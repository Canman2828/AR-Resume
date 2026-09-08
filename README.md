# AR Resume

Scan the QR code on the printed resume → the phone opens the live site →
point the camera at the resume → liquid-glass AR panels float around the
paper:

```
                     ┌──────────────────────┐
 (photo)             │ ▓▓ Name       [QR] ▓ │   Highlighted Projects
 ┌────────┐          │  ~~~~~~~~~~~~~~~~    │   ┌────────────────┐
 │ About  │          │  ~~~~~~~~~~~~~~~~    │   │ YouTube video  │
 └────────┘          │  ~~~~~~~~~~~~~~~~    │   ├────────────────┤
 ┌────────┐          │  ~~~~~~~~~~~~~~~~    │   │ YouTube video  │
 │Contacts│          │  (physical paper)    │   └────────────────┘
 │LinkedIn│          │                      │
 │GitHub  │          │ ▓▓▓▓▓▓ footer ▓▓▓▓▓▓ │
 │Website │          └──────────────────────┘
 └────────┘
```

Built with [MindAR](https://hiukim.github.io/mind-ar-js-doc/) image tracking
+ A-Frame. Pure static site — no build step, no server code.

The tracking file preloads while the page opens. Panels use canvas textures
and are built before optional images load. Photos and thumbnails download
independently after scene startup; failed requests or requests taking more
than eight seconds leave a usable placeholder. MindAR still needs to warm
up tracking after camera access and recognize the resume before showing panels.
The camera prefers 640 × 480 frames to reduce tracking work; browsers may
select another supported resolution. Add `?debug=startup` to the AR URL to
see camera resolution, tracking setup, GPU warm-up, and target download
timings. These diagnostics stay on the device. `Ready after camera opened`
starts when the browser returns the camera stream, so it excludes time
spent deciding whether to allow access. The camera adapter targets the
pinned MindAR 1.2.5 startup methods and must be rechecked before upgrades.

**Live site:** https://canman2828.github.io/AR-Resume/
**Printable resume:** https://canman2828.github.io/AR-Resume/print/resume-print.html

---

## The one rule to remember

The AR engine recognizes the resume by a compiled "fingerprint"
(`assets/targets.mind`) of the page's exact appearance.

> **If you change how the printed resume looks (any edit to
> `print/resume-print.html`, or config values shown on it like name or
> contacts), you MUST recompile `targets.mind` (step 3 below) and reprint.
> If you only change AR-side content (About text, videos, photo), no
> recompile is needed — just push.**

The design needs visual contrast to track: keep the dark header band,
section chips, and footer bar (or something similarly bold). A sparse
white page with thin text will NOT be detected — this was tested.

---

## Every-time workflow

### 1. Edit content

- `config.js` — name, title, about, photo, contact links, project titles
  + YouTube IDs (the part after `watch?v=`). This drives the AR panels
  AND the printable page's header/QR/footer.
- `print/resume-print.html` — experience bullets, skills, education
  (edit the HTML directly).

### 2. Preview locally

```
npx serve -l 8090 .
```

- Printable page: http://localhost:8090/print/resume-print
- AR view: http://localhost:8090 — camera works on localhost; point your
  webcam at the printed page (or run the phone test in step 5 instead).

### 3. Recompile the tracking target (only if the page's look changed)

1. Open the print page (step 2) and screenshot just the white page area
   (or print it and photograph it flat, straight-on).
2. Go to the MindAR compiler:
   https://hiukim.github.io/mind-ar-js-doc/tools/compile/
3. Upload the image → **Start** → wait → download `targets.mind`.
4. Replace `assets/targets.mind` with it.
5. If the page's proportions changed, set `targetHeight` in `config.js`
   to image height ÷ width (letter portrait ≈ 1.32 with current design).

(Asking Claude Code to "rebuild the AR target and deploy" runs this whole
step + step 4 automatically, including a headless detection test.)

### 4. Deploy

```
git add -A
git commit -m "Update resume"
git push
```

GitHub Pages redeploys `main` automatically in ~30–60 s. Nothing else to
click — Pages is already configured (repo must stay **public**).

### 5. Test on your phone

1. Scan the QR (or open the live site URL) in the phone browser.
2. **Pull down to refresh** — phones cache the old tracking file.
3. Allow camera access.
4. Point at the printed resume (or the print page on your monitor).
   Fill most of the camera view with the page; panels pop in ~1 s.
5. Tap a contact row or project card — it opens the link/video.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| QR → 404 | Repo went private or Pages got disabled. Repo settings: make public, Pages = deploy from `main` / root. |
| Camera never opens | Must be HTTPS (the live URL) or localhost — plain `http://` on a LAN IP won't get camera permission. |
| Scanning forever, no panels | The page in view doesn't match `targets.mind`: refresh the print page on screen AND the AR page on phone; recompile if the design changed. Also: fill the frame, avoid glare, keep the page flat. |
| Panels misaligned with the paper | `targetHeight` in `config.js` doesn't match the target image's aspect ratio. |
| Project cards show gray boxes | YouTube thumbnail failed to load — check the `youtubeId` values. Tap still opens the video. |
| Old content shows on phone | Hard-refresh the phone browser; GitHub Pages also caches ~10 min. |

## File map

- `index.html` — AR scene (MindAR + A-Frame, tap raycaster, glass UI bars).
- `js/app.js` — draws every panel to canvas in the liquid-glass style,
  positions them around the tracked page, wires taps to links. Reads
  everything from `config.js`.
- `config.js` — **the only file to edit for content.**
- `print/resume-print.html` — printable resume; auto-fills name/contacts/
  QR/footer from `config.js`. Doubles as the AR tracking target.
- `assets/targets.mind` — compiled fingerprint of the current print page.
- `assets/demo-target.png` — MindAR's sample card (no longer tracked;
  kept for reference).
