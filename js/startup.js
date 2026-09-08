/* Camera startup adapter for the pinned MindAR 1.2.5 A-Frame integration.
   Keep tracking, projection and target detection in MindAR. This component
   only supplies camera preferences and measures its existing startup steps. */
AFRAME.registerComponent("resume-camera", {
  dependencies: ["mindar-image"],

  init: function () {
    const scene = this.el;
    const system = scene.systems["mindar-image-system"];
    const timings = { version: "camera-v2" };
    // Local diagnostics only; no camera images or timing data are uploaded.
    window.AR_STARTUP_TIMINGS = timings;
    const debug = new URLSearchParams(location.search).get("debug") === "startup";
    const output = debug ? document.createElement("pre") : null;
    if (output) {
      output.id = "startup-debug";
      output.setAttribute("role", "status");
      output.style.cssText = "position:fixed;bottom:8px;left:8px;right:8px;z-index:10000;" +
        "padding:12px;margin:0;border-radius:8px;background:#111e;color:white;" +
        "font:12px/1.5 monospace;white-space:pre-wrap;pointer-events:none";
      document.body.appendChild(output);
    }
    const showTimings = () => {
      if (!output) return;
      output.textContent = "Startup diagnostics (camera-v2)\n" +
        Object.entries(timings).filter(([key]) => key !== "version")
          .map(([key, value]) => `${key}: ${typeof value === "number" ? Math.round(value) + " ms" : value}`)
          .join("\n");
    };
    const hint = (text) => {
      document.getElementById("startup-hint").textContent = text;
    };
    showTimings();
    let trackingReady;
    scene.addEventListener("arReady", () => {
      trackingReady = performance.now();
    }, { once: true });
    scene.addEventListener("targetFound", () => {
      if (trackingReady !== undefined) {
        timings["First recognition after ready"] = performance.now() - trackingReady;
        showTimings();
      }
    }, { once: true });

    // MindAR uses unrestricted camera dimensions by default. Prefer VGA
    // frames to reduce tracking work on devices that otherwise choose HD.
    // Ideal constraints let browsers fall back to supported camera modes.
    system._startVideo = function () {
      const video = document.createElement("video");
      this.video = video;
      video.autoplay = true;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.style.cssText = "position:absolute;top:0;left:0;z-index:-2";
      this.container.appendChild(video);
      hint("Starting camera…");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.el.emit("arError", { error: "VIDEO_FAIL" });
        this.ui.showCompatibility();
        return;
      }
      const cameraRequested = performance.now();
      // VGA by default keeps tracking fast on low-end phones. A sharper feed
      // gives a steadier pose (less jitter) at some CPU cost — try it on-device
      // with ?camW=1280&camH=720 before committing to it as a default.
      const camParams = new URLSearchParams(location.search);
      const camW = parseInt(camParams.get("camW"), 10) || 640;
      const camH = parseInt(camParams.get("camH"), 10) || 480;
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          width: { ideal: camW },
          height: { ideal: camH },
          frameRate: { ideal: 30 },
        },
      }).then((stream) => {
        const streamReady = performance.now();
        timings["Camera request (includes permission)"] = streamReady - cameraRequested;
        video.addEventListener("loadedmetadata", () => {
          timings["Video ready"] = performance.now() - streamReady;
          timings["Camera resolution"] = `${video.videoWidth} × ${video.videoHeight}`;
          video.setAttribute("width", video.videoWidth);
          video.setAttribute("height", video.videoHeight);
          hint("Preparing AR tracking…");
          showTimings();
          this._startAR().then(() => {
            timings["Ready after camera opened"] = performance.now() - streamReady;
            const targetURL = new URL(this.imageTargetSrc, location.href).href;
            const target = performance.getEntriesByName(targetURL).at(-1);
            if (target) timings["Target download"] = target.duration;
            showTimings();
          }).catch((error) => {
            this.controller?.stopProcessVideo();
            stream.getTracks().forEach((track) => track.stop());
            this.ui.hideLoading();
            this.el.emit("arError", { error: "TRACKING_FAIL" });
            timings.Error = "Tracking could not start";
            showTimings();
            console.error("AR tracking startup failed", error);
          });
        }, { once: true });
        video.srcObject = stream;
      }).catch((error) => {
        this.ui.hideLoading();
        this.el.emit("arError", { error: "VIDEO_FAIL" });
        timings.Error = error.name || "Camera unavailable";
        showTimings();
      });
    };

    const startAR = system._startAR;
    system._startAR = async function () {
      const start = performance.now();
      // The pinned implementation creates its controller synchronously, then
      // awaits target loading before calling dummyRun. Instrument that one
      // controller rather than modifying the browser or library prototypes.
      const pending = startAR.call(this);
      const controller = this.controller;
      if (controller) {
        const dummyRun = controller.dummyRun;
        controller.dummyRun = function (input) {
          timings["Tracking setup"] = performance.now() - start;
          const warmupStart = performance.now();
          try {
            return dummyRun.call(this, input);
          } finally {
            timings["GPU warm-up"] = performance.now() - warmupStart;
            controller.dummyRun = dummyRun;
          }
        };
      }
      await pending;
    };
  },
});
