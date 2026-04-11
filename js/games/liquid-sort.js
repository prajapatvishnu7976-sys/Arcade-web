/* ============================================
   LIQUID SORT PUZZLE - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class LiquidSort {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('liquid_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Game config
        this.level = 1;
        this.moves = 0;
        this.undoStack = [];
        this.maxUndo = 3;
        this.undoLeft = this.maxUndo;

        // Colors
        this.COLORS = [
            { fill: '#FF006E', light: '#FF66AA', dark: '#CC0055', name: 'Pink' },
            { fill: '#00D4FF', light: '#66EAFF', dark: '#0099CC', name: 'Cyan' },
            { fill: '#00FF88', light: '#66FFB8', dark: '#00CC66', name: 'Green' },
            { fill: '#FFD700', light: '#FFE866', dark: '#CCA800', name: 'Gold' },
            { fill: '#b347d9', light: '#D488F0', dark: '#8833AA', name: 'Purple' },
            { fill: '#FF8C00', light: '#FFB04D', dark: '#CC6600', name: 'Orange' },
            { fill: '#FF0055', light: '#FF5588', dark: '#CC0044', name: 'Red' },
            { fill: '#00fff5', light: '#66FFF8', dark: '#00CCBB', name: 'Teal' }
        ];

        // Tubes
        this.tubes = [];
        this.TUBE_CAPACITY = 4;
        this.selectedTube = -1;
        this.pourAnim = null;

        // Visual
        this.particles = [];
        this.scorePopups = [];
        this.winAnim = { active: false, timer: 0, stars: [] };
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';
        this.tubeAnimations = [];
        this.bubbles = [];

        // Background
        this.bgTime = 0;
        this.stars = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.5 + 0.3,
            t: Math.random() * Math.PI * 2
        }));

        // Hint system
        this.hintTimer = 0;
        this.hintActive = null;
        this.hintFlash = 0;

        this.generateLevel();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== LEVEL GENERATION ====================

    generateLevel() {
        this.selectedTube = -1;
        this.pourAnim = null;
        this.tubeAnimations = [];
        this.bubbles = [];
        this.hintActive = null;
        this.undoStack = [];
        this.undoLeft = this.maxUndo;
        this.moves = 0;

        const numColors = Math.min(3 + this.level, this.COLORS.length);
        const numTubes = numColors + 2;
        const layers = [];

        // Create layers
        for (let c = 0; c < numColors; c++) {
            for (let l = 0; l < this.TUBE_CAPACITY; l++) {
                layers.push(c);
            }
        }

        // Shuffle (Fisher-Yates)
        for (let i = layers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layers[i], layers[j]] = [layers[j], layers[i]];
        }

        // Make sure it's not already solved
        this.tubes = [];
        let layerIdx = 0;
        for (let t = 0; t < numColors; t++) {
            const tube = { layers: [], x: 0, y: 0, shake: 0, highlight: 0 };
            for (let l = 0; l < this.TUBE_CAPACITY; l++) {
                tube.layers.push({ colorIdx: layers[layerIdx++], fillAnim: 1 });
            }
            this.tubes.push(tube);
        }
        // Empty tubes
        for (let t = 0; t < 2; t++) {
            this.tubes.push({ layers: [], x: 0, y: 0, shake: 0, highlight: 0 });
        }

        this.calculateTubePositions();
        this.spawnBubbles();
    }

    calculateTubePositions() {
        const n = this.tubes.length;
        const TUBE_W = 48;
        const TUBE_H = 160;
        const GAP = 14;
        const PER_ROW = Math.ceil(n / 2);
        const rowW = PER_ROW * (TUBE_W + GAP) - GAP;
        const startX = (this.canvas.width - rowW) / 2;
        const row1Y = this.canvas.height * 0.25;
        const row2Y = this.canvas.height * 0.62;

        this.tubeW = TUBE_W;
        this.tubeH = TUBE_H;

        this.tubes.forEach((tube, i) => {
            const row = i < PER_ROW ? 0 : 1;
            const col = i < PER_ROW ? i : i - PER_ROW;
            tube.x = startX + col * (TUBE_W + GAP) + TUBE_W / 2;
            tube.y = row === 0 ? row1Y : row2Y;
        });
    }

    spawnBubbles() {
        this.bubbles = [];
        for (let i = 0; i < 8; i++) {
            this.bubbles.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height + Math.random() * 50,
                r: Math.random() * 6 + 3,
                speed: Math.random() * 0.5 + 0.2,
                drift: (Math.random() - 0.5) * 0.5,
                color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill,
                alpha: Math.random() * 0.3 + 0.1
            });
        }
    }

    // ==================== EVENTS ====================

    bindEvents() {
        this.boundClick = this.handleClick.bind(this);
        this.boundTouch = this.handleTouch.bind(this);
        this.canvas.addEventListener('click', this.boundClick);
        this.canvas.addEventListener('touchstart', this.boundTouch, { passive: false });
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.processClick(mx, my);
    }

    handleTouch(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
        const my = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
        this.processClick(mx, my);
    }

    processClick(mx, my) {
        if (this.paused || this.pourAnim) return;

        // Check undo button
        if (mx > this.canvas.width - 80 && my > this.canvas.height - 50) {
            this.undo();
            return;
        }

        // Check hint button
        if (mx < 80 && my > this.canvas.height - 50) {
            this.showHint();
            return;
        }

        // Check tube click
        const tubeIdx = this.getTubeAt(mx, my);
        if (tubeIdx === -1) {
            this.selectedTube = -1;
            return;
        }

        if (this.selectedTube === -1) {
            if (this.tubes[tubeIdx].layers.length === 0) return;
            this.selectedTube = tubeIdx;
            if (window.audioManager) audioManager.play('click');
        } else {
            if (tubeIdx === this.selectedTube) {
                this.selectedTube = -1;
                return;
            }
            this.pourTube(this.selectedTube, tubeIdx);
            this.selectedTube = -1;
        }
    }

    getTubeAt(mx, my) {
        const tw = this.tubeW;
        const th = this.tubeH;
        for (let i = 0; i < this.tubes.length; i++) {
            const t = this.tubes[i];
            if (mx > t.x - tw / 2 - 10 && mx < t.x + tw / 2 + 10 &&
                my > t.y - 20 && my < t.y + th + 20) {
                return i;
            }
        }
        return -1;
    }

    pourTube(fromIdx, toIdx) {
        const from = this.tubes[fromIdx];
        const to = this.tubes[toIdx];

        if (from.layers.length === 0) { this.selectedTube = -1; return; }
        if (to.layers.length >= this.TUBE_CAPACITY) {
            this.shakeTube(toIdx);
            return;
        }

        const topColor = from.layers[from.layers.length - 1].colorIdx;

        if (to.layers.length > 0 && to.layers[to.layers.length - 1].colorIdx !== topColor) {
            this.shakeTube(toIdx);
            this.shakeTube(fromIdx);
            return;
        }

        // Save state for undo
        this.undoStack.push(JSON.parse(JSON.stringify(this.tubes.map(t => t.layers))));
        if (this.undoStack.length > 5) this.undoStack.shift();

        // Count how many layers to pour
        let pourCount = 0;
        for (let i = from.layers.length - 1; i >= 0; i--) {
            if (from.layers[i].colorIdx === topColor && to.layers.length + pourCount < this.TUBE_CAPACITY) {
                pourCount++;
            } else break;
        }

        // Animate pour
        this.pourAnim = {
            fromIdx, toIdx,
            colorIdx: topColor,
            count: pourCount,
            progress: 0,
            duration: 300 + pourCount * 100,
            layers: []
        };

        for (let i = 0; i < pourCount; i++) {
            this.pourAnim.layers.push(from.layers.pop());
        }

        this.moves++;
        if (window.audioManager) audioManager.play('pop');
    }

    shakeTube(idx) {
        this.tubes[idx].shake = 15;
        if (window.audioManager) audioManager.play('fail');
    }

    undo() {
        if (this.undoStack.length === 0 || this.undoLeft <= 0 || this.pourAnim) return;
        const prev = this.undoStack.pop();
        this.tubes.forEach((t, i) => {
            t.layers = prev[i].map(l => ({ ...l }));
        });
        this.undoLeft--;
        this.selectedTube = -1;
        if (window.audioManager) audioManager.play('click');
        this.flashAlpha = 0.1;
        this.flashColor = '#00D4FF';
    }

    showHint() {
        // Find a valid move
        for (let from = 0; from < this.tubes.length; from++) {
            if (this.tubes[from].layers.length === 0) continue;
            const topColor = this.tubes[from].layers[this.tubes[from].layers.length - 1].colorIdx;
            for (let to = 0; to < this.tubes.length; to++) {
                if (from === to) continue;
                if (this.tubes[to].layers.length >= this.TUBE_CAPACITY) continue;
                const toTop = this.tubes[to].layers.length > 0
                    ? this.tubes[to].layers[this.tubes[to].layers.length - 1].colorIdx
                    : -1;
                if (toTop === -1 || toTop === topColor) {
                    this.hintActive = { from, to };
                    this.hintFlash = 30;
                    if (window.audioManager) audioManager.play('hover');
                    return;
                }
            }
        }
    }

    checkWin() {
        for (const tube of this.tubes) {
            if (tube.layers.length === 0) continue;
            if (tube.layers.length !== this.TUBE_CAPACITY) return false;
            const c = tube.layers[0].colorIdx;
            if (!tube.layers.every(l => l.colorIdx === c)) return false;
        }
        return true;
    }

    triggerWin() {
        const bonus = Math.max(0, 200 - this.moves * 5) + this.level * 100;
        this.score += bonus;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('liquid_best', this.bestScore);
        }
        this.onScore(this.score);

        this.winAnim = {
            active: true,
            timer: 2500,
            stars: Array.from({ length: 20 }, () => ({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 2,
                color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill,
                size: Math.random() * 12 + 6,
                life: 1,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2
            }))
        };

        this.flashAlpha = 0.4;
        this.flashColor = '#00FF88';
        this.screenShake.timer = 10;
        this.screenShake.intensity = 5;

        if (window.audioManager) audioManager.play('levelUp');

        setTimeout(() => {
            this.level++;
            this.winAnim.active = false;
            this.generateLevel();
        }, 2500);
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.t += 0.015);

        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 15);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.4 * (this.screenShake.timer / 15);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.03;
        if (this.hintFlash > 0) this.hintFlash--;

        // Tube shakes
        this.tubes.forEach(t => { if (t.shake > 0) t.shake -= 1; });

        // Pour animation
        if (this.pourAnim) {
            this.pourAnim.progress += dt / this.pourAnim.duration;
            if (this.pourAnim.progress >= 1) {
                // Complete pour
                const to = this.tubes[this.pourAnim.toIdx];
                this.pourAnim.layers.forEach(l => to.layers.push({ colorIdx: l.colorIdx, fillAnim: 0 }));

                // Animate fill
                to.layers.forEach(l => {
                    if (l.fillAnim < 1) setTimeout(() => { l.fillAnim = 1; }, 50);
                });

                this.pourAnim = null;

                // Check win
                if (this.checkWin()) this.triggerWin();
                if (window.audioManager) audioManager.play('splash');

                this.spawnLiquidParticles();
            }
        }

        // Win animation
        if (this.winAnim.active) {
            this.winAnim.timer -= dt;
            this.winAnim.stars.forEach(s => {
                s.x += s.vx; s.y += s.vy;
                s.vy += 0.05;
                s.rotation += s.rotSpeed;
                s.life -= 0.008;
            });
            this.winAnim.stars = this.winAnim.stars.filter(s => s.life > 0);
        }

        // Bubbles
        this.bubbles.forEach(b => {
            b.y -= b.speed;
            b.x += b.drift;
            if (b.y < -20) {
                b.y = this.canvas.height + 20;
                b.x = Math.random() * this.canvas.width;
                b.color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill;
            }
        });

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.1; p.vx *= 0.97;
            p.life -= p.decay;
            p.size *= 0.96;
            return p.life > 0 && p.size > 0.3;
        });

        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });
    }

    spawnLiquidParticles() {
        if (!this.pourAnim) return;
        const to = this.tubes[this.pourAnim?.toIdx];
        if (!to) return;
        const colorData = this.COLORS[this.pourAnim.colorIdx] || this.COLORS[0];
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: to.x + (Math.random() - 0.5) * 20,
                y: to.y + 10,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * -3 - 1,
                size: Math.random() * 5 + 2,
                life: 1, decay: 0.04,
                color: colorData.fill, gravity: 0.1
            });
        }
    }

    // ==================== DRAW ====================

    draw(timestamp) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        this.drawBackground(timestamp);
        this.drawBubbles();
        this.drawTubes(timestamp);
        this.drawPourAnimation(timestamp);
        this.drawParticlesD();
        this.drawScorePopupsD();
        this.drawWinAnimation(timestamp);

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawHUD(timestamp);

        ctx.restore();
    }

    drawBackground(timestamp) {
        const ctx = this.ctx;
        const bg = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bg.addColorStop(0, '#080520');
        bg.addColorStop(0.5, '#050318');
        bg.addColorStop(1, '#020108');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.stars.forEach(s => {
            const a = 0.15 + Math.sin(s.t) * 0.2;
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawBubbles() {
        const ctx = this.ctx;
        this.bubbles.forEach(b => {
            ctx.globalAlpha = b.alpha;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = b.alpha * 0.3;
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    drawTubes(timestamp) {
        const ctx = this.ctx;
        const tw = this.tubeW;
        const th = this.tubeH;
        const layerH = th / this.TUBE_CAPACITY;

        this.tubes.forEach((tube, idx) => {
            const tx = tube.x + (tube.shake > 0 ? Math.sin(tube.shake * 0.8) * 4 : 0);
            const ty = tube.y;
            const isSelected = this.selectedTube === idx;
            const isHintFrom = this.hintActive && this.hintActive.from === idx && this.hintFlash > 0;
            const isHintTo = this.hintActive && this.hintActive.to === idx && this.hintFlash > 0;
            const selectedOffset = isSelected ? -18 : 0;

            ctx.save();
            ctx.translate(tx, ty + selectedOffset);

            // Tube glow
            if (isSelected) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00D4FF';
            } else if (isHintFrom || isHintTo) {
                const hAlpha = (this.hintFlash / 30) * 0.8;
                ctx.shadowBlur = 15;
                ctx.shadowColor = `rgba(255,215,0,${hAlpha})`;
            }

            // Tube glass body
            this.drawTubeShape(ctx, tw, th, isSelected, isHintFrom || isHintTo);

            // Liquid layers
            tube.layers.forEach((layer, li) => {
                const colorData = this.COLORS[layer.colorIdx];
                const lx = -tw / 2 + 4;
                const lw = tw - 8;
                const lh = layerH - 2;
                const ly = th - (li + 1) * layerH + 2;
                const isBottom = li === 0;
                const isTop = li === tube.layers.length - 1;
                const radius = isBottom ? [0, 0, 12, 12] : isTop ? [4, 4, 0, 0] : [0, 0, 0, 0];

                // Liquid gradient
                const lgrad = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
                lgrad.addColorStop(0, colorData.light);
                lgrad.addColorStop(0.5, colorData.fill);
                lgrad.addColorStop(1, colorData.dark);

                ctx.fillStyle = lgrad;
                ctx.shadowBlur = 6;
                ctx.shadowColor = colorData.fill;
                ctx.beginPath();
                ctx.roundRect(lx, ly, lw, lh, radius);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Liquid shine
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                ctx.roundRect(lx + 2, ly + 2, lw * 0.4, lh - 4, 2);
                ctx.fill();

                // Top surface wave (only topmost layer)
                if (isTop && tube.layers.length > 0) {
                    const waveY = ly + 3;
                    ctx.strokeStyle = colorData.light;
                    ctx.lineWidth = 1.5;
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    for (let wx = lx; wx < lx + lw; wx += 8) {
                        const wave = Math.sin((wx + timestamp / 300) * 0.5) * 2;
                        if (wx === lx) ctx.moveTo(wx, waveY + wave);
                        else ctx.lineTo(wx, waveY + wave);
                    }
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            });

            // Tube glass overlay (front glass effect)
            this.drawTubeGlassOverlay(ctx, tw, th);

            // Completed tube indicator
            if (tube.layers.length === this.TUBE_CAPACITY) {
                const allSame = tube.layers.every(l => l.colorIdx === tube.layers[0].colorIdx);
                if (allSame) {
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2.5;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = '#FFD700';
                    ctx.beginPath();
                    ctx.roundRect(-tw / 2, 0, tw, th, [0, 0, tw / 2, tw / 2]);
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // Checkmark
                    ctx.fillStyle = '#FFD700';
                    ctx.font = '16px serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('✓', 0, -8);
                }
            }

            ctx.restore();
        });
        ctx.textAlign = 'left';
    }

    drawTubeShape(ctx, tw, th, selected, hint) {
        // Bottom rounded, top open

        // Outer border
        const borderColor = selected ? '#00D4FF'
            : hint ? `rgba(255,215,0,${this.hintFlash / 30})`
            : 'rgba(255,255,255,0.25)';

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.fillStyle = 'rgba(20,10,40,0.4)';

        // Left wall
        ctx.beginPath();
        ctx.moveTo(-tw / 2, 0);
        ctx.lineTo(-tw / 2, th - tw / 2);
        ctx.arc(0, th - tw / 2, tw / 2, Math.PI, 0, false);
        ctx.lineTo(tw / 2, 0);
        ctx.fill();
        ctx.stroke();

        // Top rim
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-tw / 2 - 3, 0);
        ctx.lineTo(tw / 2 + 3, 0);
        ctx.stroke();
    }

    drawTubeGlassOverlay(ctx, tw, th) {
        // Glass shine on left side
        const glassGrad = ctx.createLinearGradient(-tw / 2, 0, 0, 0);
        glassGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
        glassGrad.addColorStop(0.4, 'rgba(255,255,255,0.04)');
        glassGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.moveTo(-tw / 2 + 2, 2);
        ctx.lineTo(-tw / 2 + 2, th - tw / 2);
        ctx.arc(0, th - tw / 2, tw / 2 - 2, Math.PI, Math.PI * 1.3, false);
        ctx.lineTo(-4, 2);
        ctx.closePath();
        ctx.fill();
    }

    drawPourAnimation(timestamp) {
        if (!this.pourAnim) return;
        const ctx = this.ctx;
        const prog = this.pourAnim.progress;
        const from = this.tubes[this.pourAnim.fromIdx];
        const to = this.tubes[this.pourAnim.toIdx];
        const colorData = this.COLORS[this.pourAnim.colorIdx];
        const selectedOffset = this.selectedTube === this.pourAnim.fromIdx ? -18 : 0;

        // Arc pour path
        const fx = from.x;
        const fy = from.y + selectedOffset;
        const tx = to.x;
        const ty = to.y;

        // Draw stream
        const steps = 20;
        for (let i = 0; i < steps * prog; i++) {
            const t = i / steps;
            const cx = fx + (tx - fx) * t;
            const cy = fy + (ty - fy) * t - Math.sin(t * Math.PI) * 40;
            const size = 5 - t * 2;

            ctx.globalAlpha = 0.8 - t * 0.4;
            ctx.fillStyle = colorData.fill;
            ctx.shadowBlur = 8;
            ctx.shadowColor = colorData.fill;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1, size), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // Drip drops
        const dropX = fx + (tx - fx) * prog;
        const dropY = fy + (ty - fy) * prog - Math.sin(prog * Math.PI) * 40;
        for (let i = 0; i < 3; i++) {
            const dp = (prog + i / 3) % 1;
            const ddx = fx + (tx - fx) * dp;
            const ddy = fy + (ty - fy) * dp - Math.sin(dp * Math.PI) * 40;
            ctx.globalAlpha = 0.6 - dp * 0.4;
            ctx.fillStyle = colorData.light;
            ctx.beginPath();
            ctx.arc(ddx, ddy, 3 - dp * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawWinAnimation(timestamp) {
        if (!this.winAnim.active) return;
        const ctx = this.ctx;

        // Stars / confetti
        this.winAnim.stars.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rotation);
            ctx.globalAlpha = s.life;
            ctx.fillStyle = s.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = s.color;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const innerAngle = angle + Math.PI / 5;
                if (i === 0) ctx.moveTo(Math.cos(angle) * s.size, Math.sin(angle) * s.size);
                else ctx.lineTo(Math.cos(angle) * s.size, Math.sin(angle) * s.size);
                ctx.lineTo(Math.cos(innerAngle) * s.size * 0.4, Math.sin(innerAngle) * s.size * 0.4);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        // Win text
        const prog = 1 - this.winAnim.timer / 2500;
        const textAlpha = prog < 0.8 ? prog / 0.8 : (1 - (prog - 0.8) / 0.2);
        const textScale = 0.5 + Math.min(1, prog * 2) * 0.5;

        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2 - 20);
        ctx.scale(textScale, textScale);
        ctx.globalAlpha = textAlpha;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(-130, -45, 260, 90, 15);
        ctx.fill();

        ctx.font = 'bold 30px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF88';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FF88';
        ctx.fillText('LEVEL CLEAR! ✨', 0, 0);
        ctx.shadowBlur = 0;
        ctx.font = '15px Rajdhani';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`+${Math.max(0, 200 - this.moves * 5) + this.level * 100} bonus!`, 0, 28);

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawParticlesD() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawScorePopupsD() {
        const ctx = this.ctx;
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawHUD(timestamp) {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, 42);

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 14px Orbitron';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LEVEL ${this.level}`, 12, 26);
        ctx.shadowBlur = 0;

        // Score
        ctx.fillStyle = '#00D4FF';
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00D4FF';
        ctx.fillText(this.score, W / 2, 26);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,215,0,0.5)';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`BEST: ${this.bestScore}`, W / 2, 38);

        // Moves
        ctx.fillStyle = '#aaa';
        ctx.font = '13px Rajdhani';
        ctx.textAlign = 'right';
        ctx.fillText(`Moves: ${this.moves}`, W - 12, 26);

        // Undo button
        const undoAlpha = this.undoLeft > 0 && this.undoStack.length > 0 ? 1 : 0.3;
        ctx.globalAlpha = undoAlpha;
        ctx.fillStyle = 'rgba(0,150,200,0.4)';
        ctx.strokeStyle = '#00D4FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(W - 76, H - 46, 68, 34, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00D4FF';
        ctx.font = 'bold 11px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(`↩ UNDO`, W - 42, H - 23);
        ctx.fillStyle = '#aaa';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`${this.undoLeft} left`, W - 42, H - 12);
        ctx.globalAlpha = 1;

        // Hint button
        ctx.fillStyle = 'rgba(200,150,0,0.4)';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(8, H - 46, 64, 34, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Orbitron';
        ctx.fillText('💡 HINT', 40, H - 23);
        ctx.fillStyle = '#aaa';
        ctx.font = '10px Rajdhani';
        ctx.fillText('find move', 40, H - 12);

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    // ==================== UTILS ====================

    hexToRgba(hex, alpha) {
        if (!hex.startsWith('#')) return hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // ==================== LOOP ====================

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;
        this.update(timestamp, dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
            this.animId = requestAnimationFrame(t => this.loop(t));
        }
    }

    resize() { this.calculateTubePositions(); }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
    }
}