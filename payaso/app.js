/**
 * Clownify & Millionaire VIP 3D Pro — Face Filter Engine
 * Powered by Google MediaPipe 468-point 3D FaceMesh & Organic Lighting Composite Shading
 * Real-time 3D Contour Deformation + Organic Lighting Fusion + Zero Server Latency
 */

// ─────────────────────────────────────────────
// 1. DOM REFERENCES & CONTROLS
// ─────────────────────────────────────────────
const fileInput          = document.getElementById('file-input');
const dropZone           = document.getElementById('drop-zone');
const dropPrompt         = document.getElementById('drop-prompt');
const canvasContainer    = document.getElementById('canvas-container');
const canvasWrapper      = document.getElementById('canvas-wrapper');
const canvas             = document.getElementById('webgl-canvas') || document.getElementById('output-canvas');
const ctx                = canvas.getContext('2d');
const actionBar          = document.getElementById('action-bar');
const loadingSpinner     = document.getElementById('loading-spinner');
const btnToggleMesh      = document.getElementById('btn-toggle-mesh');
const btnDownload        = document.getElementById('btn-download');
const btnStartCamera     = document.getElementById('btn-start-camera');
const btnSnapshot        = document.getElementById('btn-snapshot');
const videoFeed          = document.getElementById('video-feed');

// Panels
const controlsClown       = document.getElementById('controls-clown');
const controlsMillionaire = document.getElementById('controls-millionaire');

// Clown Sliders
const sliderOpacity      = document.getElementById('slider-opacity');
const sliderNose         = document.getElementById('slider-nose');
const sliderSmile        = document.getElementById('slider-smile');
const valOpacity         = document.getElementById('val-opacity');
const valNose            = document.getElementById('val-nose');
const valSmile           = document.getElementById('val-smile');

// Millionaire Sliders
const sliderGlasses      = document.getElementById('slider-glasses');
const sliderCigar        = document.getElementById('slider-cigar');
const sliderChain        = document.getElementById('slider-chain');
const sliderCash         = document.getElementById('slider-cash');
const valGlasses         = document.getElementById('val-glasses');
const valCigar           = document.getElementById('val-cigar');
const valChain           = document.getElementById('val-chain');
const valCash            = document.getElementById('val-cash');

const toggleBlend        = document.getElementById('toggle-blend');

// ─────────────────────────────────────────────
// 2. STATE MANAGEMENT
// ─────────────────────────────────────────────
let currentSource        = null; // HTMLImageElement or HTMLVideoElement
let currentLandmarks     = null; // Array of 468/478 {x, y, z}
let currentMode          = 'clown'; // 'clown' | 'millionaire'
let show3DMesh           = false;
let isLiveCamera         = false;
let cameraStream         = null;
let animationFrameId     = null;
let faceMeshInstance     = null;
let isModelLoaded        = false;

// ─────────────────────────────────────────────
// 3. MEDIAPIPE FACEMESH LANDMARK INDICES
// ─────────────────────────────────────────────
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

// Key Anchor Points
const NOSE_TIP = 4;
const NOSE_BRIDGE = 1;
const NOSE_BOTTOM = 2;
const LEFT_CHEEK = 117;
const RIGHT_CHEEK = 346;
const CHIN = 152;
const FOREHEAD = 10;
const LEFT_MOUTH_CORNER = 61;
const RIGHT_MOUTH_CORNER = 291;

// ─────────────────────────────────────────────
// 4. INITIALIZE MEDIAPIPE FACEMESH ENGINE
// ─────────────────────────────────────────────
function initFaceMesh() {
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

      faceMeshInstance.onResults(onFaceMeshResults);
      isModelLoaded = true;
      console.log('✅ MediaPipe 3D FaceMesh inicializado');
    } catch (err) {
      console.warn('Error iniciando MediaPipe FaceMesh:', err);
    }
  } else {
    setTimeout(initFaceMesh, 300);
  }
}

// ─────────────────────────────────────────────
// 5. EVENT LISTENERS: UPLOAD & DRAG/DROP
// ─────────────────────────────────────────────
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleImageUpload(file);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleImageUpload(file);
});

function handleImageUpload(file) {
  stopCamera();
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      currentSource = img;
      processStaticImage(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─────────────────────────────────────────────
// 6. PROCESS STATIC IMAGE WITH 3D AI
// ─────────────────────────────────────────────
async function processStaticImage(img) {
  dropPrompt.classList.add('hidden');
  canvasContainer.classList.remove('hidden');
  actionBar.classList.remove('hidden');
  loadingSpinner.classList.remove('hidden');

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  const maxDim = 1600;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  if (faceMeshInstance) {
    try {
      await faceMeshInstance.send({ image: img });
    } catch (err) {
      console.warn('Fallo en inferencia FaceMesh, usando heurística 3D:', err);
      fallbackToAnatomicalHeuristics();
    }
  } else {
    setTimeout(async () => {
      if (faceMeshInstance) {
        await faceMeshInstance.send({ image: img });
      } else {
        fallbackToAnatomicalHeuristics();
      }
    }, 600);
  }
}

// ─────────────────────────────────────────────
// 7. RESULTADOS DEL DETECTOR 3D FACEMESH
// ─────────────────────────────────────────────
function onFaceMeshResults(results) {
  loadingSpinner.classList.add('hidden');

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    currentLandmarks = results.multiFaceLandmarks[0];
  } else if (!isLiveCamera) {
    console.log('Rostro no detectado por IA en esta foto. Aplicando mapeo facial adaptativo.');
    currentLandmarks = generateFallbackLandmarks();
  }

  renderFilter();
}

function fallbackToAnatomicalHeuristics() {
  loadingSpinner.classList.add('hidden');
  currentLandmarks = generateFallbackLandmarks();
  renderFilter();
}

function generateFallbackLandmarks() {
  const pts = [];
  const cx = 0.5, cy = 0.45;
  const fw = 0.38, fh = 0.55;

  for (let i = 0; i < 478; i++) {
    pts.push({ x: cx, y: cy, z: 0 });
  }

  FACE_OVAL.forEach((idx, i) => {
    const ang = (i / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2;
    pts[idx] = { x: cx + Math.cos(ang) * (fw * 0.5), y: cy + Math.sin(ang) * (fh * 0.5), z: 0 };
  });

  pts[NOSE_TIP] = { x: cx, y: cy + 0.05, z: 0 };
  pts[NOSE_BRIDGE] = { x: cx, y: cy - 0.02, z: 0 };
  pts[NOSE_BOTTOM] = { x: cx, y: cy + 0.08, z: 0 };
  pts[CHIN] = { x: cx, y: cy + fh * 0.48, z: 0 };
  pts[FOREHEAD] = { x: cx, y: cy - fh * 0.48, z: 0 };
  pts[LEFT_CHEEK] = { x: cx - fw * 0.28, y: cy + 0.07, z: 0 };
  pts[RIGHT_CHEEK] = { x: cx + fw * 0.28, y: cy + 0.07, z: 0 };

  pts[159] = { x: cx - fw * 0.22, y: cy - 0.08, z: 0 };
  pts[145] = { x: cx - fw * 0.22, y: cy - 0.04, z: 0 };
  pts[386] = { x: cx + fw * 0.22, y: cy - 0.08, z: 0 };
  pts[374] = { x: cx + fw * 0.22, y: cy - 0.04, z: 0 };

  pts[70]  = { x: cx - fw * 0.22, y: cy - 0.16, z: 0 };
  pts[300] = { x: cx + fw * 0.22, y: cy - 0.16, z: 0 };

  pts[LEFT_MOUTH_CORNER] = { x: cx - fw * 0.18, y: cy + 0.22, z: 0 };
  pts[RIGHT_MOUTH_CORNER] = { x: cx + fw * 0.18, y: cy + 0.22, z: 0 };
  pts[0] = { x: cx, y: cy + 0.20, z: 0 };
  pts[17] = { x: cx, y: cy + 0.24, z: 0 };

  return pts;
}

// ─────────────────────────────────────────────
// 8. MOTOR DE RENDERIZADO (DUAL: PAYASO / MILLONARIO)
// ─────────────────────────────────────────────
function renderFilter() {
  if (!currentSource) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Dibujar imagen de fondo original
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(currentSource, 0, 0, w, h);

  if (!currentLandmarks) return;

  const pt = (idx) => {
    const l = currentLandmarks[idx] || { x: 0.5, y: 0.5, z: 0 };
    return { x: l.x * w, y: l.y * h, z: l.z * w };
  };

  const pNoseTip    = pt(NOSE_TIP);
  const pNoseBridge = pt(NOSE_BRIDGE);
  const pNoseBottom = pt(NOSE_BOTTOM);
  const pForehead   = pt(FOREHEAD);
  const pChin       = pt(CHIN);
  const pLeftCheek  = pt(LEFT_CHEEK);
  const pRightCheek = pt(RIGHT_CHEEK);
  const pLeftEye    = pt(159);
  const pRightEye   = pt(386);

  const eyeDistance = Math.hypot(pRightEye.x - pLeftEye.x, pRightEye.y - pLeftEye.y) || (w * 0.22);
  const faceHeight  = Math.hypot(pChin.x - pForehead.x, pChin.y - pForehead.y) || (h * 0.5);
  const faceAngle   = Math.atan2(pRightEye.y - pLeftEye.y, pRightEye.x - pLeftEye.x);

  const useLightingBlend = toggleBlend.checked;

  if (currentMode === 'clown') {
    // ══════════════════════════════════════════════════════
    // MODELO 1: PAYASO PRO 3D
    // ══════════════════════════════════════════════════════
    const opacityVal  = parseFloat(sliderOpacity.value) / 100;
    const noseMult    = parseFloat(sliderNose.value) / 100;
    const smileMult   = parseFloat(sliderSmile.value) / 100;

    // Capa 1: Piel Porcelana
    if (opacityVal > 0.1) {
      draw3DFaceBaseMask(pt, pNoseBridge, eyeDistance, faceHeight, opacityVal, useLightingBlend);
    }
    // Capa 2: Colorete en Pómulos
    drawZygomaticBlush(pLeftCheek, pRightCheek, eyeDistance);
    // Capa 3: Rombos Zafiro bajo las cejas
    drawEyeTheatrics(pt, eyeDistance, faceAngle);
    // Capa 4: Sonrisa ahusada realista
    drawClownSmileAndLips(pt, eyeDistance, faceAngle, smileMult);
    // Capa 5: Nariz 3D esférica
    if (noseMult > 0) {
      draw3DClownNose(pNoseTip, pNoseBottom, eyeDistance, noseMult);
    }

  } else if (currentMode === 'millionaire') {
    // ══════════════════════════════════════════════════════
    // MODELO 2: GANADOR MILLONARIO 3D (VIP CHAMPION)
    // ══════════════════════════════════════════════════════
    const glassesMult = parseFloat(sliderGlasses.value) / 100;
    const cigarMult   = parseFloat(sliderCigar.value) / 100;
    const chainMult   = parseFloat(sliderChain.value) / 100;
    const cashMult    = parseFloat(sliderCash.value) / 100;

    // Capa 1: Lluvia de billetes y brillos en el ambiente
    if (cashMult > 0.1) {
      drawMillionaireCashRain(w, h, pt, eyeDistance, cashMult);
    }

    // Capa 2: Bronceado Dorado VIP
    if (useLightingBlend) {
      drawMillionaireTanGlow(pt, pNoseBridge, eyeDistance, faceHeight);
    }

    // Capa 3: Cadena Cubana de Oro Pesado
    if (chainMult > 0.1) {
      drawGoldCubanChain(pt, eyeDistance, chainMult);
    }

    // Capa 4: Gafas de Sol Aviador de Oro 3D
    if (glassesMult > 0.1) {
      drawGoldAviatorGlasses(pt, eyeDistance, faceAngle, glassesMult);
    }

    // Capa 5: Puro Habano Humeante en la Boca
    if (cigarMult > 0.1) {
      drawSmokingCigar(pt, eyeDistance, faceAngle, cigarMult);
    }
  }

  // Capa 6: Malla 3D Wireframe (Si está activada)
  if (show3DMesh) {
    draw3DWireframeMesh(pt);
  }
}

// ─────────────────────────────────────────────
// 9. SHADERS: MODELO PAYASO PRO 3D
// ─────────────────────────────────────────────

function draw3DFaceBaseMask(pt, pNose, eyeDist, faceHeight, opacity, useBlend) {
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
    pNose.x, pNose.y, faceHeight * 0.65
  );

  grad.addColorStop(0, `rgba(255, 250, 245, ${opacity * 0.88})`);
  grad.addColorStop(0.5, `rgba(245, 240, 235, ${opacity * 0.72})`);
  grad.addColorStop(0.85, `rgba(235, 225, 220, ${opacity * 0.35})`);
  grad.addColorStop(1, 'rgba(235, 225, 220, 0)');

  if (useBlend) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = opacity * 0.45;
    ctx.fillStyle = grad;
    ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

function drawZygomaticBlush(leftCheek, rightCheek, eyeDist) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  const blushRadius = eyeDist * 0.55;
  const blushColor = 'rgba(255, 65, 105, ';

  [leftCheek, rightCheek].forEach(cheek => {
    const grad = ctx.createRadialGradient(
      cheek.x, cheek.y, 0,
      cheek.x, cheek.y, blushRadius
    );
    grad.addColorStop(0, `${blushColor}0.48)`);
    grad.addColorStop(0.4, `${blushColor}0.28)`);
    grad.addColorStop(0.8, `${blushColor}0.08)`);
    grad.addColorStop(1, `${blushColor}0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, blushRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawEyeTheatrics(pt, eyeDist, angle) {
  ctx.save();

  const pLeftTop    = pt(159);
  const pLeftBot    = pt(145);
  const pRightTop   = pt(386);
  const pRightBot   = pt(374);
  const pLeftBrow   = pt(70);
  const pRightBrow  = pt(300);

  const eyeData = [
    { top: pLeftTop, bot: pLeftBot, brow: pLeftBrow },
    { top: pRightTop, bot: pRightBot, brow: pRightBrow }
  ];

  eyeData.forEach(({ top, bot, brow }) => {
    ctx.save();
    const eyeCenterX = (top.x + bot.x) / 2;
    const eyeCenterY = (top.y + bot.y) / 2;

    ctx.translate(eyeCenterX, eyeCenterY);
    ctx.rotate(angle);

    const browDist = Math.hypot(brow.x - eyeCenterX, brow.y - eyeCenterY) || (eyeDist * 0.42);
    const dHeightTop = Math.min(browDist * 0.68, eyeDist * 0.32);
    const dHeightBot = eyeDist * 0.52;
    const dWidth     = eyeDist * 0.13;

    // Rombo Superior
    const gradTop = ctx.createLinearGradient(0, -dHeightTop, 0, 0);
    gradTop.addColorStop(0, '#0052D4');
    gradTop.addColorStop(0.5, '#4364F7');
    gradTop.addColorStop(1, '#6FB1FC');

    ctx.fillStyle = gradTop;
    ctx.beginPath();
    ctx.moveTo(0, -dHeightTop);
    ctx.lineTo(dWidth, -eyeDist * 0.08);
    ctx.lineTo(0, -eyeDist * 0.02);
    ctx.lineTo(-dWidth, -eyeDist * 0.08);
    ctx.closePath();
    ctx.fill();

    // Rombo Inferior
    const gradBot = ctx.createLinearGradient(0, 0, 0, dHeightBot);
    gradBot.addColorStop(0, '#6FB1FC');
    gradBot.addColorStop(0.5, '#4364F7');
    gradBot.addColorStop(1, '#0052D4');

    ctx.fillStyle = gradBot;
    ctx.beginPath();
    ctx.moveTo(0, dHeightBot);
    ctx.lineTo(dWidth, eyeDist * 0.12);
    ctx.lineTo(0, eyeDist * 0.04);
    ctx.lineTo(-dWidth, eyeDist * 0.12);
    ctx.closePath();
    ctx.fill();

    // Destellos
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -dHeightTop * 0.72, eyeDist * 0.02, 0, Math.PI * 2);
    ctx.arc(0, dHeightBot * 0.75, eyeDist * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  ctx.restore();
}

function drawClownSmileAndLips(pt, eyeDist, angle, smileMult) {
  ctx.save();

  const pLeftCorner  = pt(LEFT_MOUTH_CORNER);
  const pRightCorner = pt(RIGHT_MOUTH_CORNER);
  const pMouthTop    = pt(0);
  const pMouthBot    = pt(17);

  // Labios
  ctx.save();
  ctx.beginPath();
  const startLip = pt(LIPS_OUTER[0]);
  ctx.moveTo(startLip.x, startLip.y);
  for (let i = 1; i < LIPS_OUTER.length; i++) {
    const p = pt(LIPS_OUTER[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const startInner = pt(LIPS_INNER[0]);
  ctx.moveTo(startInner.x, startInner.y);
  for (let i = LIPS_INNER.length - 1; i >= 0; i--) {
    const p = pt(LIPS_INNER[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const lipGrad = ctx.createLinearGradient(
    pMouthTop.x, pMouthTop.y,
    pMouthBot.x, pMouthBot.y
  );
  lipGrad.addColorStop(0, '#B80020');
  lipGrad.addColorStop(0.5, '#E6002E');
  lipGrad.addColorStop(1, '#8A0014');
  ctx.fillStyle = lipGrad;
  ctx.fill('evenodd');

  // Gloss
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(
    pMouthBot.x, pMouthBot.y - eyeDist * 0.03,
    eyeDist * 0.16, eyeDist * 0.035,
    angle, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Alas ahusadas
  if (smileMult > 0.1) {
    const mouthWidth = Math.hypot(pRightCorner.x - pLeftCorner.x, pRightCorner.y - pLeftCorner.y);
    const wingLength = mouthWidth * 0.42 * smileMult;
    const wingThickness = eyeDist * 0.075 * smileMult;

    const leftWingTip = {
      x: pLeftCorner.x - Math.cos(angle - 0.22) * wingLength,
      y: pLeftCorner.y - Math.sin(angle - 0.22) * wingLength - eyeDist * 0.06 * smileMult
    };
    const rightWingTip = {
      x: pRightCorner.x + Math.cos(angle + 0.22) * wingLength,
      y: pRightCorner.y + Math.sin(angle + 0.22) * wingLength - eyeDist * 0.06 * smileMult
    };

    ctx.save();

    const wingGradL = ctx.createLinearGradient(
      pLeftCorner.x, pLeftCorner.y,
      leftWingTip.x, leftWingTip.y
    );
    wingGradL.addColorStop(0, '#B80020');
    wingGradL.addColorStop(0.7, '#E6002E');
    wingGradL.addColorStop(1, '#94001A');

    ctx.fillStyle = wingGradL;
    ctx.beginPath();
    ctx.moveTo(pLeftCorner.x, pLeftCorner.y - wingThickness * 0.45);
    ctx.quadraticCurveTo(
      (pLeftCorner.x + leftWingTip.x) / 2, pLeftCorner.y + eyeDist * 0.015,
      leftWingTip.x, leftWingTip.y
    );
    ctx.quadraticCurveTo(
      (pLeftCorner.x + leftWingTip.x) / 2 - eyeDist * 0.015, pLeftCorner.y - eyeDist * 0.035,
      pLeftCorner.x, pLeftCorner.y + wingThickness * 0.45
    );
    ctx.closePath();
    ctx.fill();

    const wingGradR = ctx.createLinearGradient(
      pRightCorner.x, pRightCorner.y,
      rightWingTip.x, rightWingTip.y
    );
    wingGradR.addColorStop(0, '#B80020');
    wingGradR.addColorStop(0.7, '#E6002E');
    wingGradR.addColorStop(1, '#94001A');

    ctx.fillStyle = wingGradR;
    ctx.beginPath();
    ctx.moveTo(pRightCorner.x, pRightCorner.y - wingThickness * 0.45);
    ctx.quadraticCurveTo(
      (pRightCorner.x + rightWingTip.x) / 2, pRightCorner.y + eyeDist * 0.015,
      rightWingTip.x, rightWingTip.y
    );
    ctx.quadraticCurveTo(
      (pRightCorner.x + rightWingTip.x) / 2 + eyeDist * 0.015, pRightCorner.y - eyeDist * 0.035,
      pRightCorner.x, pRightCorner.y + wingThickness * 0.45
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

function draw3DClownNose(pNoseTip, pNoseBottom, eyeDist, mult) {
  const radius = eyeDist * 0.26 * mult;
  if (radius <= 0) return;

  ctx.save();

  // Sombra
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.filter = `blur(${radius * 0.3}px)`;
  ctx.beginPath();
  ctx.ellipse(
    pNoseBottom.x, pNoseBottom.y + radius * 0.2,
    radius * 1.05, radius * 0.45, 0, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Esfera
  const lightOffsetX = -radius * 0.35;
  const lightOffsetY = -radius * 0.35;

  const grad = ctx.createRadialGradient(
    pNoseTip.x + lightOffsetX, pNoseTip.y + lightOffsetY, radius * 0.08,
    pNoseTip.x, pNoseTip.y, radius
  );

  grad.addColorStop(0, '#FF6B8B');
  grad.addColorStop(0.3, '#E60026');
  grad.addColorStop(0.85, '#990014');
  grad.addColorStop(1, '#57000B');

  ctx.beginPath();
  ctx.arc(pNoseTip.x, pNoseTip.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Brillo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(
    pNoseTip.x + lightOffsetX * 0.9,
    pNoseTip.y + lightOffsetY * 0.9,
    radius * 0.22, 0, Math.PI * 2
  );
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────
// 10. SHADERS: MODELO GANADOR MILLONARIO 3D
// ─────────────────────────────────────────────

/**
 * Bronceado Dorado VIP
 */
function drawMillionaireTanGlow(pt, pNose, eyeDist, faceHeight) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';

  const tanGrad = ctx.createRadialGradient(
    pNose.x, pNose.y - eyeDist * 0.1, eyeDist * 0.2,
    pNose.x, pNose.y, faceHeight * 0.7
  );
  tanGrad.addColorStop(0, 'rgba(255, 190, 80, 0.35)');
  tanGrad.addColorStop(0.5, 'rgba(225, 150, 50, 0.22)');
  tanGrad.addColorStop(0.85, 'rgba(180, 110, 30, 0.12)');
  tanGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = tanGrad;
  ctx.beginPath();
  const firstPt = pt(FACE_OVAL[0]);
  ctx.moveTo(firstPt.x, firstPt.y);
  for (let i = 1; i < FACE_OVAL.length; i++) {
    const p = pt(FACE_OVAL[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Gafas de Sol de Aviador de Oro 3D
 */
function drawGoldAviatorGlasses(pt, eyeDist, angle, mult) {
  ctx.save();

  const pLeftEye  = pt(159);
  const pRightEye = pt(386);
  const pBridge   = pt(168);

  const centerX = (pLeftEye.x + pRightEye.x) / 2;
  const centerY = (pLeftEye.y + pRightEye.y) / 2 + eyeDist * 0.05;

  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  const scale = (eyeDist / 120) * mult;
  ctx.scale(scale, scale);

  const lensW = 46;
  const lensH = 38;
  const separation = 38;

  // Sombra de las gafas sobre el rostro
  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  [-separation, separation].forEach(lx => {
    ctx.beginPath();
    ctx.ellipse(lx, 6, lensW, lensH, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Cristales Polarizados Oscuros con Reflejo Especular
  [-separation, separation].forEach(lx => {
    ctx.save();

    // Lente oscura degradada
    const lensGrad = ctx.createLinearGradient(lx, -lensH, lx, lensH);
    lensGrad.addColorStop(0, '#0D0E12');
    lensGrad.addColorStop(0.4, '#1C1E26');
    lensGrad.addColorStop(0.8, '#0B0C10');
    lensGrad.addColorStop(1, '#050608');

    ctx.fillStyle = lensGrad;
    ctx.beginPath();
    ctx.ellipse(lx, 0, lensW, lensH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Reflejo diagonal de luz dorada en el cristal
    const refGrad = ctx.createLinearGradient(lx - 25, -25, lx + 25, 25);
    refGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    refGrad.addColorStop(0.3, 'rgba(255, 220, 130, 0.25)');
    refGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    refGrad.addColorStop(0.7, 'rgba(255, 220, 130, 0.18)');
    refGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = refGrad;
    ctx.beginPath();
    ctx.ellipse(lx, 0, lensW * 0.92, lensH * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Montura de Oro Macizo (Llantas doradas)
  const goldGrad = ctx.createLinearGradient(-80, -30, 80, 30);
  goldGrad.addColorStop(0, '#FFE875');
  goldGrad.addColorStop(0.3, '#FFC72C');
  goldGrad.addColorStop(0.6, '#E5A50A');
  goldGrad.addColorStop(0.85, '#FFD966');
  goldGrad.addColorStop(1, '#996C00');

  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  [-separation, separation].forEach(lx => {
    ctx.beginPath();
    ctx.ellipse(lx, 0, lensW, lensH, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Doble Barra Superior Aviador (Puente de oro característico)
  ctx.beginPath();
  // Barra superior
  ctx.moveTo(-separation + 20, -lensH + 6);
  ctx.lineTo(separation - 20, -lensH + 6);
  // Puente central
  ctx.moveTo(-separation + 32, -4);
  ctx.quadraticCurveTo(0, -8, separation - 32, -4);
  ctx.stroke();

  // Patillas de oro laterales
  ctx.beginPath();
  ctx.moveTo(-separation - lensW + 2, -4);
  ctx.lineTo(-separation - lensW - 35, -12);
  ctx.moveTo(separation + lensW - 2, -4);
  ctx.lineTo(separation + lensW + 35, -12);
  ctx.stroke();

  // Destellos de diamante en las esquinas de la montura
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-separation - lensW + 4, -lensH + 10, 2.5, 0, Math.PI * 2);
  ctx.arc(separation + lensW - 4, -lensH + 10, 2.5, 0, Math.PI * 2);
  ctx.arc(0, -lensH + 6, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Puro Habanero 3D con Brasa y Humo
 */
function drawSmokingCigar(pt, eyeDist, angle, mult) {
  ctx.save();

  const pMouthCorner = pt(LEFT_MOUTH_CORNER);
  const pChin = pt(CHIN);

  ctx.translate(pMouthCorner.x, pMouthCorner.y);
  ctx.rotate(angle - 0.38); // Inclinación natural del puro

  const scale = (eyeDist / 120) * mult;
  ctx.scale(scale, scale);

  const cigarL = 72;
  const cigarW = 14;

  // Sombra del puro
  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(-cigarL, 6, cigarL, cigarW);
  ctx.restore();

  // Cuerpo del Puro (Hojas de tabaco tostado)
  const cigarGrad = ctx.createLinearGradient(-cigarL, 0, 0, 0);
  cigarGrad.addColorStop(0, '#3A1F10');
  cigarGrad.addColorStop(0.3, '#543118');
  cigarGrad.addColorStop(0.7, '#6E4122');
  cigarGrad.addColorStop(1, '#4A2A14');

  ctx.fillStyle = cigarGrad;
  ctx.beginPath();
  ctx.roundRect(-cigarL, -cigarW / 2, cigarL, cigarW, [4, 0, 0, 4]);
  ctx.fill();

  // Vetas de textura de hoja de tabaco
  ctx.strokeStyle = 'rgba(30, 15, 8, 0.45)';
  ctx.lineWidth = 1;
  for (let i = 12; i < cigarL - 10; i += 10) {
    ctx.beginPath();
    ctx.moveTo(-i, -cigarW / 2);
    ctx.lineTo(-i + 6, cigarW / 2);
    ctx.stroke();
  }

  // Vitola / Anillo de Oro VIP ("24K")
  const bandX = -cigarL + 18;
  const bandW = 14;
  const goldBandGrad = ctx.createLinearGradient(bandX, 0, bandX + bandW, 0);
  goldBandGrad.addColorStop(0, '#B38728');
  goldBandGrad.addColorStop(0.5, '#FFE57F');
  goldBandGrad.addColorStop(1, '#996C00');

  ctx.fillStyle = goldBandGrad;
  ctx.fillRect(bandX, -cigarW / 2 - 1, bandW, cigarW + 2);

  ctx.fillStyle = '#111116';
  ctx.fillRect(bandX + 3, -cigarW / 2 + 2, bandW - 6, cigarW - 4);

  ctx.fillStyle = '#FFE57F';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText('VIP', bandX + 3.5, 2.5);

  // Ceniza y Brasa Encendida en la Punta
  const tipX = -cigarL;
  // Ceniza gris
  ctx.fillStyle = '#8E9096';
  ctx.beginPath();
  ctx.arc(tipX, 0, cigarW / 2, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();

  // Brasa incandescente naranja-rojo fuego
  const emberGrad = ctx.createRadialGradient(tipX, 0, 1, tipX, 0, cigarW / 2);
  emberGrad.addColorStop(0, '#FFFFFF');
  emberGrad.addColorStop(0.3, '#FFD000');
  emberGrad.addColorStop(0.6, '#FF3B00');
  emberGrad.addColorStop(1, 'rgba(180, 20, 0, 0.8)');

  ctx.fillStyle = emberGrad;
  ctx.beginPath();
  ctx.ellipse(tipX, 0, 3.5, cigarW / 2 * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Volutas de Humo Elevándose
  ctx.save();
  ctx.strokeStyle = 'rgba(230, 235, 245, 0.35)';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.filter = 'blur(3px)';

  ctx.beginPath();
  ctx.moveTo(tipX - 2, 0);
  ctx.bezierCurveTo(
    tipX - 18, -25,
    tipX + 5, -55,
    tipX - 20, -90
  );
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tipX - 4, 0);
  ctx.bezierCurveTo(
    tipX - 30, -35,
    tipX - 10, -70,
    tipX + 15, -110
  );
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/**
 * Cadena Cubana de Oro Grueso en el Cuello
 */
function drawGoldCubanChain(pt, eyeDist, mult) {
  ctx.save();

  const pChin       = pt(CHIN);
  const pLeftJaw    = pt(148);
  const pRightJaw   = pt(377);
  const pLeftNeck   = pt(172);
  const pRightNeck  = pt(397);

  const chainScale = (eyeDist / 120) * mult;
  const numLinks = 16;

  // Gradiente de oro cubano
  const goldLinkGrad = ctx.createLinearGradient(pLeftJaw.x, pLeftJaw.y, pRightJaw.x, pRightJaw.y);
  goldLinkGrad.addColorStop(0, '#FFE066');
  goldLinkGrad.addColorStop(0.25, '#FFB703');
  goldLinkGrad.addColorStop(0.5, '#F77F00');
  goldLinkGrad.addColorStop(0.75, '#FFB703');
  goldLinkGrad.addColorStop(1, '#FFE066');

  ctx.strokeStyle = goldLinkGrad;
  ctx.lineWidth = 8.5 * chainScale;
  ctx.lineCap = 'round';

  // Sombra de la cadena sobre el cuello
  ctx.save();
  ctx.filter = 'blur(5px)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.moveTo(pLeftNeck.x, pLeftNeck.y + eyeDist * 0.14);
  ctx.quadraticCurveTo(
    pChin.x, pChin.y + eyeDist * 0.45,
    pRightNeck.x, pRightNeck.y + eyeDist * 0.14
  );
  ctx.stroke();
  ctx.restore();

  // Eslabones entrelazados
  ctx.beginPath();
  ctx.moveTo(pLeftNeck.x, pLeftNeck.y + eyeDist * 0.12);
  ctx.quadraticCurveTo(
    pChin.x, pChin.y + eyeDist * 0.42,
    pRightNeck.x, pRightNeck.y + eyeDist * 0.12
  );
  ctx.stroke();

  // Brillos de diamante en la cadena
  ctx.fillStyle = '#FFFFFF';
  [0.2, 0.4, 0.6, 0.8].forEach(t => {
    // Coordenada bezier
    const bx = (1 - t) * (1 - t) * pLeftNeck.x + 2 * (1 - t) * t * pChin.x + t * t * pRightNeck.x;
    const by = (1 - t) * (1 - t) * (pLeftNeck.y + eyeDist * 0.12) + 2 * (1 - t) * t * (pChin.y + eyeDist * 0.42) + t * t * (pRightNeck.y + eyeDist * 0.12);

    ctx.beginPath();
    ctx.arc(bx, by, 3 * chainScale, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Lluvia de Billetes de 100$ y Destellos de Diamante
 */
function drawMillionaireCashRain(w, h, pt, eyeDist, mult) {
  ctx.save();

  // Billetes volando en posiciones estéticas alrededor de la persona
  const bills = [
    { x: w * 0.12, y: h * 0.22, rot: -0.35, s: 0.95 },
    { x: w * 0.86, y: h * 0.18, rot: 0.42, s: 1.05 },
    { x: w * 0.08, y: h * 0.65, rot: 0.25, s: 0.85 },
    { x: w * 0.88, y: h * 0.72, rot: -0.45, s: 1.1 },
    { x: w * 0.25, y: h * 0.88, rot: -0.15, s: 0.8 }
  ];

  bills.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    const bs = b.s * mult * (eyeDist / 120);
    ctx.scale(bs, bs);

    const bW = 68;
    const bH = 34;

    // Sombra del billete
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-bW / 2 + 4, -bH / 2 + 4, bW, bH);

    // Fondo verde billete de dólar
    ctx.fillStyle = '#85BB65';
    ctx.fillRect(-bW / 2, -bH / 2, bW, bH);

    // Borde interior
    ctx.strokeStyle = '#2E5618';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-bW / 2 + 2, -bH / 2 + 2, bW - 4, bH - 4);

    // Círculo central
    ctx.fillStyle = '#E8F5E9';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Símbolo $100
    ctx.fillStyle = '#1B4332';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$100', 0, 0);

    // Esquinas $
    ctx.font = 'bold 6px sans-serif';
    ctx.fillText('100', -bW / 2 + 8, -bH / 2 + 6);
    ctx.fillText('100', bW / 2 - 8, bH / 2 - 6);

    ctx.restore();
  });

  // Destellos de diamante en el aire (Sparkle Stars)
  const sparkles = [
    { x: w * 0.22, y: h * 0.15, r: 8 },
    { x: w * 0.78, y: h * 0.32, r: 10 },
    { x: w * 0.15, y: h * 0.48, r: 7 },
    { x: w * 0.82, y: h * 0.58, r: 9 },
    { x: w * 0.50, y: h * 0.10, r: 11 }
  ];

  sparkles.forEach(sp => {
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const sr = sp.r * mult;

    const spGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sr * 1.5);
    spGrad.addColorStop(0, '#FFFFFF');
    spGrad.addColorStop(0.3, '#FFE57F');
    spGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = spGrad;
    ctx.beginPath();
    ctx.arc(0, 0, sr * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Estrella de 4 puntas brillante
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -sr);
    ctx.quadraticCurveTo(0, 0, sr, 0);
    ctx.quadraticCurveTo(0, 0, 0, sr);
    ctx.quadraticCurveTo(0, 0, -sr, 0);
    ctx.quadraticCurveTo(0, 0, 0, -sr);
    ctx.fill();

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Capa Malla 3D Wireframe Cyberpunk
 */
function draw3DWireframeMesh(pt) {
  ctx.save();
  ctx.strokeStyle = currentMode === 'millionaire' ? 'rgba(255, 193, 7, 0.55)' : 'rgba(0, 210, 255, 0.45)';
  ctx.lineWidth = 1;

  if (window.FACEMESH_TESSELATION) {
    for (const [i, j] of window.FACEMESH_TESSELATION) {
      const p1 = pt(i);
      const p2 = pt(j);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const p1 = pt(FACE_OVAL[i]);
      const p2 = pt(FACE_OVAL[(i + 1) % FACE_OVAL.length]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─────────────────────────────────────────────
// 11. MODO CÁMARA EN VIVO (WEBCAM / SELFIE REAL-TIME)
// ─────────────────────────────────────────────
btnStartCamera.addEventListener('click', async () => {
  if (isLiveCamera) {
    stopCamera();
  } else {
    await startCamera();
  }
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    cameraStream = stream;
    videoFeed.srcObject = stream;
    await videoFeed.play();

    isLiveCamera = true;
    currentSource = videoFeed;

    dropPrompt.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    actionBar.classList.remove('hidden');
    btnSnapshot.classList.remove('hidden');
    btnStartCamera.textContent = 'Detener Cámara';
    btnStartCamera.classList.add('btn-primary');

    canvas.width = videoFeed.videoWidth || 1280;
    canvas.height = videoFeed.videoHeight || 720;

    runLiveLoop();
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Por favor verifica los permisos de tu navegador o usa la subida de fotos.');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  isLiveCamera = false;
  btnStartCamera.textContent = 'Usar Cámara en Vivo';
  btnStartCamera.classList.remove('btn-primary');
  btnSnapshot.classList.add('hidden');
}

async function runLiveLoop() {
  if (!isLiveCamera) return;

  if (faceMeshInstance && videoFeed.readyState >= 2) {
    try {
      await faceMeshInstance.send({ image: videoFeed });
    } catch (e) {
      console.warn('Frame skip:', e);
    }
  }

  animationFrameId = requestAnimationFrame(runLiveLoop);
}

// Capturar foto desde la cámara en vivo
btnSnapshot.addEventListener('click', () => {
  if (!isLiveCamera) return;
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = canvas.width;
  snapCanvas.height = canvas.height;
  const sCtx = snapCanvas.getContext('2d');
  sCtx.drawImage(canvas, 0, 0);

  stopCamera();

  const snapImg = new Image();
  snapImg.onload = () => {
    currentSource = snapImg;
    renderFilter();
  };
  snapImg.src = snapCanvas.toDataURL('image/png');
});

// ─────────────────────────────────────────────
// 12. INTERACCIÓN, SELECTOR DE MODO Y CONTROLES
// ─────────────────────────────────────────────
window.switchMode = function(mode) {
  currentMode = mode;
  document.querySelectorAll('.style-card').forEach(c => {
    c.classList.toggle('active', c.dataset.mode === mode);
  });

  if (mode === 'clown') {
    controlsClown.classList.remove('hidden');
    controlsMillionaire.classList.add('hidden');
  } else {
    controlsClown.classList.add('hidden');
    controlsMillionaire.classList.remove('hidden');
  }

  renderFilter();
};

btnToggleMesh.addEventListener('click', () => {
  show3DMesh = !show3DMesh;
  btnToggleMesh.textContent = show3DMesh ? 'Ocultar Malla 3D' : 'Ver Malla 3D';
  btnToggleMesh.classList.toggle('btn-primary', show3DMesh);
  renderFilter();
});

// Sliders Payaso
sliderOpacity.addEventListener('input', () => {
  valOpacity.textContent = `${sliderOpacity.value}%`;
  renderFilter();
});

sliderNose.addEventListener('input', () => {
  valNose.textContent = `${sliderNose.value}%`;
  renderFilter();
});

sliderSmile.addEventListener('input', () => {
  valSmile.textContent = `${sliderSmile.value}%`;
  renderFilter();
});

// Sliders Millonario
sliderGlasses.addEventListener('input', () => {
  valGlasses.textContent = `${sliderGlasses.value}%`;
  renderFilter();
});

sliderCigar.addEventListener('input', () => {
  valCigar.textContent = `${sliderCigar.value}%`;
  renderFilter();
});

sliderChain.addEventListener('input', () => {
  valChain.textContent = `${sliderChain.value}%`;
  renderFilter();
});

sliderCash.addEventListener('input', () => {
  valCash.textContent = `${sliderCash.value}%`;
  renderFilter();
});

toggleBlend.addEventListener('change', renderFilter);

// Descargar resultado en alta resolución
btnDownload.addEventListener('click', () => {
  if (!currentSource) return;
  const a = document.createElement('a');
  a.download = `${currentMode}-3d-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});

// Arrancar motor MediaPipe
initFaceMesh();

// ─────────────────────────────────────────────
// 9. SHADERS Y CAPAS VISUALES REALISTAS
// ─────────────────────────────────────────────

/**
 * Capa 1: Piel Teatral de Porcelana
 */
function draw3DFaceBaseMask(pt, pNose, eyeDist, faceHeight, opacity, useBlend) {
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
    pNose.x, pNose.y, faceHeight * 0.65
  );

  grad.addColorStop(0, `rgba(255, 250, 245, ${opacity * 0.88})`);
  grad.addColorStop(0.5, `rgba(245, 240, 235, ${opacity * 0.72})`);
  grad.addColorStop(0.85, `rgba(235, 225, 220, ${opacity * 0.35})`);
  grad.addColorStop(1, 'rgba(235, 225, 220, 0)');

  if (useBlend) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = opacity * 0.45;
    ctx.fillStyle = grad;
    ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Capa 2: Colorete / Rouge en Pómulos
 */
function drawZygomaticBlush(leftCheek, rightCheek, eyeDist) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  const blushRadius = eyeDist * 0.55;
  const blushColor = 'rgba(255, 65, 105, ';

  [leftCheek, rightCheek].forEach(cheek => {
    const grad = ctx.createRadialGradient(
      cheek.x, cheek.y, 0,
      cheek.x, cheek.y, blushRadius
    );
    grad.addColorStop(0, `${blushColor}0.48)`);
    grad.addColorStop(0.4, `${blushColor}0.28)`);
    grad.addColorStop(0.8, `${blushColor}0.08)`);
    grad.addColorStop(1, `${blushColor}0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, blushRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Capa 3: Rombos Zafiro POR DEBAJO de las cejas
 */
function drawEyeTheatrics(pt, eyeDist, angle) {
  ctx.save();

  const pLeftTop    = pt(159);
  const pLeftBot    = pt(145);
  const pRightTop   = pt(386);
  const pRightBot   = pt(374);
  const pLeftBrow   = pt(70);
  const pRightBrow  = pt(300);

  const eyeData = [
    { top: pLeftTop, bot: pLeftBot, brow: pLeftBrow },
    { top: pRightTop, bot: pRightBot, brow: pRightBrow }
  ];

  eyeData.forEach(({ top, bot, brow }) => {
    ctx.save();
    const eyeCenterX = (top.x + bot.x) / 2;
    const eyeCenterY = (top.y + bot.y) / 2;

    ctx.translate(eyeCenterX, eyeCenterY);
    ctx.rotate(angle);

    // Altura calculada para que el vértice superior quede estrictamente POR DEBAJO de la ceja
    const browDist = Math.hypot(brow.x - eyeCenterX, brow.y - eyeCenterY) || (eyeDist * 0.42);
    const dHeightTop = Math.min(browDist * 0.68, eyeDist * 0.32);
    const dHeightBot = eyeDist * 0.52;
    const dWidth     = eyeDist * 0.13;

    // Rombo Superior (Bajo la ceja, sobre el párpado superior)
    const gradTop = ctx.createLinearGradient(0, -dHeightTop, 0, 0);
    gradTop.addColorStop(0, '#0052D4');
    gradTop.addColorStop(0.5, '#4364F7');
    gradTop.addColorStop(1, '#6FB1FC');

    ctx.fillStyle = gradTop;
    ctx.beginPath();
    ctx.moveTo(0, -dHeightTop);
    ctx.lineTo(dWidth, -eyeDist * 0.08);
    ctx.lineTo(0, -eyeDist * 0.02);
    ctx.lineTo(-dWidth, -eyeDist * 0.08);
    ctx.closePath();
    ctx.fill();

    // Rombo Inferior (Hacia el pómulo)
    const gradBot = ctx.createLinearGradient(0, 0, 0, dHeightBot);
    gradBot.addColorStop(0, '#6FB1FC');
    gradBot.addColorStop(0.5, '#4364F7');
    gradBot.addColorStop(1, '#0052D4');

    ctx.fillStyle = gradBot;
    ctx.beginPath();
    ctx.moveTo(0, dHeightBot);
    ctx.lineTo(dWidth, eyeDist * 0.12);
    ctx.lineTo(0, eyeDist * 0.04);
    ctx.lineTo(-dWidth, eyeDist * 0.12);
    ctx.closePath();
    ctx.fill();

    // Destellos cristalinos especulares
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -dHeightTop * 0.72, eyeDist * 0.02, 0, Math.PI * 2);
    ctx.arc(0, dHeightBot * 0.75, eyeDist * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Capa 4: Labios y Sonrisa Teatral Realista y Ahusada
 */
function drawClownSmileAndLips(pt, eyeDist, angle, smileMult) {
  ctx.save();

  const pLeftCorner  = pt(LEFT_MOUTH_CORNER);
  const pRightCorner = pt(RIGHT_MOUTH_CORNER);
  const pMouthTop    = pt(0);
  const pMouthBot    = pt(17);

  // 1. Relleno anatómico de labios (preserva los dientes)
  ctx.save();
  ctx.beginPath();
  const startLip = pt(LIPS_OUTER[0]);
  ctx.moveTo(startLip.x, startLip.y);
  for (let i = 1; i < LIPS_OUTER.length; i++) {
    const p = pt(LIPS_OUTER[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const startInner = pt(LIPS_INNER[0]);
  ctx.moveTo(startInner.x, startInner.y);
  for (let i = LIPS_INNER.length - 1; i >= 0; i--) {
    const p = pt(LIPS_INNER[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const lipGrad = ctx.createLinearGradient(
    pMouthTop.x, pMouthTop.y,
    pMouthBot.x, pMouthBot.y
  );
  lipGrad.addColorStop(0, '#B80020');
  lipGrad.addColorStop(0.5, '#E6002E');
  lipGrad.addColorStop(1, '#8A0014');
  ctx.fillStyle = lipGrad;
  ctx.fill('evenodd');

  // Brillo gloss labial suave en el labio inferior
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(
    pMouthBot.x, pMouthBot.y - eyeDist * 0.03,
    eyeDist * 0.16, eyeDist * 0.035,
    angle, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // 2. Extensión de sonrisa ahusada y orgánica (Tapered Wings)
  if (smileMult > 0.1) {
    const mouthWidth = Math.hypot(pRightCorner.x - pLeftCorner.x, pRightCorner.y - pLeftCorner.y);
    const wingLength = mouthWidth * 0.42 * smileMult;
    const wingThickness = eyeDist * 0.075 * smileMult;

    const leftWingTip = {
      x: pLeftCorner.x - Math.cos(angle - 0.22) * wingLength,
      y: pLeftCorner.y - Math.sin(angle - 0.22) * wingLength - eyeDist * 0.06 * smileMult
    };
    const rightWingTip = {
      x: pRightCorner.x + Math.cos(angle + 0.22) * wingLength,
      y: pRightCorner.y + Math.sin(angle + 0.22) * wingLength - eyeDist * 0.06 * smileMult
    };

    ctx.save();

    // Ala izquierda
    const wingGradL = ctx.createLinearGradient(
      pLeftCorner.x, pLeftCorner.y,
      leftWingTip.x, leftWingTip.y
    );
    wingGradL.addColorStop(0, '#B80020');
    wingGradL.addColorStop(0.7, '#E6002E');
    wingGradL.addColorStop(1, '#94001A');

    ctx.fillStyle = wingGradL;
    ctx.beginPath();
    ctx.moveTo(pLeftCorner.x, pLeftCorner.y - wingThickness * 0.45);
    ctx.quadraticCurveTo(
      (pLeftCorner.x + leftWingTip.x) / 2, pLeftCorner.y + eyeDist * 0.015,
      leftWingTip.x, leftWingTip.y
    );
    ctx.quadraticCurveTo(
      (pLeftCorner.x + leftWingTip.x) / 2 - eyeDist * 0.015, pLeftCorner.y - eyeDist * 0.035,
      pLeftCorner.x, pLeftCorner.y + wingThickness * 0.45
    );
    ctx.closePath();
    ctx.fill();

    // Ala derecha
    const wingGradR = ctx.createLinearGradient(
      pRightCorner.x, pRightCorner.y,
      rightWingTip.x, rightWingTip.y
    );
    wingGradR.addColorStop(0, '#B80020');
    wingGradR.addColorStop(0.7, '#E6002E');
    wingGradR.addColorStop(1, '#94001A');

    ctx.fillStyle = wingGradR;
    ctx.beginPath();
    ctx.moveTo(pRightCorner.x, pRightCorner.y - wingThickness * 0.45);
    ctx.quadraticCurveTo(
      (pRightCorner.x + rightWingTip.x) / 2, pRightCorner.y + eyeDist * 0.015,
      rightWingTip.x, rightWingTip.y
    );
    ctx.quadraticCurveTo(
      (pRightCorner.x + rightWingTip.x) / 2 + eyeDist * 0.015, pRightCorner.y - eyeDist * 0.035,
      pRightCorner.x, pRightCorner.y + wingThickness * 0.45
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Capa 5: Nariz 3D Esférica con Iluminación Realista & Sombra Proyectada
 */
function draw3DClownNose(pNoseTip, pNoseBottom, eyeDist, mult) {
  const radius = eyeDist * 0.26 * mult;
  if (radius <= 0) return;

  ctx.save();

  // 1. Sombra suave proyectada bajo la nariz
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.filter = `blur(${radius * 0.3}px)`;
  ctx.beginPath();
  ctx.ellipse(
    pNoseBottom.x, pNoseBottom.y + radius * 0.2,
    radius * 1.05, radius * 0.45, 0, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // 2. Esfera 3D con sombreado de luz clave (Top-Left)
  const lightOffsetX = -radius * 0.35;
  const lightOffsetY = -radius * 0.35;

  const grad = ctx.createRadialGradient(
    pNoseTip.x + lightOffsetX, pNoseTip.y + lightOffsetY, radius * 0.08,
    pNoseTip.x, pNoseTip.y, radius
  );

  grad.addColorStop(0, '#FF6B8B');
  grad.addColorStop(0.3, '#E60026');
  grad.addColorStop(0.85, '#990014');
  grad.addColorStop(1, '#57000B');

  ctx.beginPath();
  ctx.arc(pNoseTip.x, pNoseTip.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 3. Brillo Especular Nítido (Efecto botón pulido / gloss)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(
    pNoseTip.x + lightOffsetX * 0.9,
    pNoseTip.y + lightOffsetY * 0.9,
    radius * 0.22, 0, Math.PI * 2
  );
  ctx.fill();

  ctx.restore();
}

/**
 * Capa 6: Malla 3D Wireframe Cyberpunk
 */
function draw3DWireframeMesh(pt) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
  ctx.lineWidth = 1;

  if (window.FACEMESH_TESSELATION) {
    for (const [i, j] of window.FACEMESH_TESSELATION) {
      const p1 = pt(i);
      const p2 = pt(j);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const p1 = pt(FACE_OVAL[i]);
      const p2 = pt(FACE_OVAL[(i + 1) % FACE_OVAL.length]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─────────────────────────────────────────────
// 10. MODO CÁMARA EN VIVO (WEBCAM / SELFIE REAL-TIME)
// ─────────────────────────────────────────────
btnStartCamera.addEventListener('click', async () => {
  if (isLiveCamera) {
    stopCamera();
  } else {
    await startCamera();
  }
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    cameraStream = stream;
    videoFeed.srcObject = stream;
    await videoFeed.play();

    isLiveCamera = true;
    currentSource = videoFeed;

    dropPrompt.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    actionBar.classList.remove('hidden');
    btnSnapshot.classList.remove('hidden');
    btnStartCamera.textContent = 'Detener Cámara';
    btnStartCamera.classList.add('btn-primary');

    canvas.width = videoFeed.videoWidth || 1280;
    canvas.height = videoFeed.videoHeight || 720;

    runLiveLoop();
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Por favor verifica los permisos de tu navegador o usa la subida de fotos.');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  isLiveCamera = false;
  btnStartCamera.textContent = 'Usar Cámara en Vivo';
  btnStartCamera.classList.remove('btn-primary');
  btnSnapshot.classList.add('hidden');
}

async function runLiveLoop() {
  if (!isLiveCamera) return;

  if (faceMeshInstance && videoFeed.readyState >= 2) {
    try {
      await faceMeshInstance.send({ image: videoFeed });
    } catch (e) {
      console.warn('Frame skip:', e);
    }
  }

  animationFrameId = requestAnimationFrame(runLiveLoop);
}

// Capturar foto desde la cámara en vivo
btnSnapshot.addEventListener('click', () => {
  if (!isLiveCamera) return;
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = canvas.width;
  snapCanvas.height = canvas.height;
  const sCtx = snapCanvas.getContext('2d');
  sCtx.drawImage(canvas, 0, 0);

  stopCamera();

  const snapImg = new Image();
  snapImg.onload = () => {
    currentSource = snapImg;
    renderFilter();
  };
  snapImg.src = snapCanvas.toDataURL('image/png');
});

// ─────────────────────────────────────────────
// 11. INTERACCIÓN Y CONTROLES
// ─────────────────────────────────────────────
btnToggleMesh.addEventListener('click', () => {
  show3DMesh = !show3DMesh;
  btnToggleMesh.textContent = show3DMesh ? 'Ocultar Malla 3D' : 'Ver Malla 3D';
  btnToggleMesh.classList.toggle('btn-primary', show3DMesh);
  renderFilter();
});

sliderOpacity.addEventListener('input', () => {
  valOpacity.textContent = `${sliderOpacity.value}%`;
  renderFilter();
});

sliderNose.addEventListener('input', () => {
  valNose.textContent = `${sliderNose.value}%`;
  renderFilter();
});

sliderSmile.addEventListener('input', () => {
  valSmile.textContent = `${sliderSmile.value}%`;
  renderFilter();
});

toggleBlend.addEventListener('change', renderFilter);

// Descargar resultado en alta resolución
btnDownload.addEventListener('click', () => {
  if (!currentSource) return;
  const a = document.createElement('a');
  a.download = `payaso-3d-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});

// Arrancar motor MediaPipe
initFaceMesh();
