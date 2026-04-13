'use strict';

window.initColorUp = function(canvas, onScore) {

    onScore = onScore || function(){};

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    (function setupCanvas() {
        const p = canvas.parentElement;
        const w = (p && p.clientWidth  > 10) ? p.clientWidth  : window.innerWidth;
        const h = (p && p.clientHeight > 10) ? p.clientHeight : window.innerHeight;
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
    })();

    const ctx = canvas.getContext('2d', { alpha: false });

    let W = canvas.width  / dpr;
    let H = canvas.height / dpr;

    let destroyed = false;
    let paused    = false;
    let raf       = null;
    let lastTS    = 0;

    const COLORS = [
        { id: 0, fill: '#22CC44', stroke: '#119922', name: 'GREEN'  },
        { id: 1, fill: '#FFD700', stroke: '#CC9900', name: 'YELLOW' },
        { id: 2, fill: '#EE2233', stroke: '#AA1122', name: 'RED'    },
        { id: 3, fill: '#00BBEE', stroke: '#0088AA', name: 'BLUE'   },
    ];

    const STATE = { READY: 0, PLAYING: 1, DEAD: 2 };
    let gameState = STATE.READY;

    let score    = 0;
    let best     = parseInt(localStorage.getItem('colorup_v7_best') || '0');
    let combo    = 0;
    let maxCombo = 0;

    const BALL_R = 15;

    // ── Ball ──
    const ball = {
        x: 0,           // screen X
        screenY: 0,     // current visual Y
        targetX: 0,
        colorIdx: -1,
        bouncing: false,
        bounceT: 0,
        bounceDur: 0,
        bounceStartY: 0,   // where bounce starts (BALL_LAND_Y)
        bouncePeakY: 0,    // highest point of arc
        trail: [],
        pulseT: 0,
        squash: 1,         // squash/stretch for juice
        stretch: 1,
    };

    // ── Plates ──
    const QUADS_PER_FULL = 3;
    let plates         = [];
    let targetPlateIdx = -1;
    let seqCount       = 0;
    let nextBallColor  = -1;

    // Layout constants - calculated in initLayout()
    let PLATE_H        = 0;
    let PLATE_GAP      = 0;
    let PLATE_W        = 0;
    let PLATE_SPACING  = 0;  // px between plate centers
    let BALL_LAND_Y    = 0;  // Y where ball lands (fixed screen position)
    let BOUNCE_PEAK_Y  = 0;  // Y of bounce peak (higher up)

    // Scroll: plates move DOWN at this speed (px per frame at 60fps)
    // Ball bounce duration is calculated so ball and plate meet perfectly
    let scrollSpeed = 0;     // px per 16.67ms — set in initLayout

    // Score-based speed multiplier
    let speedMult = 1.0;

    let particles  = [];
    let floatTexts = [];
    let rings      = [];
    let flashA     = 0;
    let flashCol   = '#fff';
    let shakeX = 0, shakeY = 0, shakeT = 0;
    let bgT    = 0;
    let deadTimer = 0;

    const stars = mkStars(50);

    let dragging = false;
    let _ev      = {};

    initLayout();
    bindInput();
    raf = requestAnimationFrame(loop);

    const titleEl = document.getElementById('current-game-title');
    if (titleEl) titleEl.textContent = 'Color Up';

    // ════════════════════════════════════
    //  LAYOUT — all dimensions from screen
    // ════════════════════════════════════
    function initLayout() {
        W = canvas.width  / dpr;
        H = canvas.height / dpr;

        PLATE_GAP     = 6;
        PLATE_H       = Math.round(H * 0.065);          // plate height
        PLATE_W       = (W - 5 * PLATE_GAP) / 4;

        // Spacing between plates — less crowded
        PLATE_SPACING = Math.round(H * 0.22);           // 22% of screen height

        // Ball lands at 78% down screen
        BALL_LAND_Y   = H * 0.78;

        // Ball peak = 1 full plate spacing above land Y
        // This makes the arc clearly visible
        BOUNCE_PEAK_Y = BALL_LAND_Y - PLATE_SPACING * 0.92;

        // Scroll speed: plates must travel PLATE_SPACING in exactly BOUNCE_DUR ms
        // We fix bounce duration and derive scroll speed from it
        // BOUNCE_DUR = 520ms base
        // In 520ms at 60fps = 31.2 frames
        // plates must move PLATE_SPACING px in that time
        // scrollSpeed = PLATE_SPACING / (BOUNCE_DUR / 16.67)
        const BOUNCE_DUR_BASE = 520;
        scrollSpeed = PLATE_SPACING / (BOUNCE_DUR_BASE / 16.67);

        ball.x        = W / 2;
        ball.screenY  = BALL_LAND_Y;
        ball.targetX  = W / 2;
        ball.squash   = 1;
        ball.stretch  = 1;
    }

    function mkStars(n) {
        return Array.from({ length: n }, () => ({
            x: Math.random(), y: Math.random(),
            r:  Math.random() * 1.2 + 0.2,
            ph: Math.random() * Math.PI * 2,
            sp: Math.random() * 0.010 + 0.003,
        }));
    }

    // ════════════════════════════
    //  INPUT
    // ════════════════════════════
    function bindInput() {
        const onTD = e => { e.preventDefault(); pDown(e.touches[0].clientX); };
        const onTM = e => { e.preventDefault(); pMove(e.touches[0].clientX); };
        const onTE = e => { e.preventDefault(); pUp(); };
        const onMD = e => pDown(e.clientX);
        const onMM = e => { if (dragging) pMove(e.clientX); };
        const onMU = () => pUp();

        canvas.addEventListener('touchstart', onTD, { passive: false });
        canvas.addEventListener('touchmove',  onTM, { passive: false });
        canvas.addEventListener('touchend',   onTE, { passive: false });
        canvas.addEventListener('mousedown',  onMD);
        window.addEventListener('mousemove',  onMM);
        window.addEventListener('mouseup',    onMU);

        _ev = { onTD, onTM, onTE, onMD, onMM, onMU };
    }

    function pDown(cx) {
        if (gameState === STATE.READY) { startGame(); return; }
        if (gameState === STATE.DEAD && deadTimer > 800) { startGame(); return; }
        if (gameState === STATE.PLAYING) { dragging = true; pMove(cx); }
    }

    function pMove(cx) {
        if (!dragging || gameState !== STATE.PLAYING) return;
        const rect  = canvas.getBoundingClientRect();
        const scale = W / rect.width;
        const gx    = (cx - rect.left) * scale;
        ball.targetX = Math.max(BALL_R, Math.min(W - BALL_R, gx));
    }

    function pUp() { dragging = false; }

    // ════════════════════════════
    //  GAME START
    // ════════════════════════════
    function startGame() {
        score = 0; combo = 0; maxCombo = 0;
        speedMult = 1.0;
        seqCount = 0; plates = []; targetPlateIdx = -1;
        particles = []; floatTexts = []; rings = [];
        flashA = 0; shakeT = 0; deadTimer = 0;
        dragging = false; nextBallColor = -1;

        ball.colorIdx = -1;
        ball.x        = W / 2;
        ball.targetX  = W / 2;
        ball.screenY  = BALL_LAND_Y;
        ball.bouncing = false;
        ball.trail    = [];
        ball.pulseT   = 0;
        ball.squash   = 1;
        ball.stretch  = 1;

        gameState = STATE.PLAYING;
        onScore(0);

        buildInitialPlates();
        // Start bouncing to first plate
        launchToPlate(0);
    }

    // ════════════════════════════
    //  PLATE BUILDING
    // ════════════════════════════
    function buildInitialPlates() {
        // Place first plate exactly 1 spacing above ball land Y
        // It will scroll down in exactly BOUNCE_DUR_BASE ms
        let y = BALL_LAND_Y - PLATE_SPACING;

        const firstColor = Math.floor(Math.random() * COLORS.length);
        plates.push({ type:'full', colorIdx:firstColor, y, passed:false, flashT:0, correct:false });
        seqCount      = 1;
        nextBallColor = firstColor;

        // Build more plates above, each PLATE_SPACING apart
        for (let i = 1; i < 14; i++) {
            y -= PLATE_SPACING;
            pushNextPlate(y);
        }
    }

    function pushNextPlate(y) {
        const pos = seqCount % (QUADS_PER_FULL + 1);
        if (pos === 0) {
            const colorIdx = Math.floor(Math.random() * COLORS.length);
            plates.push({ type:'full', colorIdx, y, passed:false, flashT:0, correct:false });
            nextBallColor = colorIdx;
        } else {
            pushQuad(y, nextBallColor);
        }
        seqCount++;
    }

    function pushQuad(y, ballColor) {
        const safeIdx = Math.floor(Math.random() * 4);
        const colors  = Array.from({ length: 4 }, () => Math.floor(Math.random() * COLORS.length));
        if (ballColor >= 0) {
            colors[safeIdx] = ballColor;
            for (let i = 0; i < 4; i++) {
                if (i === safeIdx) continue;
                while (colors[i] === ballColor) {
                    colors[i] = Math.floor(Math.random() * COLORS.length);
                }
            }
        }
        plates.push({ type:'quad', colors, safeIdx, y, passed:false, hitIdx:-1, flashT:0, correct:false });
    }

    function refillAbove() {
        let minY = Infinity;
        for (const p of plates) if (p.y < minY) minY = p.y;
        while (minY > -PLATE_SPACING * 2) {
            minY -= PLATE_SPACING;
            pushNextPlate(minY);
        }
    }

    // ════════════════════════════
    //  LAUNCH / BOUNCE
    // KEY: duration is calculated so ball and plate arrive at BALL_LAND_Y together
    // ════════════════════════════
    function launchToPlate(idx) {
        if (idx < 0 || idx >= plates.length) return;
        const plate = plates[idx];
        targetPlateIdx = idx;

        // How far is plate from BALL_LAND_Y?
        const distToLand = plate.y - BALL_LAND_Y;
        // At current speed, how long will it take plate to reach ball?
        const curSpeed = scrollSpeed * speedMult;  // px per frame
        const framesNeeded = distToLand / curSpeed;
        const dur = framesNeeded * 16.67;          // ms

        // Clamp to reasonable range
        const bounceDur = Math.max(280, Math.min(900, dur));

        ball.bouncing     = true;
        ball.bounceT      = 0;
        ball.bounceDur    = bounceDur;
        ball.bounceStartY = BALL_LAND_Y;
        // Peak = 1 full plate-spacing above land — always visible arc
        ball.bouncePeakY  = BOUNCE_PEAK_Y;
    }

    // ════════════════════════════
    //  UPDATE
    // ════════════════════════════
    function update(dt) {
        const S = dt / 16.67;
        bgT         += dt * 0.001;
        ball.pulseT += dt * 0.004;
        stars.forEach(s => { s.ph += s.sp * S; });
        updateFX(S, dt);

        if (gameState === STATE.DEAD)    { deadTimer += dt; return; }
        if (gameState !== STATE.PLAYING) return;

        // Speed ramp — only affects plate scroll, bounce auto-adjusts
        speedMult = Math.min(2.8, 1.0 + score * 0.012);

        // ── Scroll plates DOWN ──
        const curSpeed = scrollSpeed * speedMult;
        for (const p of plates) p.y += curSpeed * S;

        // ── Ball X smooth follow ──
        ball.x += (ball.targetX - ball.x) * 0.16 * S;

        // ── Squash/stretch recovery ──
        ball.squash  += (1 - ball.squash)  * 0.18 * S;
        ball.stretch += (1 - ball.stretch) * 0.18 * S;

        // ── Ball bounce arc ──
        if (ball.bouncing) {
            ball.bounceT += dt / ball.bounceDur;

            if (ball.bounceT >= 1) {
                // Arrived!
                ball.bounceT  = 1;
                ball.bouncing = false;
                ball.screenY  = BALL_LAND_Y;
                // Squash on land
                ball.squash  = 1.5;
                ball.stretch = 0.6;
                onArrived();
            } else {
                const t = ball.bounceT;

                // Arc using sin: goes up (peak) then comes back down
                // t=0 → BALL_LAND_Y, t=0.5 → BOUNCE_PEAK_Y, t=1 → BALL_LAND_Y
                const arcProgress = Math.sin(t * Math.PI);
                ball.screenY = ball.bounceStartY
                    + (ball.bouncePeakY - ball.bounceStartY) * arcProgress;

                // Stretch when going up fast, squash when coming down
                const vel = Math.cos(t * Math.PI);  // 1 at start, -1 at end
                if (vel > 0) {
                    // Going up — stretch vertically
                    ball.stretch = 1 + vel * 0.35;
                    ball.squash  = 1 / ball.stretch;
                } else {
                    // Coming down — squash slightly
                    ball.stretch = 1 + vel * 0.12;
                    ball.squash  = 1 / ball.stretch;
                }
            }

            // Trail
            ball.trail.unshift({ x: ball.x, y: ball.screenY, c: ball.colorIdx });
            if (ball.trail.length > 22) ball.trail.pop();
        } else {
            // Fade trail when idle
            if (ball.trail.length > 0) {
                ball.trail.forEach(t => t.fade = (t.fade || 1) - 0.08);
                ball.trail = ball.trail.filter(t => (t.fade || 1) > 0);
            }
        }

        // Remove plates far below screen
        plates = plates.filter(p => p.y < H + PLATE_SPACING);

        // Refill above
        refillAbove();
    }

    // ════════════════════════════
    //  COLLISION
    // ════════════════════════════
    function onArrived() {
        const idx   = targetPlateIdx;
        const plate = plates[idx];
        if (!plate || plate.passed) { findAndLaunchNext(); return; }

        plate.passed = true;
        plate.flashT = 1;

        if (plate.type === 'full') hitFull(plate);
        else                       hitQuad(plate);
    }

    function hitFull(plate) {
        ball.colorIdx = plate.colorIdx;
        plate.correct = true;
        const col     = COLORS[plate.colorIdx];

        burst(ball.x, ball.screenY, col.fill, 20);
        rings.push({ x:ball.x, y:ball.screenY, r:BALL_R, maxR:90, alpha:0.95, col:col.fill });
        rings.push({ x:ball.x, y:ball.screenY, r:BALL_R+14, maxR:120, alpha:0.5, col:col.fill });
        floatTexts.push({ x:ball.x, y:ball.screenY-40, text:col.name+'!', col:col.fill, life:900, op:1 });
        flashA = 0.25; flashCol = col.fill;

        findAndLaunchNext();
    }

    function hitQuad(plate) {
        const colIdx = getColAt(ball.x);
        plate.hitIdx = colIdx;
        if (colIdx < 0) { die(); return; }

        if (plate.colors[colIdx] === ball.colorIdx) {
            plate.correct = true;
            combo++;
            if (combo > maxCombo) maxCombo = combo;

            const bonus = combo > 3 ? Math.floor(combo * 0.5) : 0;
            const pts   = 1 + bonus;
            score += pts;
            if (score > best) { best = score; localStorage.setItem('colorup_v7_best', best); }
            onScore(score);

            const col = COLORS[ball.colorIdx].fill;
            burst(ball.x, ball.screenY, col, 14);
            rings.push({ x:ball.x, y:ball.screenY, r:BALL_R, maxR:68, alpha:0.88, col });

            const label = combo > 2 ? `×${combo}  +${pts}` : `+${pts}`;
            floatTexts.push({ x:ball.x, y:ball.screenY-34, text:label,
                col:combo>2?'#FFD700':'#00FF88', life:800, op:1 });
            if (combo >= 5) { shakeT = 3; flashA = 0.08; flashCol = col; }

            findAndLaunchNext();
        } else {
            die();
        }
    }

    // Find the next unvisited plate closest to (but still above) ball land Y
    function findAndLaunchNext() {
        // After a plate is passed, find next closest unvisited above BALL_LAND_Y
        // Give a tiny grace period for plate to scroll a bit
        let nextIdx = -1;
        let bestDist = Infinity;

        for (let i = 0; i < plates.length; i++) {
            const p = plates[i];
            if (p.passed) continue;
            // Plate must still be above ball landing zone
            if (p.y < BALL_LAND_Y + 10) {
                const dist = BALL_LAND_Y - p.y;
                if (dist >= 0 && dist < bestDist) {
                    bestDist = dist;
                    nextIdx  = i;
                }
            }
        }

        // If no plate found above yet, find closest one coming down
        if (nextIdx < 0) {
            let closestY = Infinity;
            for (let i = 0; i < plates.length; i++) {
                const p = plates[i];
                if (p.passed) continue;
                const dist = p.y - (BALL_LAND_Y - PLATE_SPACING * 0.1);
                if (dist > 0 && p.y < closestY) {
                    closestY = p.y;
                    nextIdx  = i;
                }
            }
        }

        if (nextIdx >= 0) {
            launchToPlate(nextIdx);
        } else {
            // Retry shortly
            setTimeout(() => {
                if (gameState !== STATE.PLAYING) return;
                findAndLaunchNext();
            }, 50);
        }
    }

    function getColAt(bx) {
        for (let i = 0; i < 4; i++) {
            const px = PLATE_GAP + i * (PLATE_W + PLATE_GAP);
            if (bx >= px && bx <= px + PLATE_W) return i;
        }
        return -1;
    }

    function die() {
        gameState = STATE.DEAD; deadTimer = 0;
        ball.bouncing = false; dragging = false;
        ball.squash   = 1.8; ball.stretch = 0.4;
        const col = ball.colorIdx >= 0 ? COLORS[ball.colorIdx].fill : '#ffffff';
        burst(ball.x, ball.screenY, col, 28);
        burst(ball.x, ball.screenY, '#FF2244', 18);
        flashA = 0.7; flashCol = '#FF1133'; shakeT = 20; combo = 0;
        onScore(score, true);
    }

    // ════════════════════════════
    //  FX
    // ════════════════════════════
    function burst(x, y, col, n) {
        for (let i = 0; i < n && particles.length < 250; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * 6 + 1.5;
            particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2.8,
                r:Math.random()*5+1.5, life:1, col });
        }
    }

    function updateFX(S, dt) {
        if (flashA > 0) flashA = Math.max(0, flashA - 0.022 * S);
        if (shakeT > 0) {
            shakeT = Math.max(0, shakeT - S);
            shakeX = (Math.random()-0.5) * shakeT * 0.9;
            shakeY = (Math.random()-0.5) * shakeT * 0.45;
        } else { shakeX = 0; shakeY = 0; }

        rings      = rings.filter(r => { r.r += 4*S; r.alpha -= 0.036*S; return r.alpha > 0; });
        particles  = particles.filter(p => {
            p.x += p.vx*S; p.y += p.vy*S; p.vy += 0.22*S; p.vx *= 0.96;
            p.life -= 0.026*S; return p.life > 0;
        });
        floatTexts = floatTexts.filter(t => {
            t.y -= 0.95*S; t.life -= dt; t.op = Math.min(1, t.life/300); return t.life > 0;
        });
        for (const p of plates) {
            if (p.flashT > 0) p.flashT = Math.max(0, p.flashT - 0.055*S);
        }
    }

    // ════════════════════════════
    //  DRAW
    // ════════════════════════════
    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#160828';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(shakeX || 0, shakeY || 0);

        drawBG();
        drawColGuides();

        // Draw bounce path guide (dotted arc)
        if (gameState === STATE.PLAYING && ball.bouncing) drawBounceGuide();

        drawPlates();
        drawTrail();
        drawBall();
        drawRings();
        drawParticles();
        drawFloatTexts();

        if (flashA > 0.005) {
            ctx.globalAlpha = flashA; ctx.fillStyle = flashCol;
            ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        }
        ctx.restore();

        drawHUD();
        if (gameState === STATE.READY) drawReady();
        if (gameState === STATE.DEAD)  drawDead();
    }

    // Dotted arc showing where ball will travel
    function drawBounceGuide() {
        ctx.save();
        ctx.setLineDash([3, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.04) {
            const arc = Math.sin(t * Math.PI);
            const gy  = ball.bounceStartY + (ball.bouncePeakY - ball.bounceStartY) * arc;
            const gx  = ball.x;
            if (t === 0) ctx.moveTo(gx, gy);
            else         ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawBG() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(72,8,118,0.22)');
        g.addColorStop(1, 'rgba(8,2,26,0.18)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        stars.forEach(s => {
            ctx.globalAlpha = 0.05 + ((Math.sin(s.ph)+1)*0.5)*0.24;
            ctx.fillStyle   = '#cce8ff';
            ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawColGuides() {
        if (gameState !== STATE.PLAYING) return;
        for (let i = 0; i < 4; i++) {
            const px = PLATE_GAP + i * (PLATE_W + PLATE_GAP);
            ctx.globalAlpha = 0.035;
            ctx.fillStyle   = COLORS[i].fill;
            ctx.fillRect(px, 0, PLATE_W, H);
        }
        ctx.globalAlpha = 1;
    }

    function drawPlates() {
        for (const plate of plates) {
            if (plate.y < -PLATE_H*2 || plate.y > H + PLATE_H*2) continue;
            if (plate.type === 'full') drawFull(plate);
            else                       drawQuad(plate);
        }
    }

    function drawFull(plate) {
        const col = COLORS[plate.colorIdx];
        const h   = PLATE_H + 6;
        const x   = PLATE_GAP;
        const w   = W - PLATE_GAP * 2;
        const y   = plate.y - h / 2;
        const R   = h / 2;

        ctx.save();
        ctx.globalAlpha = plate.passed ? Math.max(0, plate.flashT * 0.5) : 0.94;
        if (!plate.passed) { ctx.shadowColor = col.fill; ctx.shadowBlur = 18; }

        const g = ctx.createLinearGradient(x, y, x, y+h);
        g.addColorStop(0, lighten(col.fill, 60));
        g.addColorStop(0.5, col.fill);
        g.addColorStop(1, col.stroke);

        ctx.fillStyle = (plate.flashT > 0.55 && plate.correct) ? '#ffffff' : g;
        rrect(x, y, w, h, R); ctx.fill(); ctx.shadowBlur = 0;

        if (!plate.passed) {
            ctx.globalAlpha = 0.82;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
            rrect(x, y, w, h, R); ctx.stroke();

            ctx.globalAlpha = 0.16;
            ctx.fillStyle   = '#ffffff';
            rrect(x+6, y+3, w-12, h*0.35, R*0.4); ctx.fill();

            ctx.globalAlpha  = 0.92;
            ctx.font         = `bold ${Math.max(10, PLATE_H*0.42)}px Arial`;
            ctx.fillStyle    = '#ffffff';
            ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor  = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
            ctx.fillText(col.name, W/2, plate.y); ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    function drawQuad(plate) {
        const h = PLATE_H;
        const R = h / 2;

        for (let i = 0; i < 4; i++) {
            const colorIdx = plate.colors[i];
            const col      = COLORS[colorIdx];
            const px       = PLATE_GAP + i * (PLATE_W + PLATE_GAP);
            const w        = PLATE_W;
            const y        = plate.y - h / 2;

            const isHit   = plate.hitIdx === i;
            const isMatch = !plate.passed && ball.colorIdx >= 0 && colorIdx === ball.colorIdx;
            const flash   = isHit ? plate.flashT : 0;

            ctx.save();
            if (isMatch) { ctx.shadowColor = col.fill; ctx.shadowBlur = 16; }
            if (flash > 0) {
                ctx.shadowColor = plate.correct ? '#00FF88' : '#FF2244';
                ctx.shadowBlur  = 26 * flash;
            }

            let alpha = plate.passed
                ? (isHit ? Math.max(0, plate.flashT*0.6) : 0)
                : (0.85 + (isMatch ? 0.15 : 0));
            ctx.globalAlpha = alpha;

            const g = ctx.createLinearGradient(px, y, px, y+h);
            g.addColorStop(0, lighten(col.fill, 50));
            g.addColorStop(0.5, col.fill);
            g.addColorStop(1, col.stroke);

            ctx.fillStyle = (flash>0.55 && isHit)
                ? (plate.correct ? '#44FF88' : '#FF3355') : g;
            rrect(px, y, w, h, R); ctx.fill(); ctx.shadowBlur = 0;

            if (!plate.passed) {
                ctx.globalAlpha = isMatch ? 1.0 : 0.38;
                ctx.strokeStyle = isMatch ? '#ffffff' : col.stroke;
                ctx.lineWidth   = isMatch ? 2.5 : 1;
                rrect(px, y, w, h, R); ctx.stroke();

                ctx.globalAlpha = 0.14;
                ctx.fillStyle   = '#ffffff';
                rrect(px+3, y+3, w-6, h*0.35, R*0.4); ctx.fill();

                // Match dot indicator
                ctx.globalAlpha = isMatch ? 1.0 : 0.28;
                ctx.fillStyle   = '#ffffff';
                ctx.shadowColor = isMatch ? '#ffffff' : 'transparent';
                ctx.shadowBlur  = isMatch ? 8 : 0;
                ctx.beginPath();
                ctx.arc(px+w/2, plate.y, isMatch ? 5 : 3, 0, Math.PI*2);
                ctx.fill(); ctx.shadowBlur = 0;
            }
            ctx.restore();
        }
    }

    function drawTrail() {
        for (let i = 0; i < ball.trail.length; i++) {
            const t     = ball.trail[i];
            const pct   = (1 - i / ball.trail.length) * (t.fade !== undefined ? t.fade : 1);
            if (pct <= 0) continue;
            const col   = t.c >= 0 ? COLORS[t.c].fill : '#aaaacc';
            ctx.globalAlpha = pct * 0.28;
            ctx.fillStyle   = col;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(1.5, BALL_R * pct * 0.72), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBall() {
        const bx = ball.x;
        const by = ball.screenY;
        const ci = ball.colorIdx;

        const pulse = 1 + Math.sin(ball.pulseT * 2.4) * 0.055;
        // Apply squash/stretch: scale X by squash, Y by stretch
        const rX = BALL_R * pulse * (ball.squash  || 1);
        const rY = BALL_R * pulse * (ball.stretch || 1);

        ctx.save();
        ctx.translate(bx, by);

        if (ci < 0) {
            ctx.shadowColor = 'rgba(200,200,230,0.5)'; ctx.shadowBlur = 10;
            const bg = ctx.createRadialGradient(-rX*0.3, -rY*0.35, 0, 0, 0, Math.max(rX,rY));
            bg.addColorStop(0, '#ddddf0'); bg.addColorStop(0.5, '#888899'); bg.addColorStop(1, '#444455');
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha = 0.75;
            ctx.font = `bold ${Math.round(BALL_R*1.05)}px Arial`;
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 1);
        } else {
            const col = COLORS[ci];

            // Outer glow ring
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = col.fill; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(0, 0, rX+9, rY+9, 0, 0, Math.PI*2); ctx.stroke();

            // Ball body
            ctx.globalAlpha = 1;
            ctx.shadowColor = col.fill; ctx.shadowBlur = 24;
            const bg = ctx.createRadialGradient(-rX*0.3, -rY*0.35, 0, 0, 0, Math.max(rX,rY)*1.1);
            bg.addColorStop(0, lighten(col.fill, 80));
            bg.addColorStop(0.4, col.fill);
            bg.addColorStop(0.85, col.stroke);
            bg.addColorStop(1, col.stroke);
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, 0, rX, rY, 0, 0, Math.PI*2); ctx.stroke();
        }

        // Shine highlight
        ctx.globalAlpha = 0.32; ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-rX*0.25, -rY*0.28, rX*0.28, rY*0.18, -0.3, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    function drawRings() {
        for (const r of rings) {
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.strokeStyle = r.col;
            ctx.lineWidth   = 2.8 * r.alpha;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life * 0.88);
            ctx.fillStyle   = p.col;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r*p.life), 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloatTexts() {
        for (const t of floatTexts) {
            ctx.save(); ctx.globalAlpha = t.op;
            ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.col; ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }

    // ════════════════════════════
    //  HUD
    // ════════════════════════════
    function drawHUD() {
        if (gameState === STATE.READY) return;

        const bW=175, bH=44, bX=W/2-bW/2, bY=10;
        ctx.fillStyle   = 'rgba(70,15,35,0.88)';
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
        rrect(bX,bY,bW,bH,12); ctx.fill();
        rrect(bX,bY,bW,bH,12); ctx.stroke();

        ctx.font='bold 24px Arial'; ctx.fillStyle='#ffffff';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(score.toLocaleString(), W/2, bY+bH*0.42);
        if (best>0) {
            ctx.font='10px Arial'; ctx.fillStyle='rgba(255,255,255,0.38)';
            ctx.fillText('Best  '+best, W/2, bY+bH*0.82);
        }

        // Color indicator
        const ci=ball.colorIdx;
        ctx.fillStyle='rgba(20,5,40,0.85)';
        rrect(8,10,46,28,8); ctx.fill();
        if (ci>=0) {
            const col=COLORS[ci];
            ctx.fillStyle=col.fill; ctx.shadowColor=col.fill; ctx.shadowBlur=12;
            ctx.beginPath(); ctx.arc(31,24,10,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
            ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.8;
            ctx.beginPath(); ctx.arc(31,24,10,0,Math.PI*2); ctx.stroke();
        } else {
            ctx.font='bold 12px Arial'; ctx.fillStyle='rgba(180,180,210,0.8)';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('?',31,24);
        }

        // Speed badge
        const spdPct = Math.min(1, (speedMult-1.0)/(2.8-1.0));
        const spdLvl = Math.min(10, Math.ceil(spdPct*10)+1);
        ctx.fillStyle='rgba(20,5,40,0.85)';
        rrect(W-54,10,46,28,8); ctx.fill();
        ctx.font='bold 10px Arial'; ctx.fillStyle='#CC88FF';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('SPD '+spdLvl, W-31, 24);

        // Combo
        if (combo>2) {
            const blink=0.52+Math.sin(bgT*7)*0.42;
            ctx.globalAlpha=blink; ctx.font='bold 14px Arial';
            ctx.fillStyle='#FFD700'; ctx.textAlign='center';
            ctx.fillText(`🔥 ${combo} COMBO`, W/2, bY+bH+16);
            ctx.globalAlpha=1;
        }

        drawColorBar();

        if (score<3 && ci>=0) {
            const blink=0.28+Math.sin(bgT*2.2)*0.30;
            ctx.globalAlpha=blink; ctx.font='12px Arial';
            ctx.fillStyle='rgba(180,180,255,0.9)'; ctx.textAlign='center';
            ctx.fillText('← DRAG ball to matching color →', W/2, H-14);
            ctx.globalAlpha=1;
        }
    }

    function drawColorBar() {
        const n=COLORS.length, sw=34, sh=8, gap=9;
        const totW=n*sw+(n-1)*gap, sx=W/2-totW/2, sy=H-20;
        COLORS.forEach((col,i) => {
            const isActive=i===ball.colorIdx;
            const px=sx+i*(sw+gap), ph=isActive?sh+5:sh, py=sy+(isActive?0:3);
            ctx.save();
            ctx.fillStyle  =isActive?col.fill:col.fill+'44';
            ctx.shadowColor=isActive?col.fill:'transparent';
            ctx.shadowBlur =isActive?10:0;
            rrect(px,py,sw,ph,ph/2); ctx.fill();
            if (isActive) {
                ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
                rrect(px,py,sw,ph,ph/2); ctx.stroke();
            }
            ctx.restore();
        });
    }

    // ════════════════════════════
    //  SCREENS
    // ════════════════════════════
    function drawReady() {
        ctx.fillStyle='rgba(0,0,15,0.86)'; ctx.fillRect(0,0,W,H);
        const cx=W/2, cy=H/2, pw=Math.min(W-28,308), ph=340;
        ctx.fillStyle='rgba(20,5,44,0.97)';
        ctx.strokeStyle='rgba(165,85,255,0.28)'; ctx.lineWidth=1.5;
        rrect(cx-pw/2,cy-ph/2,pw,ph,22); ctx.fill();
        rrect(cx-pw/2,cy-ph/2,pw,ph,22); ctx.stroke();

        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='bold 36px Arial'; ctx.fillStyle='#00FF88';
        ctx.shadowColor='#00FF88'; ctx.shadowBlur=18;
        ctx.fillText('COLOR UP', cx, cy-ph/2+50); ctx.shadowBlur=0;

        ctx.font='13px Arial'; ctx.fillStyle='rgba(190,168,255,0.65)';
        ctx.fillText('Plates scroll down to meet the ball!', cx, cy-ph/2+82);
        ctx.fillText('Drag ball to the matching color!', cx, cy-ph/2+102);

        const steps=[
            {icon:'⚪',text:'Ball starts colorless'},
            {icon:'🎨',text:'Full plate → ball gets that color'},
            {icon:'↔️', text:'Drag to matching column plate'},
            {icon:'⚡',text:'Speed increases — stay sharp!'},
        ];
        steps.forEach((s,i)=>{
            ctx.font='13px Arial'; ctx.fillStyle='rgba(200,185,255,0.72)';
            ctx.textAlign='left';
            ctx.fillText(s.icon+'  '+s.text, cx-pw/2+26, cy-46+i*30);
        });

        const n=COLORS.length, sw=44, sh=20, gap=7;
        let sx=cx-(n*sw+(n-1)*gap)/2;
        COLORS.forEach(col=>{
            ctx.fillStyle=col.fill; ctx.shadowColor=col.fill; ctx.shadowBlur=10;
            rrect(sx,cy+88,sw,sh,sh/2); ctx.fill(); ctx.shadowBlur=0;
            ctx.font='bold 9px Arial'; ctx.fillStyle='#ffffff'; ctx.textAlign='center';
            ctx.fillText(col.name, sx+sw/2, cy+88+sh/2); sx+=sw+gap;
        });

        if (best>0) {
            ctx.font='bold 13px Arial'; ctx.fillStyle='#FFD700'; ctx.textAlign='center';
            ctx.fillText('⭐ Best: '+best, cx, cy+124);
        }

        const blink=0.42+Math.sin(bgT*2.8)*0.45;
        ctx.globalAlpha=blink; ctx.font='bold 20px Arial'; ctx.fillStyle='#00DDFF';
        ctx.textAlign='center';
        ctx.fillText('▶  TAP TO START', cx, cy+ph/2-24);
        ctx.globalAlpha=1;
    }

    function drawDead() {
        const fade=Math.min(1,deadTimer/500);
        ctx.fillStyle=`rgba(0,0,10,${fade*0.85})`; ctx.fillRect(0,0,W,H);
        if (fade<0.22) return;

        const pa=Math.min(1,(fade-0.22)/0.78);
        const cx=W/2, cy=H/2, pw=Math.min(W-30,300), ph=275;

        ctx.save(); ctx.globalAlpha=pa;
        ctx.fillStyle='rgba(4,1,18,0.98)';
        ctx.strokeStyle='rgba(255,28,75,0.42)'; ctx.lineWidth=1.5;
        rrect(cx-pw/2,cy-ph/2,pw,ph,22); ctx.fill();
        rrect(cx-pw/2,cy-ph/2,pw,ph,22); ctx.stroke();

        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='bold 30px Arial'; ctx.fillStyle='#FF2255';
        ctx.shadowColor='#FF2255'; ctx.shadowBlur=16;
        ctx.fillText('GAME OVER', cx, cy-ph/2+42); ctx.shadowBlur=0;

        ctx.fillStyle='rgba(255,255,255,0.06)';
        ctx.fillRect(cx-pw/2+22,cy-ph/2+66,pw-44,1);

        const isNewBest=score>=best && score>0;
        const stats=[
            {l:'SCORE',     v:score,        col:isNewBest?'#00FFDD':'#fff',big:true},
            {l:'BEST',      v:best,          col:isNewBest?'#FFD700':'#888'},
            {l:'MAX COMBO', v:'×'+maxCombo, col:'#FF8800'},
            {l:'SPEED LVL', v:spdLvl(),     col:'#CC88FF'},
        ];
        stats.forEach((s,i)=>{
            const ry=cy-ph/2+88+i*37;
            ctx.font='11px Arial'; ctx.fillStyle='rgba(145,125,188,1)'; ctx.textAlign='left';
            ctx.fillText(s.l, cx-pw/2+24, ry);
            ctx.font=`bold ${s.big?22:16}px Arial`; ctx.fillStyle=s.col; ctx.textAlign='right';
            ctx.fillText(typeof s.v==='number'?s.v.toLocaleString():s.v, cx+pw/2-24, ry);
            if (i<stats.length-1) {
                ctx.fillStyle='rgba(255,255,255,0.04)';
                ctx.fillRect(cx-pw/2+20,ry+15,pw-40,1);
            }
        });

        if (isNewBest) {
            ctx.fillStyle='rgba(255,215,0,0.10)'; ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=1;
            rrect(cx-72,cy-ph/2+81,144,22,6); ctx.fill();
            rrect(cx-72,cy-ph/2+81,144,22,6); ctx.stroke();
            ctx.font='bold 10px Arial'; ctx.fillStyle='#FFD700'; ctx.textAlign='center';
            ctx.fillText('✦  NEW BEST!  ✦', cx, cy-ph/2+93);
        }

        if (deadTimer>800) {
            const bp=0.42+Math.sin(bgT*3.2)*0.44;
            ctx.globalAlpha=pa*bp; ctx.font='bold 16px Arial'; ctx.fillStyle='#CC55FF';
            ctx.textAlign='center';
            ctx.fillText('● TAP TO PLAY AGAIN ●', cx, cy+ph/2-22);
        }
        ctx.restore();
    }

    function spdLvl() {
        return Math.min(10, Math.ceil(Math.min(1,(speedMult-1.0)/(2.8-1.0))*10)+1);
    }

    // ════════════════════════════
    //  HELPERS
    // ════════════════════════════
    function rrect(x, y, w, h, r) {
        r = Math.min(r, w/2, h/2);
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w,y, x+w,y+h, r);
        ctx.arcTo(x+w,y+h, x,y+h, r);
        ctx.arcTo(x,y+h, x,y, r);
        ctx.arcTo(x,y, x+w,y, r);
        ctx.closePath();
    }

    function lighten(hex, amt) {
        const num=parseInt(hex.replace('#',''),16);
        const r=Math.min(255,(num>>16)+amt);
        const g=Math.min(255,((num>>8)&0xff)+amt);
        const b=Math.min(255,(num&0xff)+amt);
        return `rgb(${r},${g},${b})`;
    }

    // ════════════════════════════
    //  LOOP
    // ════════════════════════════
    function loop(ts) {
        if (destroyed) return;
        const dt = Math.min(ts - (lastTS || ts), 48);
        lastTS = ts;
        if (!paused) update(dt);
        draw();
        raf = requestAnimationFrame(loop);
    }

    // ════════════════════════════
    //  PUBLIC API
    // ════════════════════════════
    const instance = {
        togglePause() {
            paused = !paused;
            if (!paused) lastTS = performance.now();
            return paused;
        },
        resize() {
            const p = canvas.parentElement;
            const w = (p && p.clientWidth  > 10) ? p.clientWidth  : window.innerWidth;
            const h = (p && p.clientHeight > 10) ? p.clientHeight : window.innerHeight;
            canvas.width  = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width  = w + 'px';
            canvas.style.height = h + 'px';
            initLayout();
        },
        destroy() {
            destroyed = true;
            cancelAnimationFrame(raf);
            canvas.removeEventListener('touchstart', _ev.onTD);
            canvas.removeEventListener('touchmove',  _ev.onTM);
            canvas.removeEventListener('touchend',   _ev.onTE);
            canvas.removeEventListener('mousedown',  _ev.onMD);
            window.removeEventListener('mousemove',  _ev.onMM);
            window.removeEventListener('mouseup',    _ev.onMU);
        },
        get isPaused() { return paused; }
    };

    window._activeGameInstance = instance;
    return instance;

}; // end window.initColorUp