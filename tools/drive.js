const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const y4m = path.join(__dirname, "camera.y4m");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${y4m}`,
    ],
  });
  const ctx = await browser.newContext({
    permissions: ["camera"],
    viewport: { width: 900, height: 700 },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(u); return null; };
  });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:8090/", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(__dirname, "shot1-scanning.png") });

  // wait up to 20s for MindAR to detect the target (anchor becomes visible)
  let found = false;
  for (let i = 0; i < 20; i++) {
    found = await page.evaluate(() => {
      const a = document.querySelector("#anchor");
      return !!(a && a.object3D && a.object3D.visible);
    });
    if (found) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(4000); // let the pop-in animation finish
  await page.screenshot({ path: path.join(__dirname, "shot2-detected.png") });

  console.log("TARGET_FOUND:", found);

  // tap a clickable panel at its real projected screen position and
  // confirm its link would open (window.open is stubbed by init script)
  let hit = null;
  outer:
  for (let gx = 60; gx <= 840; gx += 60) {
    for (let gy = 80; gy <= 660; gy += 60) {
      await page.mouse.move(gx, gy);
      await page.waitForTimeout(120);
      const over = await page.evaluate(() => {
        const cam = document.querySelector("a-camera");
        const els = cam.components.raycaster.intersectedEls;
        return els && els.length ? els[0].className : null;
      });
      if (over) { hit = { x: gx, y: gy, over }; break outer; }
    }
  }
  console.log("RAYCAST_HIT:", JSON.stringify(hit));
  if (hit) {
    await page.mouse.click(hit.x, hit.y);
    await page.waitForTimeout(1000);
  }
  console.log("TAP_OPENED:", await page.evaluate(() => window.__opened));

  console.log("CONSOLE_ERRORS:", errors.length ? JSON.stringify(errors, null, 2) : "none");
  await browser.close();
})().catch((e) => {
  console.error("DRIVER_FAILED:", e);
  process.exit(1);
});
