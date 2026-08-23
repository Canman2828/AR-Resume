// Prints y-coordinates (PDF space, origin bottom-left) of text in the
// top region of page 1. Usage: node pdf-coords.js <file.pdf>
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const b64 = fs.readFileSync(process.argv[2]).toString("base64");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({
    url: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  });
  const items = await page.evaluate(async (b64) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const p = await pdf.getPage(1);
    const tc = await p.getTextContent();
    return tc.items
      .filter((i) => i.str.trim() && true)
      .map((i) => ({ y: Math.round(i.transform[5]), x: Math.round(i.transform[4]), h: Math.round(i.height), s: i.str.slice(0, 45) }));
  }, b64);
  items.sort((a, b) => b.y - a.y);
  for (const it of items) console.log(`y=${it.y} h=${it.h} x=${it.x}  ${it.s}`);
  await browser.close();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
