/* ============================================================
   AR Resume — pose stabilizer
   ------------------------------------------------------------
   MindAR's One Euro filter (filterMinCF / filterBeta in the HTML)
   depends on each camera's noise level, so "smooth on my phone"
   does not guarantee "smooth on a recruiter's phone". This adds a
   second, device-independent stage on top of MindAR's output:

     • Adaptive damping — when the page barely moves, the panels
       follow only a small fraction (minAlpha) of each noisy pose
       update, so jitter amplitude is cut by a FIXED ratio no matter
       how noisy the camera is. When the page really moves, the
       fraction ramps up to maxAlpha so tracking stays snappy (no lag).
     • Dead-band — below a tiny position/rotation threshold the pose
       is frozen outright, so a page lying still is rock steady.

   It works by wrapping the anchor's mindar-image-target.updateWorldMatrix,
   which the MindAR system calls once per processed frame. The original
   target/found/lost event behaviour is preserved for app.js + startup.js.

   Tune live on-device (no rebuild) with query params, e.g.
     ?minA=0.04&maxA=0.85&pdz=0.003&rdz=0.25&pr=0.02&rr=4
   Set ?stabilize=off to bypass this stage entirely (raw MindAR pose).
   ============================================================ */
AFRAME.registerComponent("pose-stabilizer", {
  // Ensure MindAR's target component exists (and set matrixAutoUpdate=false)
  // before we wrap its updateWorldMatrix.
  dependencies: ["mindar-image-target"],

  schema: {
    // Follow fraction per update when essentially still. Small = heavy
    // damping = steady, at the cost of a little smoothing lag.
    minAlpha: { default: 0.05 },
    // Follow fraction when clearly moving. Near 1 = snap to the page.
    maxAlpha: { default: 0.85 },
    // Below this position change (world units, 1 ≈ target width) freeze.
    positionDeadzone: { default: 0.003 },
    // Below this rotation change (degrees) freeze.
    rotationDeadzone: { default: 0.25 },
    // Position change (beyond the dead-band) that reaches maxAlpha.
    positionResponse: { default: 0.02 },
    // Rotation change in degrees (beyond the dead-band) that reaches maxAlpha.
    rotationResponse: { default: 4 },
  },

  init: function () {
    const THREE = AFRAME.THREE;
    const params = new URLSearchParams(location.search);
    if (params.get("stabilize") === "off") return;

    // Let URL params override any schema value for on-device tuning.
    const override = (key, name) => {
      const raw = params.get(name);
      if (raw !== null && !isNaN(parseFloat(raw))) this.data[key] = parseFloat(raw);
    };
    override("minAlpha", "minA");
    override("maxAlpha", "maxA");
    override("positionDeadzone", "pdz");
    override("rotationDeadzone", "rdz");
    override("positionResponse", "pr");
    override("rotationResponse", "rr");

    const target = this.el.components["mindar-image-target"];
    if (!target) return; // dependency guarantees this, but stay defensive.

    const data = this.data;
    const el = this.el;
    const hasPose = { value: false };
    const dispPos = new THREE.Vector3();
    const dispQuat = new THREE.Quaternion();
    const dispScale = new THREE.Vector3(1, 1, 1);
    const inPos = new THREE.Vector3();
    const inQuat = new THREE.Quaternion();
    const inScale = new THREE.Vector3(1, 1, 1);
    const mat = new THREE.Matrix4();

    const original = target.updateWorldMatrix.bind(target);

    target.updateWorldMatrix = function (worldMatrix) {
      // Lost / miss: reuse MindAR's own logic (emits targetLost, hides).
      // Next reacquisition snaps straight to the fresh pose (no lag-in).
      if (worldMatrix === null) {
        hasPose.value = false;
        return original(null);
      }

      // Reconstruct the same matrix MindAR would apply (pose * postMatrix),
      // then split it into position / rotation / scale we can smooth.
      mat.fromArray(worldMatrix).multiply(target.postMatrix);
      mat.decompose(inPos, inQuat, inScale);

      if (!hasPose.value) {
        dispPos.copy(inPos);
        dispQuat.copy(inQuat);
        dispScale.copy(inScale);
        hasPose.value = true;
      } else {
        const dPos = inPos.distanceTo(dispPos);
        const dRot = (dispQuat.angleTo(inQuat) * 180) / Math.PI;
        const posActive = dPos - data.positionDeadzone;
        const rotActive = dRot - data.rotationDeadzone;

        if (posActive > 0 || rotActive > 0) {
          // Ramp the follow fraction with whichever axis is moving most.
          const posT = data.positionResponse > 0
            ? Math.min(Math.max(posActive / data.positionResponse, 0), 1) : 1;
          const rotT = data.rotationResponse > 0
            ? Math.min(Math.max(rotActive / data.rotationResponse, 0), 1) : 1;
          const t = Math.max(posT, rotT);
          const alpha = data.minAlpha + (data.maxAlpha - data.minAlpha) * t;
          dispPos.lerp(inPos, alpha);
          dispQuat.slerp(inQuat, alpha);
          dispScale.lerp(inScale, alpha);
        }
        // else: inside the dead-band → hold the displayed pose (freeze).
      }

      // Mirror MindAR's found/update event semantics for the rest of the app.
      const wasVisible = el.object3D.visible;
      el.emit("targetUpdate");
      if (!wasVisible) el.emit("targetFound");
      el.object3D.visible = true;
      el.object3D.matrix.compose(dispPos, dispQuat, dispScale);
    };
  },
});
