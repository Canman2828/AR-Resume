const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1500 },
    deviceScaleFactor: 2,
  });

  // 1) target image: either given as argv[2], or captured from the
  //    printable resume page
  let targetImg = process.argv[2] && path.resolve(process.argv[2]);
  if (targetImg) {
    console.log("USING_IMAGE:", targetImg);
  } else {
    await page.goto("http://localhost:8090/print/resume-print", {
      waitUntil: "networkidle",
    });
    const el = page.locator(".page");
    const box = await el.boundingBox();
    console.log("PAGE_BOX:", JSON.stringify(box));
    targetImg = path.join(__dirname, "resume-target.png");
    await el.screenshot({ path: targetImg });
  }

  // 2) drive the MindAR online compiler
  const comp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await comp.goto("https://hiukim.github.io/mind-ar-js-doc/tools/compile/", {
    waitUntil: "networkidle",
  });
  // discover the controls
  const inputs = await comp.locator("input[type=file]").count();
  const buttons = await comp.locator("button").allTextContents();
  console.log("FILE_INPUTS:", inputs, "BUTTONS:", JSON.stringify(buttons));

  await comp.locator("input[type=file]").first().setInputFiles(targetImg);
  await comp.waitForTimeout(2000);
  const buttons2 = await comp.locator("button").allTextContents();
  console.log("BUTTONS_AFTER_UPLOAD:", JSON.stringify(buttons2));

  await comp.getByRole("button", { name: /start/i }).click();
  console.log("COMPILING...");

  // wait for the download control to appear (compile can take a while)
  const dlButton = comp.getByRole("button", { name: /download/i });
  await dlButton.waitFor({ state: "visible", timeout: 240000 });
  const [download] = await Promise.all([
    comp.waitForEvent("download", { timeout: 60000 }),
    dlButton.click(),
  ]);
  const out = path.join(__dirname, "targets.mind");
  await download.saveAs(out);
  console.log("SAVED:", out, "as", download.suggestedFilename());

  await browser.close();
})().catch((e) => {
  console.error("COMPILE_FAILED:", e.message);
  process.exit(1);
});
