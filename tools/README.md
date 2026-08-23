# AR build & test pipeline

Node scripts that automate everything the README's manual steps describe.
They were built and used to ship the current live version.

**One-time setup** (in this `tools/` folder):

```
npm init -y
npm i playwright pdf-lib qrcode
npx playwright install chromium
```

`ffmpeg` must be on PATH (it is, via winget).

## Scripts

| Script | What it does |
|---|---|
| `render-pdf.js in.pdf out.png` | Renders PDF page 1 to PNG (pdf.js in headless Chromium). |
| `pdf-coords.js file.pdf` | Prints y/x coordinates of text items — used to place stamps precisely. |
| `stamp-chips-only.js` | Loads `user-version.pdf` (the resume with the QR already on it), adds dark chips behind the five section headings → `user-chips.pdf`. **This is the deployed design.** |
| `stamp-qr.js` | Older full-restyle variant (dark header band + photo + chips) from `resume-original.pdf` → `resume-ar.pdf`. Kept for reference. |
| `compile.js [image.png]` | Drives the MindAR online compiler headless: uploads the image, downloads `targets.mind`. Without an argument it screenshots `localhost:8090/print/resume-print` instead. |
| `drive.js` | Headless end-to-end AR test: serves a fake camera (`camera.y4m`), loads `localhost:8090`, reports `TARGET_FOUND`, taps a panel, reports the opened URL and console errors. |

## Full rebuild flow (when the printed resume changes)

```bash
node stamp-chips-only.js                 # or edit + restamp however needed
node render-pdf.js user-chips.pdf user-chips.png
node compile.js user-chips.png
cp targets.mind ../assets/targets.mind
# fake camera feed for the detection test (true rotation only — vflip
# alone mirrors the image and silently breaks detection):
ffmpeg -y -loop 1 -i user-chips.png -t 2 -r 15 \
  -vf "scale=-1:700,pad=960:720:(ow-iw)/2:(oh-ih)/2:gray" \
  -pix_fmt yuv420p camera.y4m
npx serve -l 8090 ..                     # in another terminal
node drive.js                            # expect TARGET_FOUND: true
git add -A && git commit -m "..." && git push
```

Hard-won rule: plain resume text never detects — keep the section-heading
chips (or equivalent large dark shapes spread down the page) on any redesign,
and re-verify with `drive.js` before printing.
