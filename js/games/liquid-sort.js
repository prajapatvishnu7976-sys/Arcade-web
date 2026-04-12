// liquid-sort.js - Premium Liquid Sort Game v3.0
// Fullscreen Button | Tall Premium Tubes | Color Swipe Animation

(function () {
  "use strict";

  // ==================== CONSTANTS ====================

  const COLORS = [
    { hex: "#FF2244", name: "Red",      light: "#FF6677", dark: "#AA0022", glow: "rgba(255,34,68,0.4)" },
    { hex: "#00EE66", name: "Green",    light: "#66FFaa", dark: "#007733", glow: "rgba(0,238,102,0.4)" },
    { hex: "#1166FF", name: "Blue",     light: "#66AAFF", dark: "#003399", glow: "rgba(17,102,255,0.4)" },
    { hex: "#FFD700", name: "Yellow",   light: "#FFE866", dark: "#AA8800", glow: "rgba(255,215,0,0.4)" },
    { hex: "#DD00FF", name: "Magenta",  light: "#EE77FF", dark: "#880099", glow: "rgba(221,0,255,0.4)" },
    { hex: "#00EEFF", name: "Cyan",     light: "#77FFFF", dark: "#007788", glow: "rgba(0,238,255,0.4)" },
    { hex: "#FF7700", name: "Orange",   light: "#FFAA44", dark: "#993300", glow: "rgba(255,119,0,0.4)" },
    { hex: "#9900FF", name: "Purple",   light: "#CC66FF", dark: "#550099", glow: "rgba(153,0,255,0.4)" },
    { hex: "#FF0099", name: "Pink",     light: "#FF66CC", dark: "#990055", glow: "rgba(255,0,153,0.4)" },
    { hex: "#00FFAA", name: "Mint",     light: "#77FFCC", dark: "#007744", glow: "rgba(0,255,170,0.4)" },
    { hex: "#7777FF", name: "Lavender", light: "#AAAAFF", dark: "#3333AA", glow: "rgba(119,119,255,0.4)" },
    { hex: "#FF8888", name: "Salmon",   light: "#FFBBBB", dark: "#CC4444", glow: "rgba(255,136,136,0.4)" },
  ];

  const LEVELS = [
    { colors: 3,  emptyTubes: 2, layers: 4 },
    { colors: 4,  emptyTubes: 2, layers: 4 },
    { colors: 5,  emptyTubes: 2, layers: 4 },
    { colors: 6,  emptyTubes: 2, layers: 4 },
    { colors: 7,  emptyTubes: 2, layers: 4 },
    { colors: 8,  emptyTubes: 2, layers: 4 },
    { colors: 9,  emptyTubes: 2, layers: 4 },
    { colors: 10, emptyTubes: 2, layers: 4 },
    { colors: 11, emptyTubes: 2, layers: 4 },
    { colors: 12, emptyTubes: 2, layers: 4 },
  ];

  const TUBE_CAPACITY = 4;
  const DPR = Math.min(window.devicePixelRatio || 1, 3);

  // ==================== STATE ====================

  let tubes = [];
  let selectedTube = null;
  let currentLevel = 0;
  let moves = 0;
  let gameWon = false;
  let history = [];
  let score = 0;
  let timerInterval = null;
  let timeElapsed = 0;
  let canvas, ctx;
  let tubePositions = [];
  let hoverTube = -1;
  let particles = [];
  let splashParticles = [];
  let audioCtx = null;
  let animationFrameId = null;
  let globalTime = 0;

  // Fullscreen button rect
  let fsBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  // Pour animation — swipe style
  let pourAnim = null;
  /*  pourAnim = {
        fromIndex, toIndex,
        colorIndex, layers,
        progress: 0→1,
        phase: 'swipeOut' | 'travel' | 'swipeIn' | 'done'
        floatingLayers: [{x, y, targetX, targetY, color}]
      }
  */

  // ==================== AUDIO ====================

  function initAudio() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }

  function playTone(freq, dur, type = "sine", vol = 0.12) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = freq; osc.type = type;
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  const playSelectSound   = () => playTone(540, 0.12, "sine", 0.1);
  const playErrorSound    = () => playTone(180, 0.25, "square", 0.07);
  const playUndoSound     = () => playTone(330, 0.15, "sine", 0.08);

  function playPourSound() {
    playTone(440, 0.18, "sine", 0.08);
    setTimeout(() => playTone(660, 0.15, "sine", 0.08), 120);
  }

  function playWinSound() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.25, "sine", 0.13), i * 160)
    );
  }

  function playTubeCompleteSound() {
    playTone(700, 0.12, "sine", 0.1);
    setTimeout(() => playTone(900, 0.18, "sine", 0.1), 110);
  }

  // ==================== GAME LOGIC ====================

  function generateLevel(levelIndex) {
    const lvl = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
    const { colors: numColors, emptyTubes, layers } = lvl;
    let pool = [];
    for (let c = 0; c < numColors; c++)
      for (let l = 0; l < layers; l++) pool.push(c);
    for (let s = 0; s < 7; s++)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    let newTubes = [];
    for (let i = 0; i < numColors; i++)
      newTubes.push(pool.slice(i * layers, i * layers + layers));
    for (let i = 0; i < emptyTubes; i++) newTubes.push([]);
    return newTubes;
  }

  function getTopColor(tube) { return tube.length === 0 ? -1 : tube[tube.length - 1]; }

  function getTopColorCount(tube) {
    if (!tube.length) return 0;
    const top = tube[tube.length - 1];
    let count = 0;
    for (let i = tube.length - 1; i >= 0 && tube[i] === top; i--) count++;
    return count;
  }

  function canPour(from, to) {
    if (!from.length) return false;
    if (to.length >= TUBE_CAPACITY) return false;
    if (!to.length) return true;
    return getTopColor(from) === getTopColor(to);
  }

  function executePour(fromIdx, toIdx) {
    const from = tubes[fromIdx];
    const to = tubes[toIdx];
    if (!canPour(from, to)) return 0;
    history.push(JSON.parse(JSON.stringify(tubes)));
    const topColor = getTopColor(from);
    const topCount = getTopColorCount(from);
    const space = TUBE_CAPACITY - to.length;
    const count = Math.min(topCount, space);
    for (let i = 0; i < count; i++) to.push(from.pop());
    moves++;
    createSplashParticles(toIdx, topColor);
    if (to.length === TUBE_CAPACITY && getTopColorCount(to) === TUBE_CAPACITY) {
      playTubeCompleteSound();
      score += 150;
      createCompletionParticles(toIdx);
    }
    return count;
  }

  function undoMove() {
    if (!history.length || pourAnim) return;
    tubes = history.pop();
    moves = Math.max(0, moves - 1);
    selectedTube = null;
    playUndoSound();
  }

  function checkWin() {
    for (const t of tubes) {
      if (!t.length) continue;
      if (t.length !== TUBE_CAPACITY) return false;
      if (getTopColorCount(t) !== TUBE_CAPACITY) return false;
    }
    return true;
  }

  function isTubeComplete(tube) {
    return tube.length === TUBE_CAPACITY && getTopColorCount(tube) === TUBE_CAPACITY;
  }

  // ==================== SWIPE POUR ANIMATION ====================

  function startPourAnimation(fromIdx, toIdx) {
    const from = tubes[fromIdx];
    const topColor = getTopColor(from);
    const topCount = getTopColorCount(from);
    const space = TUBE_CAPACITY - tubes[toIdx].length;
    const layers = Math.min(topCount, space);

    const fromPos = tubePositions[fromIdx];
    const toPos = tubePositions[toIdx];

    // Build floating layer objects
    const floatingLayers = [];
    const layerH = getTubeLayerH(fromPos);
    for (let i = 0; i < layers; i++) {
      const srcLayerIdx = from.length - 1 - i;
      const srcY = fromPos.y + fromPos.h - 8 * DPR - (srcLayerIdx + 1) * layerH;
      const destLayerIdx = tubes[toIdx].length + i;
      const destY = toPos.y + toPos.h - 8 * DPR - (destLayerIdx + 1) * getTubeLayerH(toPos);
      floatingLayers.push({
        startX: fromPos.cx,
        startY: srcY + layerH / 2,
        endX: toPos.cx,
        endY: destY + getTubeLayerH(toPos) / 2,
        color: topColor,
        delay: i * 0.12,
      });
    }

    pourAnim = {
      fromIndex: fromIdx,
      toIndex: toIdx,
      colorIndex: topColor,
      layers: layers,
      progress: 0,
      phase: "swipe",
      floatingLayers: floatingLayers,
      totalDuration: 0.6 + layers * 0.08,
    };
  }

  function getTubeLayerH(pos) {
    return (pos.h - 16 * DPR) / TUBE_CAPACITY;
  }

  function updatePourAnim() {
    if (!pourAnim) return;

    const speed = 0.025;
    pourAnim.progress += speed;

    if (pourAnim.progress >= 1) {
      // Done — execute actual pour
      executePour(pourAnim.fromIndex, pourAnim.toIndex);
      playPourSound();
      const won = checkWin();
      pourAnim = null;
      selectedTube = null;
      if (won) {
        gameWon = true;
        score += Math.max(0, 600 - moves * 5 - timeElapsed * 2);
        stopTimer();
        playWinSound();
        createWinParticles();
        saveHighScore();
      }
    }
  }

  function drawFloatingLayers() {
    if (!pourAnim) return;
    const { floatingLayers, progress, fromIndex, toIndex } = pourAnim;
    const fromPos = tubePositions[fromIndex];
    const toPos = tubePositions[toIndex];

    floatingLayers.forEach((fl, i) => {
      const adjustedP = Math.max(0, Math.min(1, (progress - fl.delay) / (1 - fl.delay * floatingLayers.length * 0.5)));
      if (adjustedP <= 0) return;

      const ease = easeInOutCubic(adjustedP);

      // Arc path — layers fly in an arc
      const x = fl.startX + (fl.endX - fl.startX) * ease;
      const arcHeight = -60 * DPR * Math.sin(adjustedP * Math.PI);
      const y = fl.startY + (fl.endY - fl.startY) * ease + arcHeight;

      const col = COLORS[fl.color];
      const layerH = getTubeLayerH(fromPos);
      const innerW = fromPos.w - 12 * DPR;

      // Scale: starts normal, shrinks slightly mid-flight, expands back
      const scaleX = 0.7 + 0.3 * (1 - Math.sin(adjustedP * Math.PI) * 0.3);
      const w = innerW * scaleX;
      const h = layerH * 0.85;
      const r = Math.min(h / 2, 8 * DPR);

      ctx.save();
      ctx.globalAlpha = 0.92;

      // Glow shadow
      ctx.shadowColor = col.glow || col.hex;
      ctx.shadowBlur = 18 * DPR;

      // Gradient fill
      const grad = ctx.createLinearGradient(x - w / 2, y - h / 2, x - w / 2, y + h / 2);
      grad.addColorStop(0, col.light);
      grad.addColorStop(0.45, col.hex);
      grad.addColorStop(1, col.dark);
      ctx.fillStyle = grad;

      ctx.beginPath();
      roundRectPath(ctx, x - w / 2, y - h / 2, w, h, r);
      ctx.fill();

      // Sheen
      ctx.shadowBlur = 0;
      const sheen = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y - h / 2);
      sheen.addColorStop(0, "rgba(255,255,255,0.3)");
      sheen.addColorStop(0.4, "rgba(255,255,255,0.05)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      roundRectPath(ctx, x - w / 2, y - h / 2, w * 0.5, h, r);
      ctx.fill();

      // Trail particles
      if (adjustedP > 0.1 && adjustedP < 0.9 && Math.random() > 0.5) {
        splashParticles.push({
          x: x + (Math.random() - 0.5) * w * 0.6,
          y: y + (Math.random() - 0.5) * h,
          vx: (Math.random() - 0.5) * 2 * DPR,
          vy: (Math.random() * 2 + 1) * DPR,
          life: 0.6,
          color: col.hex,
          size: (Math.random() * 2.5 + 1.5) * DPR,
        });
      }

      ctx.restore();
    });
  }

  // ==================== PARTICLES ====================

  function createSplashParticles(tubeIdx, colorIdx) {
    const pos = tubePositions[tubeIdx];
    if (!pos) return;
    const col = COLORS[colorIdx].hex;
    for (let i = 0; i < 14; i++) {
      splashParticles.push({
        x: pos.cx + (Math.random() - 0.5) * pos.w * 0.5,
        y: pos.y + pos.h * 0.2,
        vx: (Math.random() - 0.5) * 5 * DPR,
        vy: (-Math.random() * 4 - 1) * DPR,
        life: 1,
        color: col,
        size: (Math.random() * 3 + 2) * DPR,
      });
    }
  }

  function createCompletionParticles(tubeIdx) {
    const pos = tubePositions[tubeIdx];
    if (!pos) return;
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: pos.cx,
        y: pos.y + pos.h / 2,
        vx: (Math.random() - 0.5) * 10 * DPR,
        vy: (Math.random() - 0.5) * 10 * DPR - 2 * DPR,
        life: 1,
        color: `hsl(${Math.random() * 360},100%,65%)`,
        size: (Math.random() * 4 + 2) * DPR,
      });
    }
  }

  function createWinParticles() {
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.9,
        y: canvas.height / 2 + (Math.random() - 0.5) * canvas.height * 0.6,
        vx: (Math.random() - 0.5) * 14 * DPR,
        vy: (Math.random() - 0.5) * 14 * DPR - 3 * DPR,
        life: 1,
        color: `hsl(${Math.random() * 360},100%,65%)`,
        size: (Math.random() * 5 + 3) * DPR,
      });
    }
  }

  function updateParticles() {
    const gravity = 0.18 * DPR;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += gravity; p.life -= 0.013;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.x += p.vx; p.y += p.vy; p.vy += gravity * 0.9; p.life -= 0.028;
      if (p.life <= 0) splashParticles.splice(i, 1);
    }
  }

  function drawParticles() {
    ctx.save();
    for (const p of [...particles, ...splashParticles]) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12 * DPR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==================== LAYOUT ====================

  function calculateLayout() {
    if (!tubes.length) return;

    const totalTubes = tubes.length;
    const cw = canvas.width;
    const ch = canvas.height;

    const topH = 90 * DPR;
    const botH = 90 * DPR;
    const padX = 28 * DPR;
    const gapX = 14 * DPR;
    const gapY = 24 * DPR;

    const availW = cw - padX * 2;
    const availH = ch - topH - botH;

    let cols, rows;
    if (totalTubes <= 5) { cols = totalTubes; rows = 1; }
    else { cols = Math.ceil(totalTubes / 2); rows = 2; }

    // TALLER tubes — max height increased significantly
    const maxTW = 64 * DPR;
    const maxTH = 260 * DPR;

    let tW = Math.min(maxTW, (availW - (cols - 1) * gapX) / cols);
    let tH = Math.min(maxTH, (availH - (rows - 1) * gapY - 10 * DPR) / rows);
    tW = Math.max(36 * DPR, tW);
    tH = Math.max(140 * DPR, tH);

    // Ensure tubes are tall — minimum aspect ratio 1:3
    if (tH < tW * 3.2) tH = Math.min(maxTH, tW * 3.5);
    // Recheck height fits
    const totalHNeeded = rows * tH + (rows - 1) * gapY;
    if (totalHNeeded > availH) {
      tH = (availH - (rows - 1) * gapY) / rows;
    }

    const totalW = cols * tW + (cols - 1) * gapX;
    const totalH = rows * tH + (rows - 1) * gapY;
    const startX = (cw - totalW) / 2;
    const startY = topH + (availH - totalH) / 2;

    tubePositions = [];
    for (let i = 0; i < totalTubes; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      let rowOff = 0;
      if (row === rows - 1) {
        const lastCols = totalTubes - (rows - 1) * cols;
        rowOff = ((cols - lastCols) * (tW + gapX)) / 2;
      }
      const x = startX + col * (tW + gapX) + rowOff;
      const y = startY + row * (tH + gapY);
      tubePositions.push({ x, y, w: tW, h: tH, cx: x + tW / 2 });
    }
  }

  // ==================== RENDERING ====================

  let bgCache = null;

  function drawBackground() {
    const cw = canvas.width, ch = canvas.height;
    if (!bgCache || bgCache.w !== cw || bgCache.h !== ch) {
      const offC = document.createElement("canvas");
      offC.width = cw; offC.height = ch;
      const oCtx = offC.getContext("2d");

      const grad = oCtx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, "#06061a");
      grad.addColorStop(0.5, "#0a0a24");
      grad.addColorStop(1, "#06061a");
      oCtx.fillStyle = grad;
      oCtx.fillRect(0, 0, cw, ch);

      // Subtle grid
      oCtx.strokeStyle = "rgba(100,120,255,0.035)";
      oCtx.lineWidth = DPR;
      const gs = 50 * DPR;
      for (let x = 0; x < cw; x += gs) { oCtx.beginPath(); oCtx.moveTo(x, 0); oCtx.lineTo(x, ch); oCtx.stroke(); }
      for (let y = 0; y < ch; y += gs) { oCtx.beginPath(); oCtx.moveTo(0, y); oCtx.lineTo(cw, y); oCtx.stroke(); }

      // Vignette
      const vig = oCtx.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      oCtx.fillStyle = vig;
      oCtx.fillRect(0, 0, cw, ch);

      bgCache = { img: offC, w: cw, h: ch };
    }
    ctx.drawImage(bgCache.img, 0, 0);
  }

  function drawTopBar() {
    const cw = canvas.width;
    const pd = 20 * DPR;
    const midY = 48 * DPR;

    // Level badge
    const badgeW = 120 * DPR, badgeH = 34 * DPR;
    const badgeX = pd, badgeY = midY - badgeH / 2;
    const bg = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    bg.addColorStop(0, "rgba(0,200,150,0.15)"); bg.addColorStop(1, "rgba(0,100,200,0.15)");
    ctx.fillStyle = bg;
    ctx.strokeStyle = "rgba(0,255,200,0.45)";
    ctx.lineWidth = 1.5 * DPR;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8 * DPR, true, true);

    ctx.fillStyle = "#00ffcc";
    ctx.font = `bold ${15 * DPR}px "Orbitron","Segoe UI",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 10 * DPR;
    ctx.fillText(`LEVEL ${currentLevel + 1}`, badgeX + badgeW / 2, midY);
    ctx.shadowBlur = 0;

    // Score
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${18 * DPR}px "Orbitron","Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 10 * DPR;
    ctx.fillText(`${score} pts`, cw / 2, midY);
    ctx.shadowBlur = 0;

    // Stats
    const mins = Math.floor(timeElapsed / 60).toString().padStart(2, "0");
    const secs = (timeElapsed % 60).toString().padStart(2, "0");
    ctx.fillStyle = "#aabbdd";
    ctx.font = `${12 * DPR}px "Segoe UI",sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`Moves: ${moves}  Time: ${mins}:${secs}`, cw - pd, midY - 8 * DPR);

    let hs = 0;
    try { hs = parseInt(localStorage.getItem("liquidSort_highScore") || "0"); } catch (e) {}
    ctx.fillStyle = "#7788aa";
    ctx.font = `${11 * DPR}px "Segoe UI",sans-serif`;
    ctx.fillText(`Best: ${hs} pts`, cw - pd, midY + 9 * DPR);

    // Divider
    const lineY = 76 * DPR;
    const dg = ctx.createLinearGradient(pd, lineY, cw - pd, lineY);
    dg.addColorStop(0, "rgba(0,255,200,0)");
    dg.addColorStop(0.3, "rgba(0,255,200,0.45)");
    dg.addColorStop(0.7, "rgba(0,255,200,0.45)");
    dg.addColorStop(1, "rgba(0,255,200,0)");
    ctx.strokeStyle = dg; ctx.lineWidth = DPR;
    ctx.beginPath(); ctx.moveTo(pd, lineY); ctx.lineTo(cw - pd, lineY); ctx.stroke();
  }

  function drawBottomBar() {
    const cw = canvas.width, ch = canvas.height;
    const pd = 20 * DPR;
    const lineY = ch - 76 * DPR;

    const dg = ctx.createLinearGradient(pd, lineY, cw - pd, lineY);
    dg.addColorStop(0, "rgba(0,255,200,0)");
    dg.addColorStop(0.3, "rgba(0,255,200,0.35)");
    dg.addColorStop(0.7, "rgba(0,255,200,0.35)");
    dg.addColorStop(1, "rgba(0,255,200,0)");
    ctx.strokeStyle = dg; ctx.lineWidth = DPR;
    ctx.beginPath(); ctx.moveTo(pd, lineY); ctx.lineTo(cw - pd, lineY); ctx.stroke();

    const btnY = ch - 42 * DPR;
    const bW = 105 * DPR, bH = 36 * DPR;

    const buttons = [
      { label: "↩ UNDO",    x: cw * 0.18 },
      { label: "⟳ RESTART", x: cw * 0.45 },
      { label: "⏭ SKIP",    x: cw * 0.72 },
    ];

    buttons.forEach((btn) => {
      const bx = btn.x - bW / 2;
      const by = btnY - bH / 2;
      ctx.fillStyle = "rgba(0,255,200,0.06)";
      ctx.strokeStyle = "rgba(0,255,200,0.3)";
      ctx.lineWidth = 1.5 * DPR;
      roundRect(ctx, bx, by, bW, bH, 9 * DPR, true, true);
      ctx.fillStyle = "#00ffcc";
      ctx.font = `bold ${11 * DPR}px "Segoe UI",sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(btn.label, btn.x, btnY);
    });
  }

  // ==================== FULLSCREEN BUTTON ====================

  function drawFullscreenBtn() {
    const cw = canvas.width, ch = canvas.height;
    const sz = 42 * DPR;
    const mg = 12 * DPR;
    const bx = cw - sz - mg;
    const by = ch - sz - mg;
    fsBtnRect = { x: bx, y: by, w: sz, h: sz };

    const pulse = 0.35 + Math.sin(globalTime / 1200) * 0.18;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "rgba(0,10,20,0.55)";
    ctx.strokeStyle = "rgba(0,255,200,0.25)";
    ctx.lineWidth = 1.5 * DPR;
    roundRect(ctx, bx, by, sz, sz, 10 * DPR, true, true);

    const cx = bx + sz / 2, cy = by + sz / 2;
    const ic = 7 * DPR;
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2 * DPR;
    ctx.lineCap = "round";

    // Four corners
    const corners = [
      [-ic, -(ic - 3 * DPR), -ic, -ic, -(ic - 3 * DPR), -ic],
      [ic - 3 * DPR, -ic, ic, -ic, ic, -(ic - 3 * DPR)],
      [-ic, ic - 3 * DPR, -ic, ic, -(ic - 3 * DPR), ic],
      [ic - 3 * DPR, ic, ic, ic, ic, ic - 3 * DPR],
    ];
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(cx + x1, cy + y1);
      ctx.lineTo(cx + x2, cy + y2);
      ctx.lineTo(cx + x3, cy + y3);
      ctx.stroke();
    });
    ctx.restore();
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFS) {
      (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
    setTimeout(resizeCanvas, 250);
  }

  // ==================== TUBE DRAWING ====================

  function drawTube(index) {
    const tube = tubes[index];
    const pos = tubePositions[index];
    if (!pos) return;

    const isSelected = selectedTube === index;
    const isHover = hoverTube === index;
    const isComplete = isTubeComplete(tube);
    const isPourFrom = pourAnim && pourAnim.fromIndex === index;
    const isPourTo = pourAnim && pourAnim.toIndex === index;

    const { x, y, w: tW, h: tH } = pos;

    // Selection lift
    let offY = 0;
    if (isSelected && !pourAnim) offY = -8 * DPR;

    const tx = x, ty = y + offY;

    ctx.save();

    // Glow
    if (isSelected || isPourFrom) {
      ctx.shadowColor = "#00ffcc";
      ctx.shadowBlur = 24 * DPR;
    } else if (isComplete) {
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 20 * DPR;
    } else if (isHover) {
      ctx.shadowColor = "rgba(255,255,255,0.5)";
      ctx.shadowBlur = 12 * DPR;
    }

    drawTubeGlass(tx, ty, tW, tH, isSelected, isComplete, isHover);
    ctx.shadowBlur = 0;

    // Clip & draw liquids
    ctx.save();
    clipTubeShape(tx, ty, tW, tH);

    // During pour, hide top layers from source tube
    let visibleTube = tube;
    if (isPourFrom && pourAnim) {
      visibleTube = tube.slice(0, tube.length - pourAnim.layers);
    }
    drawLiquids(visibleTube, tx, ty, tW, tH);
    ctx.restore();

    // Rim
    drawTubeRim(tx, ty, tW, tH, isSelected, isComplete);

    ctx.restore();

    // Complete check
    if (isComplete) {
      ctx.save();
      ctx.font = `bold ${18 * DPR}px "Segoe UI"`;
      ctx.fillStyle = "#00ff88";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 14 * DPR;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("✓", tx + tW / 2, ty - 12 * DPR);
      ctx.restore();
    }

    // Label
    ctx.save();
    ctx.fillStyle = "rgba(150,170,220,0.4)";
    ctx.font = `${10 * DPR}px "Segoe UI",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`${index + 1}`, tx + tW / 2, ty + tH + 5 * DPR);
    ctx.restore();
  }

  function drawTubeGlass(x, y, w, h, isSel, isComp, isHov) {
    const pad = 2 * DPR;
    const r = w / 2 - pad;

    const strokeCol = isSel ? "#00ffcc" : isComp ? "#00ff88" : isHov ? "rgba(255,255,255,0.5)" : "rgba(180,200,255,0.2)";
    const lw = isSel ? 2.5 * DPR : isComp ? 2 * DPR : 1.5 * DPR;

    // Glass fill
    const gfill = ctx.createLinearGradient(x, y, x + w, y);
    gfill.addColorStop(0, "rgba(255,255,255,0.08)");
    gfill.addColorStop(0.3, "rgba(255,255,255,0.03)");
    gfill.addColorStop(0.7, "rgba(255,255,255,0.03)");
    gfill.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = gfill;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lw;

    ctx.beginPath();
    tubePathNew(ctx, x, y, w, h, r, pad);
    ctx.fill();
    ctx.stroke();

    // Inner shine streak
    ctx.save();
    clipTubeShape(x, y, w, h);
    const shGrad = ctx.createLinearGradient(x, y, x + w * 0.3, y);
    shGrad.addColorStop(0, "rgba(255,255,255,0.1)");
    shGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shGrad;
    ctx.fillRect(x, y, w * 0.3, h);
    ctx.restore();
  }

  function tubePathNew(ctx, x, y, w, h, r, pad) {
    // Open top, straight sides, rounded bottom
    const topFlare = 4 * DPR; // Slight flare at top opening
    ctx.moveTo(x + pad - topFlare, y);
    ctx.lineTo(x + pad, y + 16 * DPR);
    ctx.lineTo(x + pad, y + h - r);
    ctx.arcTo(x + pad, y + h, x + w / 2, y + h, r);
    ctx.arcTo(x + w - pad, y + h, x + w - pad, y + h - r, r);
    ctx.lineTo(x + w - pad, y + 16 * DPR);
    ctx.lineTo(x + w - pad + topFlare, y);
  }

  function clipTubeShape(x, y, w, h) {
    const pad = 2 * DPR;
    const r = w / 2 - pad;
    ctx.beginPath();
    tubePathNew(ctx, x, y, w, h, r, pad);
    ctx.closePath();
    ctx.clip();
  }

  function drawLiquids(tube, x, y, w, h) {
    if (!tube.length) return;

    const pad = 2 * DPR;
    const innerW = w - pad * 2 - 4 * DPR;
    const innerX = x + pad + 2 * DPR;
    const bottomPad = 6 * DPR;
    const topPad = 16 * DPR;
    const usableH = h - bottomPad - topPad;
    const layerH = usableH / TUBE_CAPACITY;
    const now = globalTime;

    for (let j = 0; j < tube.length; j++) {
      const ci = tube[j];
      const col = COLORS[ci];
      const layerY = y + h - bottomPad - (j + 1) * layerH;
      const isTop = j === tube.length - 1;
      const isBot = j === 0;

      // Liquid gradient
      const lg = ctx.createLinearGradient(innerX, layerY, innerX, layerY + layerH);
      lg.addColorStop(0, col.light);
      lg.addColorStop(0.35, col.hex);
      lg.addColorStop(1, col.dark);
      ctx.fillStyle = lg;

      if (isBot) {
        const br = Math.min(innerW / 2 - DPR, layerH * 0.4);
        ctx.beginPath();
        ctx.moveTo(innerX, layerY);
        ctx.lineTo(innerX + innerW, layerY);
        ctx.lineTo(innerX + innerW, layerY + layerH - br);
        ctx.arcTo(innerX + innerW, layerY + layerH, innerX + innerW - br, layerY + layerH, br);
        ctx.lineTo(innerX + br, layerY + layerH);
        ctx.arcTo(innerX, layerY + layerH, innerX, layerY + layerH - br, br);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(innerX, layerY, innerW, layerH + 0.5);
      }

      // Sheen
      const sheen = ctx.createLinearGradient(innerX, layerY, innerX + innerW, layerY);
      sheen.addColorStop(0, "rgba(255,255,255,0.2)");
      sheen.addColorStop(0.35, "rgba(255,255,255,0.05)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(innerX, layerY, innerW * 0.45, layerH);

      // Separator
      if (j > 0 && tube[j] !== tube[j - 1]) {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = DPR;
        ctx.beginPath();
        ctx.moveTo(innerX, layerY + layerH);
        ctx.lineTo(innerX + innerW, layerY + layerH);
        ctx.stroke();
      }

      // Wave on top
      if (isTop) {
        const waveAmp = 2 * DPR;
        const waveSpeed = now / 700;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(innerX, layerY + waveAmp);
        for (let wx = 0; wx <= innerW; wx += 2) {
          const wy = Math.sin((wx / innerW) * Math.PI * 3 + waveSpeed) * waveAmp;
          ctx.lineTo(innerX + wx, layerY + wy);
        }
        ctx.lineTo(innerX + innerW, layerY + layerH);
        ctx.lineTo(innerX, layerY + layerH);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawTubeRim(x, y, w, h, isSel, isComp) {
    const rimCol = isSel ? "rgba(0,255,200,0.6)" : isComp ? "rgba(0,255,136,0.5)" : "rgba(255,255,255,0.15)";
    const pad = 2 * DPR;
    const topFlare = 4 * DPR;
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 2.5 * DPR;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + pad - topFlare, y);
    ctx.lineTo(x + pad, y + 14 * DPR);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - pad + topFlare, y);
    ctx.lineTo(x + w - pad, y + 14 * DPR);
    ctx.stroke();

    // Top lip
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 2.5 * DPR;
    ctx.beginPath();
    ctx.moveTo(x + pad - topFlare - 1 * DPR, y);
    ctx.lineTo(x + w - pad + topFlare + 1 * DPR, y);
    ctx.stroke();

    // Small glass reflection at top
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + pad + 2 * DPR, y + 3 * DPR, 3 * DPR, 10 * DPR);
  }

  // ==================== WIN OVERLAY ====================

  function drawWinOverlay() {
    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = "rgba(5,5,20,0.78)";
    ctx.fillRect(0, 0, cw, ch);

    const boxW = Math.min(460 * DPR, cw - 50 * DPR);
    const boxH = 280 * DPR;
    const boxX = (cw - boxW) / 2;
    const boxY = (ch - boxH) / 2;

    ctx.save();
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 45 * DPR;
    const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
    boxGrad.addColorStop(0, "rgba(0,45,65,0.97)");
    boxGrad.addColorStop(1, "rgba(0,20,40,0.97)");
    ctx.fillStyle = boxGrad;
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 2.5 * DPR;
    roundRect(ctx, boxX, boxY, boxW, boxH, 16 * DPR, true, true);
    ctx.restore();

    // Title
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let tsz = 24 * DPR;
    ctx.font = `bold ${tsz}px "Orbitron","Segoe UI",sans-serif`;
    while (ctx.measureText("🎉 LEVEL COMPLETE!").width > boxW - 36 * DPR && tsz > 10 * DPR) {
      tsz -= DPR;
      ctx.font = `bold ${tsz}px "Orbitron","Segoe UI",sans-serif`;
    }
    ctx.fillStyle = "#00ffcc";
    ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 16 * DPR;
    ctx.fillText("🎉 LEVEL COMPLETE!", cw / 2, boxY + 48 * DPR);
    ctx.restore();

    // Stats
    const statY = boxY + 105 * DPR;
    const mins = Math.floor(timeElapsed / 60).toString().padStart(2, "0");
    const secs = (timeElapsed % 60).toString().padStart(2, "0");
    const stats = [
      { label: "MOVES", value: `${moves}` },
      { label: "TIME",  value: `${mins}:${secs}` },
      { label: "SCORE", value: `${score}` },
    ];
    const colW = boxW / 3;
    stats.forEach((st, i) => {
      const sx = boxX + colW * i + colW / 2;
      const crdW = colW - 14 * DPR, crdH = 48 * DPR;
      const crdX = sx - crdW / 2, crdY = statY - crdH / 2;
      ctx.fillStyle = "rgba(0,255,200,0.07)";
      ctx.strokeStyle = "rgba(0,255,200,0.22)";
      ctx.lineWidth = DPR;
      roundRect(ctx, crdX, crdY, crdW, crdH, 7 * DPR, true, true);
      ctx.save();
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(150,200,220,0.7)";
      ctx.font = `${9 * DPR}px "Segoe UI",sans-serif`;
      ctx.fillText(st.label, sx, statY - 11 * DPR);
      let vs = 18 * DPR;
      ctx.font = `bold ${vs}px "Orbitron","Segoe UI",sans-serif`;
      while (ctx.measureText(st.value).width > crdW - 8 * DPR && vs > 9 * DPR) {
        vs -= DPR; ctx.font = `bold ${vs}px "Orbitron","Segoe UI",sans-serif`;
      }
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 6 * DPR;
      ctx.fillText(st.value, sx, statY + 10 * DPR);
      ctx.restore();
    });

    // Next button
    const btnW = 190 * DPR, btnH = 44 * DPR;
    const btnX = (cw - btnW) / 2, btnY = boxY + boxH - 62 * DPR;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
    btnGrad.addColorStop(0, "#00ddaa"); btnGrad.addColorStop(1, "#00aacc");
    ctx.fillStyle = btnGrad;
    ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 18 * DPR;
    ctx.strokeStyle = "#00ffcc"; ctx.lineWidth = 2 * DPR;
    roundRect(ctx, btnX, btnY, btnW, btnH, 11 * DPR, true, true);
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#061518";
    ctx.font = `bold ${13 * DPR}px "Orbitron","Segoe UI",sans-serif`;
    ctx.fillText("NEXT LEVEL →", cw / 2, btnY + btnH / 2);
    ctx.restore();
  }

  // ==================== HELPERS ====================

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ==================== INPUT ====================

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function getTubeAt(px, py) {
    for (let i = 0; i < tubePositions.length; i++) {
      const p = tubePositions[i];
      if (px >= p.x - 6 * DPR && px <= p.x + p.w + 6 * DPR &&
          py >= p.y - 18 * DPR && py <= p.y + p.h + 22 * DPR) return i;
    }
    return -1;
  }

  function getButtonAt(px, py) {
    const cw = canvas.width, ch = canvas.height;
    const btnY = ch - 42 * DPR;
    const bW = 105 * DPR, bH = 36 * DPR;
    const btns = [
      { action: "undo",    x: cw * 0.18 },
      { action: "restart", x: cw * 0.45 },
      { action: "skip",    x: cw * 0.72 },
    ];
    for (const b of btns) {
      if (px >= b.x - bW / 2 && px <= b.x + bW / 2 &&
          py >= btnY - bH / 2 && py <= btnY + bH / 2) return b.action;
    }
    return null;
  }

  function isInsideFSBtn(px, py) {
    return (px >= fsBtnRect.x && px <= fsBtnRect.x + fsBtnRect.w &&
            py >= fsBtnRect.y && py <= fsBtnRect.y + fsBtnRect.h);
  }

  function handleClick(e) {
    e.preventDefault();
    if (pourAnim) return;

    const pos = getPos(e);

    // Fullscreen button
    if (isInsideFSBtn(pos.x, pos.y)) {
      toggleFullscreen();
      return;
    }

    if (gameWon) {
      const cw = canvas.width, ch = canvas.height;
      const boxW = Math.min(460 * DPR, cw - 50 * DPR);
      const boxH = 280 * DPR;
      const boxY = (ch - boxH) / 2;
      const btnW = 190 * DPR, btnH = 44 * DPR;
      const btnX = (cw - btnW) / 2;
      const btnBY = boxY + boxH - 62 * DPR;
      if (pos.x >= btnX && pos.x <= btnX + btnW &&
          pos.y >= btnBY && pos.y <= btnBY + btnH) {
        nextLevel();
      }
      return;
    }

    const btn = getButtonAt(pos.x, pos.y);
    if (btn) {
      if (btn === "undo") undoMove();
      else if (btn === "restart") restartLevel();
      else if (btn === "skip") nextLevel();
      return;
    }

    const ti = getTubeAt(pos.x, pos.y);
    if (ti === -1) { selectedTube = null; return; }

    if (selectedTube === null) {
      if (!tubes[ti].length || isTubeComplete(tubes[ti])) return;
      selectedTube = ti;
      playSelectSound();
    } else if (selectedTube === ti) {
      selectedTube = null;
      playSelectSound();
    } else {
      if (canPour(tubes[selectedTube], tubes[ti])) {
        startPourAnimation(selectedTube, ti);
      } else {
        playErrorSound();
        if (tubes[ti].length && !isTubeComplete(tubes[ti])) {
          selectedTube = ti;
          playSelectSound();
        } else {
          selectedTube = null;
        }
      }
    }
  }

  function handleMouseMove(e) {
    if (gameWon || pourAnim) return;
    const pos = getPos(e);
    hoverTube = getTubeAt(pos.x, pos.y);
    const overBtn = getButtonAt(pos.x, pos.y) || isInsideFSBtn(pos.x, pos.y);
    canvas.style.cursor = hoverTube >= 0 || overBtn ? "pointer" : "default";
  }

  function handleKey(e) {
    if (pourAnim) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undoMove(); }
    if (e.key === "r") restartLevel();
    if (e.key === "n" && gameWon) nextLevel();
    if (e.key === "Escape") selectedTube = null;
    if (e.key === "f" || e.key === "F") toggleFullscreen();
    const num = parseInt(e.key);
    if (num >= 1 && num <= tubes.length) {
      const ti = num - 1;
      if (selectedTube === null) {
        if (tubes[ti].length && !isTubeComplete(tubes[ti])) { selectedTube = ti; playSelectSound(); }
      } else if (selectedTube === ti) { selectedTube = null; }
      else {
        if (canPour(tubes[selectedTube], tubes[ti])) startPourAnimation(selectedTube, ti);
        else { playErrorSound(); selectedTube = null; }
      }
    }
  }

  // ==================== GAME FLOW ====================

  function startLevel(lvl) {
    currentLevel = lvl;
    tubes = generateLevel(lvl);
    selectedTube = null;
    moves = 0;
    gameWon = false;
    history = [];
    particles = [];
    splashParticles = [];
    timeElapsed = 0;
    pourAnim = null;
    bgCache = null;
    calculateLayout();
    startTimer();
  }

  function restartLevel() {
    startLevel(currentLevel);
    playTone(440, 0.15, "sine", 0.08);
  }

  function nextLevel() {
    if (currentLevel + 1 >= LEVELS.length) { currentLevel = 0; score += 3000; }
    else currentLevel++;
    startLevel(currentLevel);
    playTone(550, 0.2, "sine", 0.1);
  }

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => { if (!gameWon && !pourAnim) timeElapsed++; }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function saveHighScore() {
    try {
      const k = "liquidSort_highScore";
      const ex = parseInt(localStorage.getItem(k) || "0");
      if (score > ex) localStorage.setItem(k, score.toString());
      const lk = "liquidSort_level";
      const sl = parseInt(localStorage.getItem(lk) || "0");
      if (currentLevel + 1 > sl) localStorage.setItem(lk, (currentLevel + 1).toString());
    } catch (e) {}
  }

  function loadProgress() {
    try { return parseInt(localStorage.getItem("liquidSort_level") || "0"); }
    catch (e) { return 0; }
  }

  // ==================== MAIN LOOP ====================

  function mainLoop(ts) {
    globalTime = ts || 0;
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    drawBackground();
    drawTopBar();

    // Draw tubes — pour-from tube last (on top)
    for (let i = 0; i < tubes.length; i++) {
      if (pourAnim && pourAnim.fromIndex === i) continue;
      drawTube(i);
    }
    if (pourAnim) drawTube(pourAnim.fromIndex);

    // Draw floating swipe layers
    drawFloatingLayers();

    drawBottomBar();
    drawFullscreenBtn();
    drawParticles();

    if (gameWon) drawWinOverlay();

    updateParticles();
    updatePourAnim();

    animationFrameId = requestAnimationFrame(mainLoop);
  }

  // ==================== RESIZE ====================

  function resizeCanvas() {
    const container = canvas.parentElement;
    const cw = container ? container.clientWidth : Math.min(window.innerWidth - 20, 900);
    const ch = container ? container.clientHeight : Math.min(window.innerHeight - 20, 700);

    canvas.width = Math.max(cw, 340) * DPR;
    canvas.height = Math.max(ch, 480) * DPR;
    canvas.style.width = `${Math.max(cw, 340)}px`;
    canvas.style.height = `${Math.max(ch, 480)}px`;

    bgCache = null;
    calculateLayout();
  }

  // ==================== INIT ====================

  function init() {
    const container =
      document.getElementById("game-container") ||
      document.getElementById("gameContainer") ||
      document.querySelector(".game-container") ||
      document.querySelector(".game-area") ||
      document.querySelector("main");

    if (!container) {
      console.error("Liquid Sort: game container not found!");
      return;
    }

    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.id = "liquid-sort-wrapper";
    wrapper.style.cssText = `
      width:100%; height:100%; min-height:500px;
      display:flex; align-items:center; justify-content:center;
      background:#06061a; position:relative; overflow:hidden;
    `;

    canvas = document.createElement("canvas");
    canvas.id = "liquid-sort-canvas";
    canvas.style.cssText = `display:block; touch-action:none;`;

    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    ctx = canvas.getContext("2d", { alpha: false });

    initAudio();
    resizeCanvas();

    const savedLevel = loadProgress();
    startLevel(savedLevel);

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", resizeCanvas);

    const resumeAudio = () => {
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      document.removeEventListener("click", resumeAudio);
      document.removeEventListener("touchstart", resumeAudio);
    };
    document.addEventListener("click", resumeAudio);
    document.addEventListener("touchstart", resumeAudio);

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    mainLoop();

    console.log("🧪 Liquid Sort v3.0 — Premium Edition loaded!");
  }

  // ==================== BOOT ====================

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 80);

  window.LiquidSort = { restart: restartLevel, nextLevel, undo: undoMove };
})();