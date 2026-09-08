/* ============================================================
   AR Resume — pose stabilizer (One Euro, per-axis)
   ------------------------------------------------------------
   Goal: the AR panels must sit rock-steady on a still page on ANY
   phone, yet track smoothly when the page is moved.

   MindAR already runs a One Euro filter, but on the 16 raw matrix
   elements — which couples rotation nonlinearly and leaves visible
   wobble. This stage runs a proper One Euro filter on the DECOMPOSED
   pose (3 position axes + 4 quaternion components), which is the
   right space to smooth in.

   Why One Euro (and not a dead-band / speed gate): camera jitter is
   zero-mean, so its *signed* per-axis velocity averages to ~0. One
   Euro low-passes that signed velocity, so at rest the cutoff stays
   low → heavy smoothing → jitter is crushed; during a real move the
   velocity is sustained → cutoff rises → the panels follow with no
   lag. Crucially a low-pass can never AMPLIFY noise, so this behaves
   safely regardless of how noisy a given camera is.

   A tiny output dead-band on the already-smoothed pose removes the
   last residual so a stationary page is visually frozen, without the
   random-walk a dead-band on the raw pose would cause.

   Wraps the anchor's mindar-image-target.updateWorldMatrix (called
   once per processed frame) and preserves its targetFound /
   targetLost / targetUpdate events for app.js + startup.js.

   Tune / debug live on-device (no rebuild) via query params:
     ?minCutoff=0.4&beta=6&dCutoff=1&deadband=0.004
     ?debug=jitter   → show live cutoff/speed in the header
     ?stabilize=off  → bypass this stage entirely (raw MindAR pose)
   ============================================================ */
AFRAME.registerComponent("pose-stabilizer", {
  dependencies: ["mindar-image-target"],

  schema: {
    // Cutoff (Hz) when the page is still. Lower = steadier, slightly laggier.
    // Balanced default: steady at rest without noticeable lag when moved.
    minCutoff: { default: 0.3 },
    // How fast the cutoff opens up with motion. Higher = snappier when moving.
    beta: { default: 8 },
    // Cutoff (Hz) for the internal velocity estimate. 1 Hz is the standard.
    dCutoff: { default: 1.0 },
    // Output dead-band (world units, 1 ≈ target width). This is a HARD, device-
    // independent cap on residual shake: below it the smoothed pose is held, so
    // a still page cannot wobble more than ~this much regardless of camera noise.
    deadband: { default: 0.006 },
    // Weight turning a rotation (radians) into an equivalent edge shift, used
    // only for the dead-band comparison.
    lever: { default: 1.0 },
  },

  init: function () {
    const THREE = AFRAME.THREE;
    const params = new URLSearchParams(location.search);
    if (params.get("stabilize") === "off") return;

    Object.keys(this.schema).forEach((key) => {
      const raw = params.get(key);
      if (raw !== null && !isNaN(parseFloat(raw))) this.data[key] = parseFloat(raw);
    });
    const debug = params.get("debug") === "jitter";

    const target = this.el.components["mindar-image-target"];
    if (!target) return;

    const data = this.data;
    const el = this.el;

    // --- One Euro filter for a single scalar channel ------------------------
    const alpha = (dt, cutoff) => {
      const r = 2 * Math.PI * cutoff * dt;
      return r / (r + 1);
    };
    function makeChannel() {
      return { x: 0, dx: 0, started: false };
    }
    function filterChannel(ch, value, dt) {
      if (!ch.started) { ch.x = value; ch.dx = 0; ch.started = true; return value; }
      const dxRaw = (value - ch.x) / dt;
      // Low-pass the SIGNED velocity so zero-mean jitter averages toward 0.
      ch.dx = ch.dx + alpha(dt, data.dCutoff) * (dxRaw - ch.dx);
      const cutoff = data.minCutoff + data.beta * Math.abs(ch.dx);
      ch.x = ch.x + alpha(dt, cutoff) * (value - ch.x);
      return ch.x;
    }

    const posCh = [makeChannel(), makeChannel(), makeChannel()];
    const quatCh = [makeChannel(), makeChannel(), makeChannel(), makeChannel()];

    // Working objects.
    const inPos = new THREE.Vector3();
    const inQuat = new THREE.Quaternion();
    const inScale = new THREE.Vector3(1, 1, 1);
    const filtPos = new THREE.Vector3();
    const filtQuat = new THREE.Quaternion();
    const outPos = new THREE.Vector3();
    const outQuat = new THREE.Quaternion();
    const outScale = new THREE.Vector3(1, 1, 1);
    const mat = new THREE.Matrix4();

    let started = false;
    let lastT = 0;
    let prevQuatArr = [0, 0, 0, 1];

    // Rolling RMS of how much the DISPLAYED pose still moves — i.e. the shake
    // you actually see. Hold the page still and read this number to tune.
    const prevOut = new THREE.Vector3();
    let havePrevOut = false;
    let shakeRms = 0;
    const showDebug = (dt) => {
      if (!debug) return;
      const step = havePrevOut ? outPos.distanceTo(prevOut) : 0;
      prevOut.copy(outPos); havePrevOut = true;
      shakeRms += 0.1 * (step - shakeRms);
      const hint = document.getElementById("startup-hint");
      const speed = Math.hypot(posCh[0].dx, posCh[1].dx, posCh[2].dx);
      if (hint) hint.textContent =
        `shake ${shakeRms.toFixed(4)} | vel ${speed.toFixed(3)} | cutoff ${(data.minCutoff + data.beta * speed).toFixed(1)}Hz`;
    };

    const original = target.updateWorldMatrix.bind(target);

    target.updateWorldMatrix = function (worldMatrix) {
      if (worldMatrix === null) {
        // Reset so reacquisition snaps straight to the fresh pose (no lag-in).
        started = false;
        posCh.forEach((c) => (c.started = false));
        quatCh.forEach((c) => (c.started = false));
        return original(null);
      }

      mat.fromArray(worldMatrix).multiply(target.postMatrix);
      mat.decompose(inPos, inQuat, inScale);

      const now = performance.now();
      let dt = started ? (now - lastT) / 1000 : 1 / 30;
      if (!(dt > 0)) dt = 1 / 30;
      dt = Math.min(dt, 0.1); // guard against long stalls (tab hidden, etc.)
      lastT = now;

      // Keep the quaternion on the same hemisphere as the previous sample so
      // component-wise filtering interpolates the short way, not the long way.
      const q = [inQuat.x, inQuat.y, inQuat.z, inQuat.w];
      const dot = q[0] * prevQuatArr[0] + q[1] * prevQuatArr[1] + q[2] * prevQuatArr[2] + q[3] * prevQuatArr[3];
      if (dot < 0) for (let i = 0; i < 4; i++) q[i] = -q[i];

      filtPos.set(
        filterChannel(posCh[0], inPos.x, dt),
        filterChannel(posCh[1], inPos.y, dt),
        filterChannel(posCh[2], inPos.z, dt)
      );
      const fq = [
        filterChannel(quatCh[0], q[0], dt),
        filterChannel(quatCh[1], q[1], dt),
        filterChannel(quatCh[2], q[2], dt),
        filterChannel(quatCh[3], q[3], dt),
      ];
      prevQuatArr = q;
      filtQuat.set(fq[0], fq[1], fq[2], fq[3]).normalize();

      if (!started) {
        outPos.copy(filtPos); outQuat.copy(filtQuat); outScale.copy(inScale);
        started = true;
      } else {
        // Output dead-band: only move the panels if the smoothed pose has
        // shifted enough to matter, so residual sub-pixel wobble is frozen out.
        const dev = filtPos.distanceTo(outPos) + outQuat.angleTo(filtQuat) * data.lever;
        if (dev > data.deadband) {
          outPos.copy(filtPos);
          outQuat.copy(filtQuat);
          outScale.copy(inScale);
        }
      }

      el.object3D.matrix.compose(outPos, outQuat, outScale);
      showDebug(dt);

      const wasVisible = el.object3D.visible;
      el.emit("targetUpdate");
      if (!wasVisible) el.emit("targetFound");
      el.object3D.visible = true;
    };
  },
});
