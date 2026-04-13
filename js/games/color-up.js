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
    let best     = parseInt(localStorage.getItem('colorup_v6_best') || '0');
    let combo    = 0;
    let maxCombo = 0;

    // ── BALL ──
    const BALL_R = 14;
    const ball = {
        x: 0, y: 0,        // logical world Y (stays with plate grid)
        screenY: 0,         // visual Y on screen (for arc animation)
        targetX: 0,
        colorIdx: -1,
        bouncing: false,
        bounceFromScreenY: 0,
        bounceToScreenY: 0,
        bounceT: 0,
        bounceDur: 0,
        trail: [],
        pulseT: 0,
    };

    // ── PLATES ──
    // Plates move DOWN (scroll down toward player)
    // Ball stays roughly at a fixed screen zone, plates come to it
    const QUADS_PER_FULL = 3;
    let plates         = [];
    let targetPlateIdx = -1;
    let seqCount       = 0;
    let nextBallColor  = -1;

    // Layout
    let PLATE_H       = 0;
    let PLATE_GAP     = 0;
    let PLATE_W       = 0;
    let PLATE_SPACING = 0;   // vertical distance between plate centers

    // Ball target screen Y zone (lower portion of screen)
    let BALL_ZONE_Y   = 0;   // where ball visually sits when not bouncing

    // Scroll speed (plates move down toward ball)
    let scrollSpeed = 1.2;

    // FX
    let particles  = [];
    let floatTexts = [];
    let rings      = [];
    let flashA     = 0;
    let flashCol   = '#fff';
    let shakeX = 0, shakeY = 0, shakeT = 0;
    let bgT    = 0;
    let deadTimer = 0;

    const stars = mkStars(50);

    let dragging  = false;
    let _ev       = {};

    initLayout();
    bindInput();

    raf = requestAnimationFrame(loop);

    const titleEl = document.getElementById('current-game-title');
    if (titleEl) titleEl.textContent = 'Color Up';

    // ════════════════════════════
    //  LAYOUT
    // ════════════════════════════
    function initLayout() {
        W = canvas.width  / dpr;
        H = canvas.height / dpr;

        PLATE_GAP     = 6;
        PLATE_W       = (W - 5 * PLATE_GAP) / 4;
        PLATE_H       = Math.round(H * 0.07);   // ~7% of screen height
        PLATE_SPACING = Math.round(H * 0.18);   // plates spaced 18% of screen apart

        // Ball lives in lower 75% of screen
        BALL_ZONE_Y   = H * 0.75;

        ball.x       = W / 2;
        ball.y       = BALL_ZONE_Y;
        ball.screenY = BALL_ZONE_Y;
        ball.targetX = W / 2;
    }

    function mkStars(n) {
        return Array.from({ length: n }, () => ({
            x: Math.random(), y: Math.random(),
            r:  Math.random() * 1.2 + 0.2,
            ph: Math.random() * Math.PI * 2,
            sp: Math.random() * 0.012 + 0.003,
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
        scrollSpeed = 1.2;
        seqCount = 0; plates = []; targetPlateIdx = -1;
        particles = []; floatTexts = []; rings = [];
        flashA = 0; shakeT = 0; deadTimer = 0;
        dragging = false; nextBallColor = -1;

        ball.colorIdx = -1;
        ball.x        = W / 2;
        ball.targetX  = W / 2;
        ball.y        = BALL_ZONE_Y;
        ball.screenY  = BALL_ZONE_Y;
        ball.bouncing = false;
        ball.trail    = [];
        ball.pulseT   = 0;

        gameState = STATE.PLAYING;
        onScore(0);

        buildPlates();
        // Launch to first plate immediately
        launchToPlate(0);
    }

    // ── Build initial plate stack ──
    // Plates are placed ABOVE ball zone, going upward
    // They will scroll DOWN toward the ball
    function buildPlates() {
        // First plate: just above ball zone
        let y = BALL_ZONE_Y - PLATE_SPACING;

        const firstColor = Math.floor(Math.random() * COLORS.length);
        plates.push(makePlate('full', y, firstColor));
        seqCount  = 1;
        nextBallColor = firstColor;
        y -= PLATE_SPACING;

        // More plates above
        for (let i = 0; i < 12; i++) {
            pushNextPlate(y);
            y -= PLATE_SPACING;
        }
    }

    function makePlate(type, y, colorIdx) {
        if (type === 'full') {
            return { type: 'full', colorIdx, y, passed: false, flashT: 0, correct: false };
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

    // Refill plates above the topmost visible plate
    function refillAbove() {
        // Find topmost plate Y
        let minY = Infinity;
        for (const p of plates) if (p.y < minY) minY = p.y;

        // Keep adding plates above until we have enough offscreen
        while (minY > -PLATE_SPACING * 3) {
            minY -= PLATE_SPACING;
            pushNextPlate(minY);
        }
    }

    // ════════════════════════════
    //  BOUNCE / LAUNCH
    // ════════════════════════════
    function launchToPlate(idx) {
        if (idx < 0 || idx >= plates.length) return;
        const plate = plates[idx];
        targetPlateIdx = idx;

        // Ball bounces UP to meet the plate
        // The plate will be scrolling down, so we calculate
        // where the plate will be on screen when ball arrives

        // Duration based on spacing (consistent feel)
        const dur = Math.max(350, Math.min(700, PLATE_SPACING * 3.5));

        ball.bouncing         = true;
        ball.bounceFromScreenY = ball.screenY;
        // Ball goes UP by one plate spacing worth of arc
        ball.bounceToScreenY  = BALL_ZONE_Y;   // ball returns to zone Y after each bounce
        ball.bounceT          = 0;
        ball.bounceDur        = dur;
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

        // Speed ramp
        scrollSpeed = Math.min(3.5, 1.2 + score * 0.008);

        // ── Scroll plates DOWN toward ball ──
        const scroll = scrollSpeed * S;
        for (const p of plates) p.y += scroll;

        // ── Ball X smooth ──
        ball.x += (ball.targetX - ball.x) * 0.18 * S;

        // ── Ball bounce arc ──
        if (ball.bouncing) {
            ball.bounceT += dt / ball.bounceDur;

            if (ball.bounceT >= 1) {
                ball.bounceT  = 1;
                ball.bouncing = false;
                ball.screenY  = BALL_ZONE_Y;
                ball.y        = BALL_ZONE_Y;
                onArrived();
            } else {
                const t = ball.bounceT;
                // Ease: ease-in-out
                const ft = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

                // Arc: ball goes up (negative) then comes back down
                // Peak at midpoint = one plate spacing up from zone
                const arcHeight = PLATE_SPACING * 0.55;
                const arc = Math.sin(t * Math.PI) * arcHeight;
                ball.screenY = BALL_ZONE_Y - arc;
                ball.y       = ball.screenY;
            }

            // Trail
            ball.trail.unshift({ x: ball.x, y: ball.screenY, c: ball.colorIdx });
            if (ball.trail.length > 20) ball.trail.pop();
        }

        // ── Check collision: when target plate scrolls to ball zone ──
        if (ball.bouncing && targetPlateIdx >= 0 && targetPlateIdx < plates.length) {
            const tp = plates[targetPlateIdx];
            // When plate Y reaches ball zone while ball is also reaching zone
            if (tp.y >= BALL_ZONE_Y - 8 && ball.bounceT >= 0.88) {
                // Snap
                ball.bounceT  = 1;
                ball.bouncing = false;
                ball.screenY  = BALL_ZONE_Y;
                onArrived();
            }
        }

        // Remove plates that have scrolled well below screen
        plates = plates.filter(p => p.y < H + PLATE_SPACING * 2);

        // Refill above
        refillAbove();

        // Flash decay on plates
        for (const p of plates) {
            if (p.flashT > 0) p.flashT = Math.max(0, p.flashT - 0.055 * S);
        }
    }

    // ════════════════════════════
    //  COLLISION
    // ════════════════════════════
    function onArrived() {
        const idx   = targetPlateIdx;
        const plate = plates[idx];
        if (!plate || plate.passed) { goToNext(); return; }

        plate.passed = true;
        plate.flashT = 1;

        if (plate.type === 'full') hitFull(plate);
        else                       hitQuad(plate);
    }

    function hitFull(plate) {
        ball.colorIdx = plate.colorIdx;
        plate.correct = true;
        const col = COLORS[plate.colorIdx];

        burst(ball.x, ball.screenY, col.fill, 18);
        rings.push({ x:ball.x, y:ball.screenY, r:BALL_R, maxR:88, alpha:0.92, col:col.fill });
        rings.push({ x:ball.x, y:ball.screenY, r:BALL_R+12, maxR:115, alpha:0.50, col:col.fill });
        floatTexts.push({ x:ball.x, y:ball.screenY-36, text:col.name+'!', col:col.fill, life:900, op:1 });
        flashA = 0.22; flashCol = col.fill;

        goToNext();
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
            if (score > best) { best = score; localStorage.setItem('colorup_v6_best', best); }
            onScore(score);

            const col = COLORS[ball.colorIdx].fill;
            burst(ball.x, ball.screenY, col, 13);
            rings.push({ x:ball.x, y:ball.screenY, r:BALL_R, maxR:65, alpha:0.85, col });

            const label = combo > 2 ? `×${combo}  +${pts}` : `+${pts}`;
            floatTexts.push({ x:ball.x, y:ball.screenY-32, text:label, col:combo>2?'#FFD700':'#00FF88', life:780, op:1 });
            if (combo >= 5) { shakeT = 3; flashA = 0.08; flashCol = col; }

            goToNext();
        } else {
            die();
        }
    }

    // Find next unvisited plate (the one that hasn't scrolled past ball yet)
    function goToNext() {
        // After current plate is done, wait for next plate to come down
        // Find the closest plate ABOVE ball zone that hasn't been passed
        let nextIdx = -1;
        let bestY   = -Infinity;   // want highest Y (most negative = furthest up)

        for (let i = 0; i < plates.length; i++) {
            const p = plates[i];
            if (p.passed) continue;
            // Plate must be above current ball zone (not yet scrolled to ball)
            if (p.y < BALL_ZONE_Y && p.y > bestY) {
                bestY   = p.y;
                nextIdx = i;
            }
        }

        if (nextIdx >= 0) {
            launchToPlate(nextIdx);
        } else {
            // No plate above yet — wait a tiny bit and retry
            setTimeout(() => {
                if (gameState !== STATE.PLAYING) return;
                goToNext();
            }, 80);
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
        const col = ball.colorIdx >= 0 ? COLORS[ball.colorIdx].fill : '#ffffff';
        burst(ball.x, ball.screenY, col, 24);
        burst(ball.x, ball.screenY, '#FF2244', 16);
        flashA = 0.65; flashCol = '#FF1133'; shakeT = 18; combo = 0;
        onScore(score, true);
    }

    // ════════════════════════════
    //  FX
    // ════════════════════════════
    function burst(x, y, col, n) {
        for (let i = 0; i < n && particles.length < 220; i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 5.5 + 1.5;
            particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2.5, r:Math.random()*5+1.5, life:1, col });
        }
    }

    function updateFX(S, dt) {
        if (flashA > 0) flashA = Math.max(0, flashA - 0.020 * S);
        if (shakeT > 0) {
            shakeT = Math.max(0, shakeT - S);
            shakeX = (Math.random() - 0.5) * shakeT * 0.85;
            shakeY = (Math.random() - 0.5) * shakeT * 0.42;
        } else { shakeX = 0; shakeY = 0; }

        rings      = rings.filter(r => { r.r += 3.8*S; r.alpha -= 0.034*S; return r.alpha > 0; });
        particles  = particles.filter(p => {
            p.x += p.vx*S; p.y += p.vy*S; p.vy += 0.2*S; p.vx *= 0.96;
            p.life -= 0.028*S; return p.life > 0;
        });
        floatTexts = floatTexts.filter(t => {
            t.y -= 0.90*S; t.life -= dt; t.op = Math.min(1, t.life/300); return t.life > 0;
        });
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

    function drawBG() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(72,8,118,0.22)');
        g.addColorStop(1, 'rgba(8,2,26,0.18)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        stars.forEach(s => {
            ctx.globalAlpha = 0.05 + ((Math.sin(s.ph)+1)*0.5)*0.26;
            ctx.fillStyle   = '#cce8ff';
            ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawColGuides() {
        if (gameState !== STATE.PLAYING) return;
        for (let i = 0; i < 4; i++) {
            const px = PLATE_GAP + i * (PLATE_W + PLATE_GAP);
            ctx.globalAlpha = 0.04;
            ctx.fillStyle   = COLORS[i].fill;
            ctx.fillRect(px, 0, PLATE_W, H);
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw all plates at their current Y ──
    function drawPlates() {
        for (const plate of plates) {
            // Only draw if on screen
            if (plate.y < -PLATE_H || plate.y > H + PLATE_H) continue;
            if (plate.type === 'full') drawFull(plate);
            else                       drawQuad(plate);
        }
    }

    function drawFull(plate) {
        const col = COLORS[plate.colorIdx];
        const h   = PLATE_H + 8;
        const x   = PLATE_GAP;
        const w   = W - PLATE_GAP * 2;
        const y   = plate.y - h / 2;
        const R   = h / 2;

        ctx.save();
        ctx.globalAlpha = plate.passed ? Math.max(0, plate.flashT * 0.5) : 0.94;
        if (!plate.passed) { ctx.shadowColor = col.fill; ctx.shadowBlur = 20; }

        const g = ctx.createLinearGradient(x, y, x, y+h);
        g.addColorStop(0, lighten(col.fill, 60));
        g.addColorStop(0.5, col.fill);
        g.addColorStop(1, col.stroke);

        ctx.fillStyle = (plate.flashT > 0.55 && plate.correct) ? '#ffffff' : g;
        rrect(x, y, w, h, R); ctx.fill();
        ctx.shadowBlur = 0;

        if (!plate.passed) {
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            rrect(x, y, w, h, R); ctx.stroke();

            // Shine
            ctx.globalAlpha = 0.18;
            ctx.fillStyle   = '#ffffff';
            rrect(x+6, y+3, w-12, h*0.32, R*0.4); ctx.fill();

            // Label
            ctx.globalAlpha  = 0.92;
            ctx.font         = `bold ${Math.max(11, PLATE_H*0.38)}px Arial`;
            ctx.fillStyle    = '#ffffff';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
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
            if (isMatch) { ctx.shadowColor = col.fill; ctx.shadowBlur = 18; }
            if (flash > 0) { ctx.shadowColor = plate.correct ? '#00FF88' : '#FF2244'; ctx.shadowBlur = 28 * flash; }

            let alpha = plate.passed
                ? (isHit ? Math.max(0, plate.flashT * 0.6) : 0)
                : (0.85 + (isMatch ? 0.15 : 0));
            ctx.globalAlpha = alpha;

            const g = ctx.createLinearGradient(px, y, px, y+h);
            g.addColorStop(0, lighten(col.fill, 50));
            g.addColorStop(0.5, col.fill);
            g.addColorStop(1, col.stroke);

            ctx.fillStyle = (flash > 0.55 && isHit)
                ? (plate.correct ? '#44FF88' : '#FF3355') : g;
            rrect(px, y, w, h, R); ctx.fill();
            ctx.shadowBlur = 0;

            if (!plate.passed) {
                ctx.globalAlpha = isMatch ? 1.0 : 0.4;
                ctx.strokeStyle = isMatch ? '#ffffff' : col.stroke;
                ctx.lineWidth   = isMatch ? 2.5 : 1.2;
                rrect(px, y, w, h, R); ctx.stroke();

                // Shine
                ctx.globalAlpha = 0.16;
                ctx.fillStyle   = '#ffffff';
                rrect(px+3, y+3, w-6, h*0.32, R*0.4); ctx.fill();

                // Center dot
                ctx.globalAlpha = isMatch ? 1.0 : 0.3;
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
            const t   = ball.trail[i];
            const pct = 1 - i / ball.trail.length;
            const col = t.c >= 0 ? COLORS[t.c].fill : '#aaaacc';
            ctx.globalAlpha = pct * 0.22;
            ctx.fillStyle   = col;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(1, BALL_R * pct * 0.7), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBall() {
        const bx    = ball.x;
        const by    = ball.screenY;
        const ci    = ball.colorIdx;
        const pulse = 1 + Math.sin(ball.pulseT * 2.2) * 0.05;
        const r     = BALL_R * pulse;

        ctx.save();

        if (ci < 0) {
            ctx.shadowColor = 'rgba(200,200,230,0.5)'; ctx.shadowBlur = 10;
            const bg = ctx.createRadialGradient(bx-r*0.3, by-r*0.35, 0, bx, by, r);
            bg.addColorStop(0, '#ddddf0'); bg.addColorStop(0.5, '#888899'); bg.addColorStop(1, '#444455');
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.stroke();
            ctx.globalAlpha  = 0.75;
            ctx.font         = `bold ${Math.round(r*1.1)}px Arial`;
            ctx.fillStyle    = '#ffffff';
            ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', bx, by+1);
        } else {
            const col = COLORS[ci];
            // Outer glow ring
            ctx.globalAlpha = 0.28; ctx.strokeStyle = col.fill; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(bx, by, r+8, 0, Math.PI*2); ctx.stroke();
            // Ball body
            ctx.globalAlpha = 1;
            ctx.shadowColor = col.fill; ctx.shadowBlur = 22;
            const bg = ctx.createRadialGradient(bx-r*0.3, by-r*0.35, 0, bx, by, r);
            bg.addColorStop(0, lighten(col.fill, 75));
            bg.addColorStop(0.4, col.fill);
            bg.addColorStop(0.85, col.stroke);
            bg.addColorStop(1, col.stroke);
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.stroke();
        }

        // Shine
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx - r*0.28, by - r*0.30, r*0.28, 0, Math.PI*2); ctx.fill();

        ctx.restore();
    }

    function drawRings() {
        for (const r of rings) {
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.strokeStyle = r.col;
            ctx.lineWidth   = 2.5 * r.alpha;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, p.life * 0.88);
            ctx.fillStyle   = p.col;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI*2); ctx.fill();
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
        rrect(bX, bY, bW, bH, 12); ctx.fill();
        rrect(bX, bY, bW, bH, 12); ctx.stroke();

        ctx.font         = 'bold 25px Arial';
        ctx.fillStyle    = '#ffffff';
        ctx.textAlign    = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(score.toLocaleString(), W/2, bY+bH*0.42);

        if (best > 0) {
            ctx.font      = '10px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.38)';
            ctx.fillText('Best  '+best, W/2, bY+bH*0.82);
        }

        // Color dot
        const ci = ball.colorIdx;
        ctx.fillStyle = 'rgba(20,5,40,0.85)';
        rrect(8, 10, 46, 28, 8); ctx.fill();
        if (ci >= 0) {
            const col = COLORS[ci];
            ctx.fillStyle = col.fill; ctx.shadowColor = col.fill; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(31, 24, 10, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.arc(31, 24, 10, 0, Math.PI*2); ctx.stroke();
        } else {
            ctx.font = 'bold 12px Arial'; ctx.fillStyle = 'rgba(180,180,210,0.8)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', 31, 24);
        }

        // Speed badge
        const spdPct = (scrollSpeed - 1.2) / (3.5 - 1.2);
        const spdLvl = Math.min(10, Math.ceil(spdPct * 10) + 1);
        ctx.fillStyle = 'rgba(20,5,40,0.85)';
        rrect(W-54, 10, 46, 28, 8); ctx.fill();
        ctx.font = 'bold 10px Arial'; ctx.fillStyle = '#CC88FF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SPD '+spdLvl, W-31, 24);

        // Combo
        if (combo > 2) {
            const blink = 0.52 + Math.sin(bgT*7)*0.42;
            ctx.globalAlpha = blink;
            ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText(`🔥 ${combo} COMBO`, W/2, bY+bH+16);
            ctx.globalAlpha = 1;
        }

        drawColorBar();

        // Hint
        if (score < 3 && ci >= 0) {
            const blink = 0.28 + Math.sin(bgT*2.2)*0.30;
            ctx.globalAlpha = blink;
            ctx.font = '12px Arial'; ctx.fillStyle = 'rgba(180,180,255,0.9)';
            ctx.textAlign = 'center';
            ctx.fillText('← DRAG ball to matching color →', W/2, H-14);
            ctx.globalAlpha = 1;
        }
    }

    function drawColorBar() {
        const n=COLORS.length, sw=34, sh=8, gap=9;
        const totW=n*sw+(n-1)*gap, sx=W/2-totW/2, sy=H-20;
        COLORS.forEach((col, i) => {
            const isActive = i === ball.colorIdx;
            const px=sx+i*(sw+gap), ph=isActive?sh+5:sh, py=sy+(isActive?0:3);
            ctx.save();
            ctx.fillStyle   = isActive ? col.fill : col.fill+'44';
            ctx.shadowColor = isActive ? col.fill : 'transparent';
            ctx.shadowBlur  = isActive ? 10 : 0;
            rrect(px, py, sw, ph, ph/2); ctx.fill();
            if (isActive) {
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
                rrect(px, py, sw, ph, ph/2); ctx.stroke();
            }
            ctx.restore();
        });
    }

    // ════════════════════════════
    //  SCREENS
    // ════════════════════════════
    function drawReady() {
        ctx.fillStyle = 'rgba(0,0,15,0.86)'; ctx.fillRect(0,0,W,H);
        const cx=W/2, cy=H/2, pw=Math.min(W-28,308), ph=340;
        ctx.fillStyle = 'rgba(20,5,44,0.97)';
        ctx.strokeStyle = 'rgba(165,85,255,0.28)'; ctx.lineWidth = 1.5;
        rrect(cx-pw/2, cy-ph/2, pw, ph, 22); ctx.fill();
        rrect(cx-pw/2, cy-ph/2, pw, ph, 22); ctx.stroke();

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 36px Arial'; ctx.fillStyle = '#00FF88';
        ctx.shadowColor = '#00FF88'; ctx.shadowBlur = 18;
        ctx.fillText('COLOR UP', cx, cy-ph/2+50); ctx.shadowBlur = 0;

        ctx.font = '13px Arial'; ctx.fillStyle = 'rgba(190,168,255,0.65)';
        ctx.fillText('Ball bounces up through plates', cx, cy-ph/2+84);
        ctx.fillText('Drag it to the matching color!', cx, cy-ph/2+104);

        const steps = [
            { icon:'⚪', text:'Ball starts colorless' },
            { icon:'🎨', text:'Full plate → ball gets that color' },
            { icon:'↔️',  text:'Drag to matching column plate' },
            { icon:'⚡', text:'Speed increases — stay sharp!' },
        ];
        steps.forEach((s,i) => {
            ctx.font = '13px Arial'; ctx.fillStyle = 'rgba(200,185,255,0.72)';
            ctx.textAlign = 'left';
            ctx.fillText(s.icon+'  '+s.text, cx-pw/2+26, cy-46+i*30);
        });

        const n=COLORS.length, sw=44, sh=20, gap=7;
        let sx=cx-(n*sw+(n-1)*gap)/2;
        COLORS.forEach(col => {
            ctx.fillStyle=col.fill; ctx.shadowColor=col.fill; ctx.shadowBlur=10;
            rrect(sx,cy+88,sw,sh,sh/2); ctx.fill(); ctx.shadowBlur=0;
            ctx.font='bold 9px Arial'; ctx.fillStyle='#ffffff'; ctx.textAlign='center';
            ctx.fillText(col.name, sx+sw/2, cy+88+sh/2); sx+=sw+gap;
        });

        if (best > 0) {
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
        const fade=Math.min(1, deadTimer/500);
        ctx.fillStyle=`rgba(0,0,10,${fade*0.85})`; ctx.fillRect(0,0,W,H);
        if (fade < 0.22) return;

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
        ctx.fillRect(cx-pw/2+22, cy-ph/2+66, pw-44, 1);

        const isNewBest = score >= best && score > 0;
        const stats = [
            {l:'SCORE',     v:score,        col:isNewBest?'#00FFDD':'#fff', big:true},
            {l:'BEST',      v:best,          col:isNewBest?'#FFD700':'#888'},
            {l:'MAX COMBO', v:'×'+maxCombo, col:'#FF8800'},
            {l:'SPEED LVL', v:Math.min(10,Math.ceil((scrollSpeed-1.2)/2.3*10)+1), col:'#CC88FF'},
        ];
        stats.forEach((s,i) => {
            const ry=cy-ph/2+88+i*37;
            ctx.font='11px Arial'; ctx.fillStyle='rgba(145,125,188,1)'; ctx.textAlign='left';
            ctx.fillText(s.l, cx-pw/2+24, ry);
            ctx.font=`bold ${s.big?22:16}px Arial`; ctx.fillStyle=s.col; ctx.textAlign='right';
            ctx.fillText(typeof s.v==='number'?s.v.toLocaleString():s.v, cx+pw/2-24, ry);
            if (i<stats.length-1) {
                ctx.fillStyle='rgba(255,255,255,0.04)';
                ctx.fillRect(cx-pw/2+20, ry+15, pw-40, 1);
            }
        });

        if (isNewBest) {
            ctx.fillStyle='rgba(255,215,0,0.10)'; ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=1;
            rrect(cx-72,cy-ph/2+81,144,22,6); ctx.fill();
            rrect(cx-72,cy-ph/2+81,144,22,6); ctx.stroke();
            ctx.font='bold 10px Arial'; ctx.fillStyle='#FFD700'; ctx.textAlign='center';
            ctx.fillText('✦  NEW BEST!  ✦', cx, cy-ph/2+93);
        }

        if (deadTimer > 800) {
            const bp=0.42+Math.sin(bgT*3.2)*0.44;
            ctx.globalAlpha=pa*bp; ctx.font='bold 16px Arial'; ctx.fillStyle='#CC55FF';
            ctx.textAlign='center';
            ctx.fillText('● TAP TO PLAY AGAIN ●', cx, cy+ph/2-22);
        }
        ctx.restore();
    }

    // ════════════════════════════
    //  HELPERS
    // ════════════════════════════
    function rrect(x, y, w, h, r) {
        r = Math.min(r, w/2, h/2);
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
    }

    function lighten(hex, amt) {
        const num = parseInt(hex.replace('#',''), 16);
        const r   = Math.min(255, (num>>16)+amt);
        const g   = Math.min(255, ((num>>8)&0xff)+amt);
        const b   = Math.min(255, (num&0xff)+amt);
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