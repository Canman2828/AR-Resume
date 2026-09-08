/* ============================================================
   AR Resume — scene builder
   Reads AR_CONFIG (config.js) and builds liquid-glass panels
   around the tracked resume. No need to edit this file for
   normal customization — edit config.js instead.
   ============================================================ */

(function () {
  const PX = 1024; // canvas pixels per AR world unit (text sharpness)

  // ---- palette: white + gray accent -------------------------
  const INK = "#1f2937"; // near-black text
  const GRAY = "#6b7280"; // gray accent
  const GRAY_LIGHT = "#9ca3af";

  // ---------- canvas helpers ---------------------------------
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Liquid-glass background: translucent white gradient, bright
  // hairline border, soft top sheen.
  function drawGlass(ctx, w, h, radius) {
    const r = radius !== undefined ? radius : Math.min(w, h) * 0.14;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,255,255,0.82)");
    grad.addColorStop(1, "rgba(235,238,243,0.62)");
    roundRectPath(ctx, 3, 3, w - 6, h - 6, r);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
    // top sheen
    ctx.save();
    roundRectPath(ctx, 3, 3, w - 6, h - 6, r);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    sheen.addColorStop(0, "rgba(255,255,255,0.55)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h * 0.45);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(/\s+/);
    let line = "";
    let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        if (maxLines && lines === maxLines - 1) {
          ctx.fillText(line.replace(/\s+$/, "") + "…", x, y);
          return;
        }
        ctx.fillText(line, x, y);
        line = words[i];
        y += lineHeight;
        lines++;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  }

  function makeCanvas(wUnits, hUnits) {
    const c = document.createElement("canvas");
    c.width = Math.round(wUnits * PX);
    c.height = Math.round(hUnits * PX);
    return c;
  }

  // ---------- scene plumbing ---------------------------------
  const anchor = document.getElementById("anchor");
  const textureContainer = document.createElement("div");
  textureContainer.hidden = true;
  document.body.appendChild(textureContainer);
  let zBump = 0.01;

  function addPlane(canvas, wUnits, hUnits, x, y, url) {
    const el = document.createElement("a-image");
    // A-Frame accepts canvases directly: avoid PNG encoding and decoding
    // every panel before it can be uploaded to the GPU.
    canvas.id = `ar-panel-texture-${textureContainer.childElementCount}`;
    textureContainer.appendChild(canvas);
    el.setAttribute("src", `#${canvas.id}`);
    el.setAttribute("width", wUnits);
    el.setAttribute("height", hUnits);
    el.setAttribute("position", `${x} ${y} ${zBump}`);
    el.setAttribute("material", "transparent: true; alphaTest: 0.01");
    zBump += 0.002;
    if (url) {
      el.classList.add("clickable");
      el.addEventListener("click", () => window.open(url, "_blank"));
    }
    anchor.appendChild(el);
    return el;
  }

  // Stack items vertically, centered on the target's vertical middle.
  function stackColumn(x, items, gap) {
    const total =
      items.reduce((s, it) => s + it.h, 0) + gap * (items.length - 1);
    let top = total / 2;
    for (const it of items) {
      it.el = addPlane(it.canvas, it.w, it.h, x, top - it.h / 2, it.url);
      top -= it.h + gap;
    }
  }

  function updatePanel(panel, content) {
    const ctx = panel.canvas.getContext("2d");
    ctx.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
    ctx.drawImage(content.canvas, 0, 0);
    const mesh = panel.el.getObject3D("mesh");
    if (mesh && mesh.material.map) mesh.material.map.needsUpdate = true;
  }

  // ---------- panel builders ---------------------------------
  function buildNameHeader() {
    const w = 1.0, h = 0.2;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    drawGlass(ctx, c.width, c.height, 60);
    ctx.fillStyle = INK;
    ctx.font = `700 ${PX * 0.075}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(AR_CONFIG.name, c.width / 2, c.height * 0.47);
    ctx.fillStyle = GRAY;
    ctx.font = `400 ${PX * 0.048}px "Segoe UI", sans-serif`;
    ctx.fillText(AR_CONFIG.title, c.width / 2, c.height * 0.8);
    return { canvas: c, w, h };
  }

  function buildFrame(targetH) {
    const w = 1.08, h = targetH + 0.08;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    roundRectPath(ctx, 5, 5, c.width - 10, c.height - 10, 40);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(156,163,175,0.6)";
    ctx.stroke();
    return { canvas: c, w, h };
  }

  function buildPhoto(img) {
    const s = 0.3;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    const cx = c.width / 2, r = c.width / 2 - 8;
    // glass ring
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, r - 14, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      // cover-fit the photo inside the circle
      const d = (r - 14) * 2;
      const scale = Math.max(d / img.width, d / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, cx - iw / 2, cx - ih / 2, iw, ih);
    } else {
      // placeholder avatar
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = GRAY_LIGHT;
      ctx.beginPath();
      ctx.arc(cx, cx - c.width * 0.04, c.width * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cx + c.width * 0.36, c.width * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return { canvas: c, w: s, h: s };
  }

  function buildAbout() {
    const w = 0.54, h = 0.42;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    drawGlass(ctx, c.width, c.height);
    ctx.fillStyle = INK;
    ctx.font = `700 ${PX * 0.045}px "Segoe UI", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("About", 44, 84);
    ctx.fillStyle = "#374151";
    ctx.font = `400 ${PX * 0.033}px "Segoe UI", sans-serif`;
    wrapText(ctx, AR_CONFIG.about, 44, 150, c.width - 88, PX * 0.046, 6);
    return { canvas: c, w, h };
  }

  function buildSectionHeader(text, w) {
    const h = 0.12;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    drawGlass(ctx, c.width, c.height, 50);
    ctx.fillStyle = INK;
    ctx.font = `700 ${PX * 0.045}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + 4);
    return { canvas: c, w, h };
  }

  function buildContactRow(contact) {
    const w = 0.54, h = 0.115;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    drawGlass(ctx, c.width, c.height, 46);
    // gray accent dot
    ctx.fillStyle = GRAY;
    ctx.beginPath();
    ctx.arc(58, c.height / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `600 ${PX * 0.038}px "Segoe UI", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(contact.label, 96, c.height / 2 + 3);
    // little arrow to imply tappable
    ctx.fillStyle = GRAY_LIGHT;
    ctx.font = `600 ${PX * 0.038}px "Segoe UI", sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("›", c.width - 48, c.height / 2 + 3);
    return { canvas: c, w, h, url: contact.url };
  }

  function buildProjectCard(project, thumb) {
    const w = 0.62, h = 0.42;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    drawGlass(ctx, c.width, c.height, 44);
    // thumbnail area (16:9) inside the glass
    const pad = 26;
    const tw = c.width - pad * 2;
    const th = tw * 9 / 16;
    ctx.save();
    roundRectPath(ctx, pad, pad, tw, th, 30);
    ctx.clip();
    if (thumb) {
      ctx.drawImage(thumb, pad, pad, tw, th);
    } else {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(pad, pad, tw, th);
    }
    // darken slightly so the play button reads
    ctx.fillStyle = "rgba(31,41,55,0.18)";
    ctx.fillRect(pad, pad, tw, th);
    ctx.restore();
    // play button
    const pcx = c.width / 2, pcy = pad + th / 2, pr = 46;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GRAY;
    ctx.beginPath();
    ctx.moveTo(pcx - 13, pcy - 20);
    ctx.lineTo(pcx + 22, pcy);
    ctx.lineTo(pcx - 13, pcy + 20);
    ctx.closePath();
    ctx.fill();
    // title
    ctx.fillStyle = INK;
    ctx.font = `600 ${PX * 0.036}px "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(project.title, c.width / 2, pad + th + (c.height - pad - th) / 2);
    return {
      canvas: c, w, h,
      url: `https://www.youtube.com/watch?v=${project.youtubeId}`,
    };
  }

  // ---------- async image loaders ----------------------------
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      const finish = (result) => {
        clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
        if (!result) img.removeAttribute("src");
        resolve(result);
      };
      // Optional images should never leave a request waiting indefinitely.
      const timeout = setTimeout(() => finish(null), 8000);
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = src;
    });
  }

  // A thumbnail only counts if it survives a canvas readback
  // (i.e. wasn't CORS-tainted); otherwise fall back to the plain card.
  function safeThumb(img) {
    if (!img) return null;
    try {
      const t = document.createElement("canvas");
      t.width = 2; t.height = 2;
      const tc = t.getContext("2d");
      tc.drawImage(img, 0, 0, 2, 2);
      t.toDataURL();
      return img;
    } catch (e) {
      return null;
    }
  }

  // ---------- build the scene --------------------------------
  function init() {
    document.getElementById("topbar-name").textContent =
      AR_CONFIG.name + " — AR Resume";

    const scene = document.querySelector("a-scene");
    const hint = document.getElementById("startup-hint");
    scene.addEventListener("arReady", () => {
      hint.textContent = "Point your camera at the resume";
    });
    scene.addEventListener("arError", (event) => {
      hint.textContent = event.detail.error === "TRACKING_FAIL"
        ? "AR could not start. Reload to try again."
        : "Camera unavailable. Allow access and reload.";
    });

    const H = AR_CONFIG.targetHeight;

    // center: name header above the physical resume + glass frame around it
    const header = buildNameHeader();
    addPlane(header.canvas, header.w, header.h, 0, H / 2 + header.h / 2 + 0.05);
    const frame = buildFrame(H);
    addPlane(frame.canvas, frame.w, frame.h, 0, 0);

    // left column: photo, about, contacts
    const leftItems = [
      buildPhoto(null),
      buildAbout(),
      buildSectionHeader("Contacts", 0.54),
      ...AR_CONFIG.contacts.map(buildContactRow),
    ];
    stackColumn(-0.85, leftItems, 0.045);

    // Build every panel immediately; optional images fill in independently.
    const rightItems = [
      buildSectionHeader("Highlighted Projects", 0.62),
      ...AR_CONFIG.projects.map((p) => buildProjectCard(p, null)),
    ];
    stackColumn(0.89, rightItems, 0.05);

    // Show panels at full size as soon as tracking succeeds. Reacquiring
    // the paper should not restart a pop-in animation or repeat the hint.
    const toast = document.getElementById("toast");
    anchor.addEventListener("targetFound", () => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3500);
    }, { once: true });

    // A-Frame waits for document.readyState === "complete". Starting Image
    // requests earlier can delay that event and prevent the camera starting.
    scene.addEventListener("renderstart", () => {
      if (AR_CONFIG.photo) {
        loadImage(AR_CONFIG.photo).then((img) => {
          const photo = safeThumb(img);
          if (photo) updatePanel(leftItems[0], buildPhoto(photo));
        });
      }
      AR_CONFIG.projects.forEach((project, i) => {
        loadImage(`https://i.ytimg.com/vi/${project.youtubeId}/mqdefault.jpg`)
          .then((img) => {
            const thumb = safeThumb(img);
            if (thumb) updatePanel(rightItems[i + 1], buildProjectCard(project, thumb));
          });
      });
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
