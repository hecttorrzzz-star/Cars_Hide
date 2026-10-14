/**
 * Car Hide — 3D Face Filter Engine (Client-Side MediaPipe FaceMesh)
 * Secret transformation engine:
 * - Winner: Ganador Millonario 3D (Gold Aviators, Smoking Cigar, Heavy Cuban Chain, Gold Tan, Cash & Sparkles)
 * - Loser: Payaso Pro 3D (Porcelain foundation, sub-eyebrow Harlequin diamonds, 3D red button nose, organic smile wings)
 */

(function () {
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109
  ];
  const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
  const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

  const NOSE_TIP = 4;
  const NOSE_BRIDGE = 1;
  const NOSE_BOTTOM = 2;
  const LEFT_CHEEK = 117;
  const RIGHT_CHEEK = 346;
  const CHIN = 152;
  const FOREHEAD = 10;
  const LEFT_MOUTH_CORNER = 61;
  const RIGHT_MOUTH_CORNER = 291;

  let faceMeshInstance = null;
  let isFaceMeshReady = false;
  const processedCache = new Map();

  function getFaceMesh() {
    if (faceMeshInstance) return faceMeshInstance;
    if (typeof window.FaceMesh !== 'undefined') {
      try {
        faceMeshInstance = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMeshInstance.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        isFaceMeshReady = true;
      } catch (e) {
        console.warn('[FilterEngine] Error instanciando FaceMesh:', e);
      }
    }
    return faceMeshInstance;
  }

  function generateHeuristicLandmarks() {
    const pts = {};
    const cx = 0.5, cy = 0.45;
    pts[NOSE_TIP] = { x: cx, y: cy + 0.08, z: -0.05 };
    pts[NOSE_BRIDGE] = { x: cx, y: cy + 0.02, z: -0.02 };
    pts[NOSE_BOTTOM] = { x: cx, y: cy + 0.12, z: 0 };
    pts[FOREHEAD] = { x: cx, y: cy - 0.28, z: 0.02 };
    pts[CHIN] = { x: cx, y: cy + 0.38, z: 0 };
    pts[LEFT_CHEEK] = { x: cx - 0.20, y: cy + 0.10, z: 0 };
    pts[RIGHT_CHEEK] = { x: cx + 0.20, y: cy + 0.10, z: 0 };
    pts[159] = { x: cx - 0.13, y: cy - 0.04, z: 0 };
    pts[386] = { x: cx + 0.13, y: cy - 0.04, z: 0 };
    pts[70] = { x: cx - 0.13, y: cy - 0.14, z: 0 };
    pts[300] = { x: cx + 0.13, y: cy - 0.14, z: 0 };
    pts[LEFT_MOUTH_CORNER] = { x: cx - 0.12, y: cy + 0.22, z: 0 };
    pts[RIGHT_MOUTH_CORNER] = { x: cx + 0.12, y: cy + 0.22, z: 0 };
    pts[0] = { x: cx, y: cy + 0.18, z: 0 };
    pts[17] = { x: cx, y: cy + 0.25, z: 0 };

    FACE_OVAL.forEach((idx, i) => {
      const angle = (i / FACE_OVAL.length) * Math.PI * 2;
      pts[idx] = { x: cx + Math.cos(angle) * 0.28, y: cy + Math.sin(angle) * 0.35, z: 0 };
    });
    return pts;
  }

  // ─────────────────────────────────────────────
  // SHADERS & DRAWING FUNCTIONS (PAYASO PRO 3D)
  // ─────────────────────────────────────────────

  function draw3DFaceBaseMask(ctx, pt, pNose, eyeDist, faceHeight, opacity) {
    ctx.save();
    ctx.beginPath();
    const firstPt = pt(FACE_OVAL[0]);
    ctx.moveTo(firstPt.x, firstPt.y);
    for (let i = 1; i < FACE_OVAL.length; i++) {
      const p = pt(FACE_OVAL[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(
      pNose.x, pNose.y - eyeDist * 0.2, eyeDist * 0.2,
      pNose.x, pNose.y, faceHeight * 0.75
    );
    grad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.70})`);
    grad.addColorStop(0.5, `rgba(246, 248, 252, ${opacity * 0.55})`);
    grad.addColorStop(0.85, `rgba(225, 230, 240, ${opacity * 0.35})`);
    grad.addColorStop(1, `rgba(200, 210, 225, 0.0)`);

    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.28})`;
    ctx.fill();
    ctx.restore();
  }

  function drawZygomaticBlush(ctx, leftCheek, rightCheek, eyeDist) {
    const blushRadius = eyeDist * 0.38;
    [leftCheek, rightCheek].forEach(cheek => {
      ctx.save();
      const grad = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, blushRadius);
      grad.addColorStop(0, 'rgba(235, 30, 75, 0.65)');
      grad.addColorStop(0.45, 'rgba(240, 60, 95, 0.38)');
      grad.addColorStop(1, 'rgba(255, 100, 130, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cheek.x, cheek.y, blushRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawEyeTheatrics(ctx, pt, eyeDist, angle) {
    const leftEyeCenter = pt(159);
    const rightEyeCenter = pt(386);
    const leftBrow = pt(70);
    const rightBrow = pt(300);

    const leftBrowDist = Math.hypot(leftBrow.x - leftEyeCenter.x, leftBrow.y - leftEyeCenter.y) || (eyeDist * 0.45);
    const rightBrowDist = Math.hypot(rightBrow.x - rightEyeCenter.x, rightBrow.y - rightEyeCenter.y) || (eyeDist * 0.45);

    const diamondW = eyeDist * 0.22;
    const maxHUpperLeft = Math.min(leftBrowDist * 0.68, eyeDist * 0.32);
    const maxHUpperRight = Math.min(rightBrowDist * 0.68, eyeDist * 0.32);
    const diamondHLower = eyeDist * 0.42;

    const drawDiamond = (center, w, hUp, hDown) => {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, -hUp);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, hDown);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();

      const dGrad = ctx.createLinearGradient(0, -hUp, 0, hDown);
      dGrad.addColorStop(0, '#002B66');
      dGrad.addColorStop(0.3, '#0055D4');
      dGrad.addColorStop(0.7, '#0070F3');
      dGrad.addColorStop(1, '#003380');

      ctx.fillStyle = dGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(1, w * 0.07);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -hUp * 0.4, w * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    drawDiamond(leftEyeCenter, diamondW, maxHUpperLeft, diamondHLower);
    drawDiamond(rightEyeCenter, diamondW, maxHUpperRight, diamondHLower);
  }

  function drawClownSmileAndLips(ctx, pt, eyeDist, angle, smileMult) {
    const leftCorner = pt(LEFT_MOUTH_CORNER);
    const rightCorner = pt(RIGHT_MOUTH_CORNER);
    const upperLipCenter = pt(0);
    const lowerLipCenter = pt(17);
    const mouthCenter = {
      x: (leftCorner.x + rightCorner.x) / 2,
      y: (upperLipCenter.y + lowerLipCenter.y) / 2
    };

    ctx.save();
    ctx.beginPath();
    const firstOut = pt(LIPS_OUTER[0]);
    ctx.moveTo(firstOut.x, firstOut.y);
    for (let i = 1; i < LIPS_OUTER.length; i++) {
      const p = pt(LIPS_OUTER[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    const lipGrad = ctx.createRadialGradient(
      mouthCenter.x, mouthCenter.y, eyeDist * 0.05,
      mouthCenter.x, mouthCenter.y, eyeDist * 0.45
    );
    lipGrad.addColorStop(0, '#FF1A40');
    lipGrad.addColorStop(0.6, '#D60029');
    lipGrad.addColorStop(1, '#8A001A');
    ctx.fillStyle = lipGrad;
    ctx.fill();

    ctx.strokeStyle = '#6B0014';
    ctx.lineWidth = Math.max(1.5, eyeDist * 0.025);
    ctx.stroke();

    // Smile wings
    const wingDist = eyeDist * 0.42 * smileMult;
    const wingUp = eyeDist * 0.28 * smileMult;
    const wingThickness = eyeDist * 0.12 * smileMult;

    const drawWing = (corner, isRight) => {
      const dir = isRight ? 1 : -1;
      const targetX = corner.x + Math.cos(angle) * (wingDist * dir) - Math.sin(angle) * (-wingUp);
      const targetY = corner.y + Math.sin(angle) * (wingDist * dir) + Math.cos(angle) * (-wingUp);
      const cpX = corner.x + Math.cos(angle) * (wingDist * 0.45 * dir);
      const cpY = corner.y + Math.sin(angle) * (wingDist * 0.45 * dir) + Math.cos(angle) * (wingUp * 0.15);

      ctx.beginPath();
      ctx.moveTo(corner.x, corner.y - wingThickness * 0.35);
      ctx.quadraticCurveTo(cpX, cpY - wingThickness * 0.4, targetX, targetY);
      ctx.quadraticCurveTo(cpX, cpY + wingThickness * 0.4, corner.x, corner.y + wingThickness * 0.35);
      ctx.closePath();

      const wGrad = ctx.createLinearGradient(corner.x, corner.y, targetX, targetY);
      wGrad.addColorStop(0, '#D60029');
      wGrad.addColorStop(0.7, '#FF1A40');
      wGrad.addColorStop(1, '#B80020');
      ctx.fillStyle = wGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(targetX, targetY, wingThickness * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#E6002E';
      ctx.fill();
    };

    drawWing(leftCorner, false);
    drawWing(rightCorner, true);
    ctx.restore();
  }

  function draw3DClownNose(ctx, pNoseTip, pNoseBottom, eyeDist, mult) {
    const noseRadius = eyeDist * 0.32 * mult;
    const noseCenter = {
      x: pNoseTip.x,
      y: (pNoseTip.y + pNoseBottom.y) / 2
    };

    ctx.save();
    // Drop shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      noseCenter.x,
      noseCenter.y + noseRadius * 0.65,
      noseRadius * 0.85,
      noseRadius * 0.4,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();

    // 3D sphere gradient
    const lightOffset = { x: -noseRadius * 0.32, y: -noseRadius * 0.32 };
    const sphereGrad = ctx.createRadialGradient(
      noseCenter.x + lightOffset.x,
      noseCenter.y + lightOffset.y,
      noseRadius * 0.05,
      noseCenter.x,
      noseCenter.y,
      noseRadius
    );
    sphereGrad.addColorStop(0, '#FF6B7A');
    sphereGrad.addColorStop(0.2, '#FF1F3D');
    sphereGrad.addColorStop(0.65, '#D40022');
    sphereGrad.addColorStop(0.9, '#8A0014');
    sphereGrad.addColorStop(1, '#4A000A');

    ctx.beginPath();
    ctx.arc(noseCenter.x, noseCenter.y, noseRadius, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(
      noseCenter.x + lightOffset.x * 0.9,
      noseCenter.y + lightOffset.y * 0.9,
      0,
      noseCenter.x + lightOffset.x * 0.9,
      noseCenter.y + lightOffset.y * 0.9,
      noseRadius * 0.3
    );
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    specGrad.addColorStop(0.4, 'rgba(255, 200, 210, 0.6)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(
      noseCenter.x + lightOffset.x * 0.9,
      noseCenter.y + lightOffset.y * 0.9,
      noseRadius * 0.3, 0, Math.PI * 2
    );
    ctx.fillStyle = specGrad;
    ctx.fill();
    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // SHADERS & DRAWING FUNCTIONS (MILLONARIO 3D)
  // ─────────────────────────────────────────────

  function drawMillionaireTanGlow(ctx, pt, pNose, eyeDist, faceHeight) {
    ctx.save();
    ctx.beginPath();
    const firstPt = pt(FACE_OVAL[0]);
    ctx.moveTo(firstPt.x, firstPt.y);
    for (let i = 1; i < FACE_OVAL.length; i++) {
      const p = pt(FACE_OVAL[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    const tanGrad = ctx.createRadialGradient(
      pNose.x, pNose.y, eyeDist * 0.1,
      pNose.x, pNose.y, faceHeight * 0.7
    );
    tanGrad.addColorStop(0, 'rgba(255, 185, 90, 0.42)');
    tanGrad.addColorStop(0.55, 'rgba(220, 140, 50, 0.28)');
    tanGrad.addColorStop(0.85, 'rgba(180, 95, 25, 0.15)');
    tanGrad.addColorStop(1, 'rgba(120, 60, 10, 0)');

    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = tanGrad;
    ctx.fill();

    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255, 205, 110, 0.20)';
    ctx.fill();
    ctx.restore();
  }

  function drawGoldAviatorGlasses(ctx, pt, eyeDist, angle, mult) {
    const leftEye = pt(159);
    const rightEye = pt(386);
    const noseBridge = pt(NOSE_BRIDGE);

    const center = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };

    const glassW = eyeDist * 0.75 * mult;
    const glassH = eyeDist * 0.65 * mult;
    const halfDist = (eyeDist * 0.52);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);

    // Drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.filter = 'blur(6px)';
    [-halfDist, halfDist].forEach(xOff => {
      ctx.beginPath();
      ctx.ellipse(xOff, eyeDist * 0.08, glassW * 0.52, glassH * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Lenses & Frames
    [-halfDist, halfDist].forEach(xOff => {
      ctx.save();
      ctx.translate(xOff, 0);

      // Polarized lens
      ctx.beginPath();
      ctx.moveTo(-glassW * 0.48, -glassH * 0.25);
      ctx.lineTo(glassW * 0.48, -glassH * 0.25);
      ctx.bezierCurveTo(glassW * 0.54, glassH * 0.35, glassW * 0.15, glassH * 0.62, 0, glassH * 0.60);
      ctx.bezierCurveTo(-glassW * 0.15, glassH * 0.62, -glassW * 0.54, glassH * 0.35, -glassW * 0.48, -glassH * 0.25);
      ctx.closePath();

      const lensGrad = ctx.createLinearGradient(0, -glassH * 0.3, 0, glassH * 0.6);
      lensGrad.addColorStop(0, 'rgba(12, 14, 20, 0.96)');
      lensGrad.addColorStop(0.4, 'rgba(28, 32, 45, 0.92)');
      lensGrad.addColorStop(0.7, 'rgba(18, 22, 32, 0.95)');
      lensGrad.addColorStop(1, 'rgba(8, 10, 15, 0.98)');
      ctx.fillStyle = lensGrad;
      ctx.fill();

      // Gleam reflection
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-glassW * 0.3, -glassH * 0.4);
      ctx.lineTo(glassW * 0.1, -glassH * 0.4);
      ctx.lineTo(-glassW * 0.2, glassH * 0.7);
      ctx.lineTo(-glassW * 0.6, glassH * 0.7);
      ctx.closePath();
      const gleamGrad = ctx.createLinearGradient(-glassW * 0.3, -glassH * 0.4, -glassW * 0.2, glassH * 0.7);
      gleamGrad.addColorStop(0, 'rgba(255, 230, 140, 0.45)');
      gleamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.30)');
      gleamGrad.addColorStop(1, 'rgba(255, 215, 0, 0.05)');
      ctx.fillStyle = gleamGrad;
      ctx.fill();
      ctx.restore();

      // Gold wire frame
      ctx.lineWidth = Math.max(2.5, eyeDist * 0.045);
      const goldGrad = ctx.createLinearGradient(-glassW * 0.5, -glassH * 0.3, glassW * 0.5, glassH * 0.6);
      goldGrad.addColorStop(0, '#FFE072');
      goldGrad.addColorStop(0.25, '#D4AF37');
      goldGrad.addColorStop(0.5, '#FFF6A6');
      goldGrad.addColorStop(0.75, '#AA7C11');
      goldGrad.addColorStop(1, '#E6C45E');
      ctx.strokeStyle = goldGrad;
      ctx.stroke();

      ctx.restore();
    });

    // Top double brow bar
    const barY1 = -glassH * 0.26;
    const barY2 = -glassH * 0.36;
    ctx.lineWidth = Math.max(2, eyeDist * 0.038);
    const barGrad = ctx.createLinearGradient(-eyeDist * 0.7, 0, eyeDist * 0.7, 0);
    barGrad.addColorStop(0, '#AA7C11');
    barGrad.addColorStop(0.25, '#FFF6A6');
    barGrad.addColorStop(0.5, '#D4AF37');
    barGrad.addColorStop(0.75, '#FFF6A6');
    barGrad.addColorStop(1, '#AA7C11');
    ctx.strokeStyle = barGrad;

    ctx.beginPath();
    ctx.moveTo(-halfDist * 0.78, barY1);
    ctx.lineTo(halfDist * 0.78, barY1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-halfDist * 0.65, barY2);
    ctx.lineTo(halfDist * 0.65, barY2);
    ctx.stroke();

    ctx.restore();
  }

  function drawSmokingCigar(ctx, pt, eyeDist, angle, mult) {
    const mouthCorner = pt(LEFT_MOUTH_CORNER);
    const chin = pt(CHIN);

    ctx.save();
    ctx.translate(mouthCorner.x, mouthCorner.y);
    const cigarAngle = angle + (25 * Math.PI / 180);
    ctx.rotate(cigarAngle);

    const cigarLength = eyeDist * 1.35 * mult;
    const cigarWidth = eyeDist * 0.22 * mult;
    const x0 = -cigarLength * 0.15;
    const y0 = -cigarWidth * 0.5;

    // Drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.filter = 'blur(5px)';
    ctx.fillRect(x0 + eyeDist * 0.04, y0 + eyeDist * 0.08, cigarLength, cigarWidth);
    ctx.restore();

    // Cigar Body
    ctx.beginPath();
    ctx.roundRect(x0, y0, cigarLength, cigarWidth, cigarWidth * 0.35);
    const cigarGrad = ctx.createLinearGradient(0, y0, 0, y0 + cigarWidth);
    cigarGrad.addColorStop(0, '#3A1F13');
    cigarGrad.addColorStop(0.3, '#613421');
    cigarGrad.addColorStop(0.6, '#4E2818');
    cigarGrad.addColorStop(1, '#24120A');
    ctx.fillStyle = cigarGrad;
    ctx.fill();

    // 24K Gold VIP Band
    const bandX = x0 + cigarLength * 0.42;
    const bandW = cigarLength * 0.22;
    const bandGrad = ctx.createLinearGradient(bandX, 0, bandX + bandW, 0);
    bandGrad.addColorStop(0, '#996515');
    bandGrad.addColorStop(0.3, '#FFD700');
    bandGrad.addColorStop(0.5, '#FFF2A3');
    bandGrad.addColorStop(0.7, '#D4AF37');
    bandGrad.addColorStop(1, '#8A5A00');

    ctx.fillStyle = bandGrad;
    ctx.fillRect(bandX, y0, bandW, cigarWidth);

    ctx.fillStyle = '#1A0F05';
    ctx.font = `bold ${Math.max(8, cigarWidth * 0.45)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIP', bandX + bandW / 2, 0);

    // Glowing ember tip
    const tipX = x0 + cigarLength;
    const emberGrad = ctx.createRadialGradient(tipX, 0, 0, tipX, 0, cigarWidth * 0.9);
    emberGrad.addColorStop(0, '#FFFFFF');
    emberGrad.addColorStop(0.2, '#FFE259');
    emberGrad.addColorStop(0.5, '#FF4500');
    emberGrad.addColorStop(0.85, '#B22222');
    emberGrad.addColorStop(1, 'rgba(70, 20, 10, 0)');

    ctx.beginPath();
    ctx.arc(tipX, 0, cigarWidth * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = emberGrad;
    ctx.fill();

    // Ascending smoke
    ctx.save();
    ctx.translate(tipX, 0);
    ctx.rotate(-cigarAngle);

    for (let s = 1; s <= 4; s++) {
      const sx = Math.sin(s * 1.5) * (cigarWidth * 0.8);
      const sy = -s * (eyeDist * 0.38);
      const sRadius = (cigarWidth * 0.5) + (s * eyeDist * 0.12);
      const sOpacity = Math.max(0, 0.45 - (s * 0.09));

      const smokeGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sRadius);
      smokeGrad.addColorStop(0, `rgba(235, 240, 250, ${sOpacity})`);
      smokeGrad.addColorStop(0.5, `rgba(200, 210, 225, ${sOpacity * 0.6})`);
      smokeGrad.addColorStop(1, 'rgba(180, 190, 210, 0)');

      ctx.beginPath();
      ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctx.fillStyle = smokeGrad;
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawGoldCubanChain(ctx, pt, eyeDist, mult) {
    const chin = pt(CHIN);
    const leftJaw = pt(172);
    const rightJaw = pt(397);

    const startX = leftJaw.x - eyeDist * 0.15;
    const startY = leftJaw.y + eyeDist * 0.15;
    const endX = rightJaw.x + eyeDist * 0.15;
    const endY = rightJaw.y + eyeDist * 0.15;
    const bottomY = chin.y + eyeDist * 0.55 * mult;
    const midX = (startX + endX) / 2;

    const numLinks = 16;
    ctx.save();

    for (let i = 0; i <= numLinks; i++) {
      const t = i / numLinks;
      const lx = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
      const ly = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * bottomY + t * t * endY;

      const linkW = eyeDist * 0.16 * mult;
      const linkH = eyeDist * 0.10 * mult;
      const linkAngle = Math.sin(t * Math.PI) * 0.3;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(linkAngle);

      // Shadow
      ctx.beginPath();
      ctx.ellipse(0, 2, linkW * 0.55, linkH * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
      ctx.fill();

      // Gold link
      ctx.beginPath();
      ctx.ellipse(0, 0, linkW * 0.5, linkH * 0.5, 0, 0, Math.PI * 2);
      const linkGrad = ctx.createLinearGradient(-linkW * 0.5, -linkH * 0.5, linkW * 0.5, linkH * 0.5);
      linkGrad.addColorStop(0, '#AA7C11');
      linkGrad.addColorStop(0.3, '#FFF099');
      linkGrad.addColorStop(0.5, '#FFD700');
      linkGrad.addColorStop(0.7, '#D4AF37');
      linkGrad.addColorStop(1, '#8A5A00');
      ctx.fillStyle = linkGrad;
      ctx.fill();

      ctx.strokeStyle = '#5E3D00';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Sparkle on bottom link
      if (i === Math.floor(numLinks / 2)) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  function drawMillionaireCashRain(ctx, w, h, pt, eyeDist, mult) {
    const bills = [
      { x: w * 0.12, y: h * 0.18, rot: -0.35, scale: 0.85 },
      { x: w * 0.84, y: h * 0.22, rot: 0.42, scale: 0.95 },
      { x: w * 0.08, y: h * 0.72, rot: 0.25, scale: 0.80 },
      { x: w * 0.88, y: h * 0.78, rot: -0.38, scale: 0.90 },
      { x: w * 0.20, y: h * 0.88, rot: -0.15, scale: 0.75 }
    ];

    const sparkles = [
      { x: w * 0.25, y: h * 0.12, size: 14 },
      { x: w * 0.78, y: h * 0.15, size: 18 },
      { x: w * 0.88, y: h * 0.45, size: 12 },
      { x: w * 0.10, y: h * 0.42, size: 16 }
    ];

    ctx.save();
    // 100 Dollar Bills
    bills.forEach(b => {
      const bw = eyeDist * 0.9 * b.scale * mult;
      const bh = bw * 0.48;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(-bw / 2 + 3, -bh / 2 + 4, bw, bh);

      ctx.fillStyle = '#1B4D3E';
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(-bw / 2, -bh / 2, bw, bh);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#85BB65';
      ctx.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw - 4, bh - 4);

      ctx.fillStyle = '#0D2B22';
      ctx.font = `bold ${Math.max(9, bh * 0.42)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$100', 0, 0);

      ctx.restore();
    });

    // Gold Sparkles
    sparkles.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#FFF275';
      const sz = s.size * mult;

      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.quadraticCurveTo(0, 0, sz, 0);
      ctx.quadraticCurveTo(0, 0, 0, sz);
      ctx.quadraticCurveTo(0, 0, -sz, 0);
      ctx.quadraticCurveTo(0, 0, 0, -sz);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // RENDER PIPELINE
  // ─────────────────────────────────────────────

  function renderFilteredFace(sourceImg, landmarks, mode) {
    const offCanvas = document.createElement('canvas');
    const w = sourceImg.naturalWidth || sourceImg.videoWidth || sourceImg.width || 640;
    const h = sourceImg.naturalHeight || sourceImg.videoHeight || sourceImg.height || 640;

    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');

    // Draw original base photo
    ctx.drawImage(sourceImg, 0, 0, w, h);

    const pt = (idx) => {
      const l = landmarks[idx] || { x: 0.5, y: 0.5, z: 0 };
      return { x: l.x * w, y: l.y * h, z: (l.z || 0) * w };
    };

    const pNoseTip = pt(NOSE_TIP);
    const pNoseBridge = pt(NOSE_BRIDGE);
    const pNoseBottom = pt(NOSE_BOTTOM);
    const pForehead = pt(FOREHEAD);
    const pChin = pt(CHIN);
    const pLeftCheek = pt(LEFT_CHEEK);
    const pRightCheek = pt(RIGHT_CHEEK);
    const pLeftEye = pt(159);
    const pRightEye = pt(386);

    const eyeDistance = Math.hypot(pRightEye.x - pLeftEye.x, pRightEye.y - pLeftEye.y) || (w * 0.22);
    const faceHeight = Math.hypot(pChin.x - pForehead.x, pChin.y - pForehead.y) || (h * 0.5);
    const faceAngle = Math.atan2(pRightEye.y - pLeftEye.y, pRightEye.x - pLeftEye.x);

    if (mode === 'millionaire') {
      // WINNER: VIP GANADOR MILLONARIO 3D
      drawMillionaireCashRain(ctx, w, h, pt, eyeDistance, 1.0);
      drawMillionaireTanGlow(ctx, pt, pNoseBridge, eyeDistance, faceHeight);
      drawGoldCubanChain(ctx, pt, eyeDistance, 1.0);
      drawGoldAviatorGlasses(ctx, pt, eyeDistance, faceAngle, 1.0);
      drawSmokingCigar(ctx, pt, eyeDistance, faceAngle, 1.0);
    } else {
      // LOSER: PAYASO PRO 3D
      draw3DFaceBaseMask(ctx, pt, pNoseBridge, eyeDistance, faceHeight, 0.9);
      drawZygomaticBlush(ctx, pLeftCheek, pRightCheek, eyeDistance);
      drawEyeTheatrics(ctx, pt, eyeDistance, faceAngle);
      drawClownSmileAndLips(ctx, pt, eyeDistance, faceAngle, 1.0);
      draw3DClownNose(ctx, pNoseTip, pNoseBottom, eyeDistance, 1.0);
    }

    return offCanvas.toDataURL('image/jpeg', 0.90);
  }

  /**
   * Main Public API
   * @param {string} imageDataUrl - Base64 or URL
   * @param {'millionaire'|'clown'} mode - Target filter
   * @returns {Promise<string>} Transformed base64 image data URL
   */
  async function processFaceFilter(imageDataUrl, mode = 'millionaire') {
    if (!imageDataUrl) return null;
    const cacheKey = `${mode}_${imageDataUrl.slice(0, 60)}_${imageDataUrl.length}`;
    if (processedCache.has(cacheKey)) {
      return processedCache.get(cacheKey);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const fm = getFaceMesh();
          if (fm && isFaceMeshReady) {
            let resolved = false;
            const timeoutId = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                const result = renderFilteredFace(img, generateHeuristicLandmarks(), mode);
                processedCache.set(cacheKey, result);
                resolve(result);
              }
            }, 1800);

            fm.onResults((results) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timeoutId);
              let lms;
              if (results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                lms = results.multiFaceLandmarks[0];
              } else {
                lms = generateHeuristicLandmarks();
              }
              const result = renderFilteredFace(img, lms, mode);
              processedCache.set(cacheKey, result);
              resolve(result);
            });

            await fm.send({ image: img });
          } else {
            // Heuristic fallback
            const result = renderFilteredFace(img, generateHeuristicLandmarks(), mode);
            processedCache.set(cacheKey, result);
            resolve(result);
          }
        } catch (err) {
          console.warn('[FilterEngine] FaceMesh error, applying fallback:', err);
          const result = renderFilteredFace(img, generateHeuristicLandmarks(), mode);
          processedCache.set(cacheKey, result);
          resolve(result);
        }
      };
      img.onerror = () => {
        console.error('[FilterEngine] Error loading image');
        resolve(imageDataUrl);
      };
      img.src = imageDataUrl;
    });
  }

  window.processFaceFilter = processFaceFilter;
  console.log('[FilterEngine] Motor 3D de filtros faciales listo.');
})();
