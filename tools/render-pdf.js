// Renders page 1 of a PDF to PNG using pdf.js inside headless Chromium.
// Usage: node render-pdf.js <input.pdf> <output.png>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const [inFile, outFile] = process.argv.slice(2);
  const b64 = fs.readFileSync(path.resolve(inFile)).toString("base64");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({
    url: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  });
  const dataUrl = await page.evaluate(async (b64) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const p = await pdf.getPage(1);
    const viewport = p.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await p.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas.toDataURL("image/png");
  }, b64);
  fs.writeFileSync(
    path.resolve(outFile),
    Buffer.from(dataUrl.split(",")[1], "base64")
  );
  console.log("RENDERED:", outFile);
  await browser.close();
})().catch((e) => { console.error("RENDER_FAILED:", e.message); process.exit(1); });
