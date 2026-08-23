# AR Resume

Scan a QR code on a printed resume → the phone opens this site → point the
camera at the resume → liquid-glass AR panels float around the paper:

```
                     ┌──────────────────────┐
 (photo)             │  Resume        [QR]  │   Highlighted Projects
 ┌────────┐          │  ~~~~~~~~~~~~~~~~    │   ┌────────────────┐
 │ About  │          │  ~~~~~~~~~~~~~~~~    │   │ YouTube video  │
 └────────┘          │  ~~~~~~~~~~~~~~~~    │   ├────────────────┤
 ┌────────┐          │  ~~~~~~~~~~~~~~~~    │   │ YouTube video  │
 │Contacts│          │  (physical paper)    │   ├────────────────┤
 │LinkedIn│          │                      │   │ YouTube video  │
 │GitHub  │          │                      │   └────────────────┘
 │Website │          └──────────────────────┘
 └────────┘
```

Built with [MindAR](https://hiukim.github.io/mind-ar-js-doc/) image tracking +
A-Frame, inspired by [AR_Business_Card](https://github.com/Quinxie51/AR_Business_Card).
Pure static site — no build step, no server code.

## Try it right now (demo target)

The repo ships with MindAR's sample target so it works before you customize
anything:

1. Serve the folder locally (camera access needs localhost or HTTPS):
   ```
   npx serve .        # or: python -m http.server 8080
   ```
2. Open `http://localhost:3000` on the same machine, allow the camera.
3. Point the camera at `assets/demo-target.png` opened on another screen (or
   printed). The glass panels pop in around it.

On a phone, easiest is to deploy first (step 5) and open the live URL.

## Make it yours

### 1. Edit `config.js`

Everything lives there: name, title, about text, photo, contact links,
project titles + YouTube video IDs, and your deployed site URL.

### 2. Print your resume

Open `print/resume-print.html` in a browser — it fills in your name/links from
`config.js` and generates the QR code (pointing at `siteUrl`). Edit the
experience/skills sections in that file directly, then print it (Letter size).

### 3. Compile your tracking target

The AR engine needs a fingerprint (`.mind` file) of what the camera should
recognize — your printed resume:

1. Screenshot or photograph the final resume page straight-on.
2. Go to the [MindAR image compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile/).
3. Upload the image, click **Start**, download `targets.mind`.
4. Replace `assets/targets.mind` with it.
5. In `config.js`, set `targetHeight: 1.294` (letter portrait) so the panels
   line up with the paper.

Tip: visually busy resumes (headshot, section rules, the QR code itself) track
much better than sparse white pages.

### 4. (Optional) add your photo

Drop `profile.jpg` into `assets/` and set `photo: "assets/profile.jpg"` in
`config.js`.

### 5. Deploy to GitHub Pages

```
git add -A && git commit -m "Customize AR resume" && git push
```

Then on GitHub: **Settings → Pages → Source: main branch, / (root)**.
Your site goes live at `https://<username>.github.io/AR-Resume/` — make sure
`siteUrl` in `config.js` matches, and reprint if the QR changed.

## How it works

- `index.html` — A-Frame scene with MindAR image tracking; camera feed +
  anchored 3D content, tap-to-open raycaster.
- `js/app.js` — renders each panel (About, Contacts, project cards) to a
  canvas with a liquid-glass style (translucent white gradient, hairline
  border, top sheen), textures them onto planes around the tracked target,
  and wires up taps: contact rows open your links, project cards open their
  YouTube videos. Thumbnails are pulled from `i.ytimg.com` automatically.
- `config.js` — the only file you need to edit for content.
- `print/resume-print.html` — printable resume + QR generator; the printed
  page doubles as the AR tracking target.
