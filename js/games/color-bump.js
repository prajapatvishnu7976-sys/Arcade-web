/* ============================================
   COLOR BUMP - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class ColorBump {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('colorbump_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Game States
        this.STATE = { WAITING: 0, PLAYING: 1, DEAD: 2 };
        this.state = this.STATE.WAITING;

        // Colors
        this.COLORS = [
            { fill: '#FF006E', glow: '#ff4499', name: 'Pink' },
            { fill: '#00D4FF', glow: '#66eaff', name: 'Cyan' },
            { fill: '#00FF88', glow: '#66ffb8', name: 'Green' },
            { fill: '#FFD700', glow: '#ffe866', name: 'Gold' },
            { fill: '#b347d9', glow: '#d488f0', name: 'Purple' },
            { fill: '#FF8C00', glow: '#ffb04d', name: 'Orange' }
        ];

        // Player
        this.playerColorIdx = 0;
        this.player = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: 24,
            targetX: canvas.width / 2,
            targetY: canvas.height / 2,
            vx: 0, vy: 0,
            trail: [],
            scale: 1,
            pulseAnim: 0,
            invincible: 0,
            colorChangeAnim: 0
        };

        // Balls
        this.balls = [];
        this.ballSpawnTimer = 0;
        this.ballSpawnInterval = 2000;

        // Level
        this.level = 1;
        this.ballsPopped = 0;
        this.ballsPerLevel = 10;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;

        // Power-ups
        this.powerups = [];
        this.activeEffects = {
            rainbow: { active: false, timer: 0, duration: 5000 },
            magnet: { active: false, timer: 0, duration: 4000 },
            bomb: { active: false, timer: 0, duration: 0 },
            shield: { active: false, timer: 0, duration: 6000 },
            slow: { active: false, timer: 0, duration: 5000 }
        };

        // Visual
        this.particles = [];
        this.explosions = [];
        this.scorePopups = [];
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';
        this.deathOverlayAlpha = 0;
        this.ripples = [];

        // Background
        this.bgTime = 0;
        this.stars = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.5 + 0.3,
            t: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.005
        }));
        this.hexGrid = this.generateHexGrid();

        // Input
        this.dragging = false;
        this.touchPos = null;
        this.mousePos = { x: canvas.width / 2, y: canvas.height / 2 };

        this.spawnInitialBalls();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== SETUP ====================

    generateHexGrid() {
        const hexes = [];
        const size = 40;
        const cols = Math.ceil(this.canvas.width / (size * 1.5)) + 2;
        const rows = Math.ceil(this.canvas.height / (size * Math.sqrt(3))) + 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * size * 1.5 - size;
                const y = r * size * Math.sqrt(3) + (c % 2 === 1 ? size * Math.sqrt(3) / 2 : 0) - size;
                hexes.push({ x, y, size: size * 0.92, alpha: Math.random() * 0.04 + 0.01 });
            }
        }
        return hexes;
    }

    spawnInitialBalls() {
        for (let i = 0; i < 12; i++) {
            this.spawnBall();
        }
    }

    spawnBall() {
        const margin = 50;
        const colorIdx = Math.floor(Math.random() * this.COLORS.length);
        const r = Math.random() * 10 + 14;

        let x, y;
        do {
            x = margin + Math.random() * (this.canvas.width - margin * 2);
            y = margin + Math.random() * (this.canvas.height - margin * 2);
        } while (Math.sqrt((x - this.player.x) ** 2 + (y - this.player.y) ** 2) < 100);

        const speed = (0.8 + this.level * 0.15) * (Math.random() * 0.5 + 0.75);
        const angle = Math.random() * Math.PI * 2;

        this.balls.push({
            x, y, r,
            colorIdx,
            color: this.COLORS[colorIdx].fill,
            glow: this.COLORS[colorIdx].glow,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            pulse: Math.random() * Math.PI * 2,
            scale: 0,
            type: Math.random() < 0.1 ? 'bomb' : Math.random() < 0.08 ? 'powerup' : 'normal',
            powerupType: null,
            wobble: 0,
            wobbleSpeed: Math.random() * 0.08 + 0.04
        });

        // Set powerup type
        const last = this.balls[this.balls.length - 1];
        if (last.type === 'powerup') {
            const types = ['rainbow', 'magnet', 'shield', 'slow'];
            last.powerupType = types[Math.floor(Math.random() * types.length)];
        }
    }

    // ==================== EVENTS ====================

    bindEvents() {
        this.boundMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mousePos.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            if (this.state === this.STATE.PLAYING) {
                this.player.targetX = this.mousePos.x;
                this.player.targetY = this.mousePos.y;
            }
        };
        this.boundClick = (e) => {
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            this.changeColor();
        };
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.touchPos = {
                x: (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width),
                y: (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height)
            };
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            this.player.targetX = this.touchPos.x;
            this.player.targetY = this.touchPos.y;
        };
        this.boundTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.player.targetX = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            this.player.targetY = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
        };
        this.boundTouchEnd = (e) => {
            e.preventDefault();
            if (this.state === this.STATE.PLAYING) this.changeColor();
        };

        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('click', this.boundClick);
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    }

    changeColor() {
        if (this.activeEffects.rainbow.active) return;
        this.playerColorIdx = (this.playerColorIdx + 1) % this.COLORS.length;
        this.player.colorChangeAnim = 1;
        this.player.scale = 0.8;
        this.spawnColorChangeParticles();
        if (window.audioManager) audioManager.play('click');
    }

    spawnColorChangeParticles() {
        const c = this.COLORS[this.playerColorIdx];
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            this.particles.push({
                x: this.player.x, y: this.player.y,
                vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
                size: Math.random() * 4 + 2,
                life: 1, decay: 0.05,
                color: c.fill, gravity: 0
            });
        }
    }

    restartGame() {
        this.score = 0;
        this.onScore(0);
        this.state = this.STATE.WAITING;
        this.gameOver = false;
        this.level = 1;
        this.ballsPopped = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.deathOverlayAlpha = 0;
        this.flashAlpha = 0;
        this.balls = [];
        this.particles = [];
        this.powerups = [];
        this.ripples = [];
        this.explosions = [];
        this.scorePopups = [];
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height / 2;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.invincible = 0;
        this.player.trail = [];
        Object.keys(this.activeEffects).forEach(k => {
            this.activeEffects[k].active = false;
            this.activeEffects[k].timer = 0;
        });
        this.spawnInitialBalls();
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.t += s.speed);

        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 15);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.5 * (this.screenShake.timer / 15);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.04;

        if (this.state === this.STATE.WAITING) {
            this.updateBalls(dt, true);
            return;
        }

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.015);
            this.updateParticles(dt);
            return;
        }

        // Update active effects
        Object.keys(this.activeEffects).forEach(key => {
            const ef = this.activeEffects[key];
            if (ef.active && ef.duration > 0) {
                ef.timer -= dt;
                if (ef.timer <= 0) { ef.active = false; ef.timer = 0; }
            }
        });

        // Rainbow color cycle
        if (this.activeEffects.rainbow.active) {
            this.playerColorIdx = Math.floor(timestamp / 150) % this.COLORS.length;
        }

        // Player movement
        this.updatePlayer(dt);

        // Balls
        this.updateBalls(dt, false);

        // Spawn new balls
        this.ballSpawnTimer += dt;
        if (this.ballSpawnTimer >= this.ballSpawnInterval && this.balls.length < 20 + this.level * 3) {
            this.spawnBall();
            this.ballSpawnTimer = 0;
            this.ballSpawnInterval = Math.max(800, 2000 - this.level * 100);
        }

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        // Magnet - attract same color balls
        if (this.activeEffects.magnet.active) {
            this.balls.forEach(b => {
                if (b.colorIdx !== this.playerColorIdx && !this.activeEffects.rainbow.active) return;
                const dx = this.player.x - b.x;
                const dy = this.player.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 180 && dist > 5) {
                    b.vx += (dx / dist) * 0.3;
                    b.vy += (dy / dist) * 0.3;
                }
            });
        }

        // Ripples
        this.ripples = this.ripples.filter(r => {
            r.radius += 3; r.opacity -= 0.025;
            return r.opacity > 0;
        });

        // Particles
        this.updateParticles(dt);

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        // Player invincible
        if (this.player.invincible > 0) this.player.invincible -= dt;

        // Scale back
        if (this.player.scale < 1) this.player.scale = Math.min(1, this.player.scale + 0.05);
        if (this.player.colorChangeAnim > 0) this.player.colorChangeAnim -= 0.08;

        // Player pulse
        this.player.pulseAnim += 0.05;
    }

    updatePlayer(dt) {
        const p = this.player;
        const slowFactor = this.activeEffects.slow.active ? 0.6 : 1;

        // Smooth follow
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.vx += dx * 0.08;
        p.vy += dy * 0.08;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx * slowFactor;
        p.y += p.vy * slowFactor;

        // Boundary
        p.x = Math.max(p.r, Math.min(this.canvas.width - p.r, p.x));
        p.y = Math.max(p.r, Math.min(this.canvas.height - p.r, p.y));

        // Trail
        p.trail.push({ x: p.x, y: p.y, color: this.COLORS[this.playerColorIdx].fill });
        if (p.trail.length > 15) p.trail.shift();
    }

    updateBalls(dt, idleMode) {
        const slowFactor = this.activeEffects.slow.active ? 0.5 : 1;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];

            // Scale in
            b.scale = Math.min(1, b.scale + 0.05);
            b.pulse += b.wobbleSpeed;
            b.wobble = Math.sin(b.pulse) * 0.08;

            // Ball-to-ball collisions
            for (let j = i + 1; j < this.balls.length; j++) {
                const b2 = this.balls[j];
                const dx = b2.x - b.x;
                const dy = b2.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = b.r + b2.r;
                if (dist < minDist && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;
                    b.x -= nx * overlap * 0.5;
                    b.y -= ny * overlap * 0.5;
                    b2.x += nx * overlap * 0.5;
                    b2.y += ny * overlap * 0.5;
                    const relVx = b.vx - b2.vx;
                    const relVy = b.vy - b2.vy;
                    const dot = relVx * nx + relVy * ny;
                    if (dot > 0) {
                        b.vx -= dot * nx;
                        b.vy -= dot * ny;
                        b2.vx += dot * nx;
                        b2.vy += dot * ny;
                    }
                }
            }

            // Move
            b.x += b.vx * slowFactor;
            b.y += b.vy * slowFactor;

            // Wall bounce
            if (b.x - b.r <= 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
            if (b.x + b.r >= this.canvas.width) { b.x = this.canvas.width - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y - b.r <= 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
            if (b.y + b.r >= this.canvas.height) { b.y = this.canvas.height - b.r; b.vy = -Math.abs(b.vy); }

            if (idleMode) continue;

            // Player collision
            const pdx = this.player.x - b.x;
            const pdy = this.player.y - b.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

            if (pdist < this.player.r + b.r) {
                // Check color match
                const colorMatch = this.activeEffects.rainbow.active || b.colorIdx === this.playerColorIdx;

                if (b.type === 'powerup') {
                    this.collectPowerup(b, i);
                    continue;
                }

                if (b.type === 'bomb') {
                    if (colorMatch || this.activeEffects.rainbow.active) {
                        this.triggerBomb(b, i);
                        continue;
                    } else if (this.player.invincible <= 0 && !this.activeEffects.shield.active) {
                        this.playerDie(b);
                        return;
                    }
                    continue;
                }

                if (colorMatch) {
                    this.popBall(b, i);
                } else {
                    if (this.player.invincible > 0 || this.activeEffects.shield.active) {
                        // Push ball away
                        const pushDist = this.player.r + b.r;
                        if (pdist > 0) {
                            b.vx = -(pdx / pdist) * 5;
                            b.vy = -(pdy / pdist) * 5;
                        }
                    } else {
                        this.playerDie(b);
                        return;
                    }
                }
            }
        }
    }

    popBall(ball, idx) {
        this.combo++;
        this.comboTimer = 2000;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const multiplier = this.activeEffects.rainbow.active ? 2 : 1;
        const comboBonus = Math.min(this.combo - 1, 8) * 5;
        const gained = (10 + comboBonus) * multiplier;
        this.score += gained;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('colorbump_best', this.bestScore);
        }
        this.onScore(this.score);

        this.spawnPopParticles(ball.x, ball.y, ball.color, 12);
        this.ripples.push({ x: ball.x, y: ball.y, radius: ball.r, opacity: 0.8, color: ball.color });

        this.scorePopups.push({
            x: ball.x, y: ball.y - 20,
            text: this.combo > 1 ? `+${gained} x${this.combo}!` : `+${gained}`,
            color: this.combo > 3 ? '#FFD700' : ball.color,
            life: 1000, opacity: 1
        });

        this.balls.splice(idx, 1);
        this.ballsPopped++;

        if (this.ballsPopped % this.ballsPerLevel === 0) this.levelUp();

        if (window.audioManager) audioManager.play('pop');
        this.player.scale = 1.15;
    }

    triggerBomb(ball, idx) {
        const cx = ball.x;
        const cy = ball.y;
        const radius = 100;
        let killed = 0;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            if (i === idx) continue;
            const b = this.balls[i];
            const dist = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
            if (dist < radius) {
                this.spawnPopParticles(b.x, b.y, b.color, 6);
                this.balls.splice(i, 1);
                killed++;
                if (idx > i) idx--;
            }
        }

        this.balls.splice(idx, 1);
        this.spawnPopParticles(cx, cy, '#FFD700', 20);

        const bonus = (killed + 1) * 20;
        this.score += bonus;
        this.onScore(this.score);

        this.explosions.push({ x: cx, y: cy, radius: 5, maxRadius: radius, opacity: 1, color: '#FFD700' });
        this.explosions.push({ x: cx, y: cy, radius: 5, maxRadius: radius * 0.7, opacity: 0.8, color: '#FF8C00' });

        this.scorePopups.push({
            x: cx, y: cy - 30,
            text: `💥 BOMB! +${bonus}`,
            color: '#FFD700', life: 1500, opacity: 1
        });

        this.screenShake.timer = 15;
        this.screenShake.intensity = 10;
        this.flashAlpha = 0.3;
        this.flashColor = '#FFD700';
        if (window.audioManager) audioManager.play('levelUp');
    }

    collectPowerup(ball, idx) {
        const type = ball.powerupType;
        const ef = this.activeEffects[type];
        if (ef) {
            ef.active = true;
            ef.timer = ef.duration;
        }

        const info = {
            rainbow: { text: '🌈 RAINBOW!', color: '#FF006E' },
            magnet: { text: '🧲 MAGNET!', color: '#00D4FF' },
            shield: { text: '🛡 SHIELD!', color: '#00FF88' },
            slow: { text: '⏱ SLOW!', color: '#b347d9' }
        };

        const i = info[type];
        this.spawnPopParticles(ball.x, ball.y, ball.color, 15);
        this.scorePopups.push({
            x: ball.x, y: ball.y - 20,
            text: i ? i.text : '⭐ BONUS!',
            color: i ? i.color : '#FFD700',
            life: 1500, opacity: 1
        });

        this.balls.splice(idx, 1);
        this.flashAlpha = 0.2;
        this.flashColor = ball.color;
        this.player.invincible = 1000;
        if (window.audioManager) audioManager.play('powerup');
    }

    levelUp() {
        this.level++;
        this.score += 100 * this.level;
        this.onScore(this.score);
        this.flashAlpha = 0.3;
        this.flashColor = '#00FF88';
        this.screenShake.timer = 8;
        this.screenShake.intensity = 5;
        if (window.audioManager) audioManager.play('levelUp');
    }

    playerDie(ball) {
        if (this.activeEffects.shield.active) {
            this.activeEffects.shield.active = false;
            this.activeEffects.shield.timer = 0;
            this.player.invincible = 1500;
            this.spawnPopParticles(this.player.x, this.player.y, '#00FF88', 12);
            this.flashAlpha = 0.3;
            this.flashColor = '#00FF88';
            if (window.audioManager) audioManager.play('powerup');
            return;
        }

        this.gameOver = true;
        this.state = this.STATE.DEAD;

        // Big explosion
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x: this.player.x, y: this.player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 8 + 3,
                life: 1, decay: 0.025,
                color: this.COLORS[this.playerColorIdx].fill,
                gravity: 0.15
            });
        }

        this.explosions.push({
            x: this.player.x, y: this.player.y,
            radius: 5, maxRadius: 80,
            opacity: 1, color: ball.color
        });

        this.screenShake.timer = 20;
        this.screenShake.intensity = 14;
        this.flashAlpha = 0.7;
        this.flashColor = '#FF0055';

        setTimeout(() => this.onScore(this.score, true), 1000);
        if (window.audioManager) audioManager.play('gameOver');
    }

    spawnPopParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 2,
                life: 1, decay: 0.03,
                color, gravity: 0.08
            });
        }
    }

    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += p.gravity || 0;
            p.vx *= 0.97;
            p.life -= p.decay;
            p.size *= 0.96;
            return p.life > 0 && p.size > 0.3;
        });

        this.explosions = this.explosions.filter(e => {
            e.radius += 4;
            e.opacity -= 0.04;
            return e.opacity > 0 && e.radius < e.maxRadius;
        });
    }

    // ==================== DRAW ====================

    draw(timestamp) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        this.drawBackground(timestamp);
        this.drawRipples();
        this.drawExplosions();
        this.drawBalls(timestamp);
        this.drawParticlesD();
        this.drawPlayer(timestamp);
        this.drawScorePopupsD();

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        }

        this.drawHUD(timestamp);

        if (this.state === this.STATE.WAITING) this.drawWaiting(timestamp);
        if (this.state === this.STATE.DEAD) this.drawDeathScreen(timestamp);

        ctx.restore();
    }

    drawBackground(timestamp) {
        const ctx = this.ctx;
        const bg = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height
        );
        bg.addColorStop(0, '#080520');
        bg.addColorStop(0.6, '#050318');
        bg.addColorStop(1, '#020108');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        this.stars.forEach(s => {
            const a = 0.2 + Math.sin(s.t) * 0.25;
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Hex grid
        this.hexGrid.forEach(h => {
            ctx.globalAlpha = h.alpha;
            ctx.strokeStyle = 'rgba(179,71,217,0.3)';
            ctx.lineWidth = 0.5;
            this.drawHexagon(ctx, h.x, h.y, h.size);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawHexagon(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    drawRipples() {
        const ctx = this.ctx;
        this.ripples.forEach(r => {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = r.color;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawExplosions() {
        const ctx = this.ctx;
        this.explosions.forEach(e => {
            ctx.globalAlpha = e.opacity;
            ctx.shadowBlur = 15;
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = e.opacity * 0.3;
            ctx.fillStyle = e.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawBalls(timestamp) {
        const ctx = this.ctx;
        this.balls.forEach(b => {
            const pulse = 1 + Math.sin(b.pulse) * 0.06;
            const r = b.r * b.scale * pulse;

            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.scale(1 + b.wobble, 1 - b.wobble * 0.5);

            // Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = b.glow;

            if (b.type === 'bomb') {
                // Bomb style
                const bombGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
                bombGrad.addColorStop(0, '#444');
                bombGrad.addColorStop(0.5, '#222');
                bombGrad.addColorStop(1, '#111');
                ctx.fillStyle = bombGrad;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                // Fuse
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -r);
                ctx.quadraticCurveTo(r * 0.3, -r * 1.4, r * 0.1, -r * 1.7);
                ctx.stroke();
                // Spark
                if (Math.random() > 0.5) {
                    ctx.fillStyle = '#FFD700';
                    ctx.shadowColor = '#FFD700';
                    ctx.beginPath();
                    ctx.arc(r * 0.1, -r * 1.7, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Skull
                ctx.font = `${r}px serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.6;
                ctx.fillText('💀', 0, r * 0.35);
                ctx.globalAlpha = 1;

            } else if (b.type === 'powerup') {
                // Powerup style
                const puColors = {
                    rainbow: '#FF006E', magnet: '#00D4FF',
                    shield: '#00FF88', slow: '#b347d9'
                };
                const puColor = puColors[b.powerupType] || '#FFD700';
                const puGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
                puGrad.addColorStop(0, this.lightenColor(puColor, 60));
                puGrad.addColorStop(0.6, puColor);
                puGrad.addColorStop(1, this.darkenColor(puColor, 40));
                ctx.fillStyle = puGrad;
                ctx.shadowColor = puColor;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                // Star outline
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, r + 3 + Math.sin(b.pulse * 2) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                // Emoji
                const emojis = { rainbow: '🌈', magnet: '🧲', shield: '🛡', slow: '⏱' };
                ctx.font = `${r * 0.9}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText(emojis[b.powerupType] || '⭐', 0, r * 0.35);

            } else {
                // Normal ball
                const ballGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
                ballGrad.addColorStop(0, this.lightenColor(b.color, 70));
                ballGrad.addColorStop(0.4, b.color);
                ballGrad.addColorStop(0.8, this.darkenColor(b.color, 30));
                ballGrad.addColorStop(1, this.darkenColor(b.color, 60));
                ctx.fillStyle = ballGrad;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();

                // Specular highlight
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
                ctx.fill();

                // Bottom reflection
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath();
                ctx.ellipse(r * 0.2, r * 0.5, r * 0.2, r * 0.1, 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    }

    drawPlayer(timestamp) {
        const ctx = this.ctx;
        const p = this.player;
        const colorData = this.COLORS[this.playerColorIdx];
        const rainbow = this.activeEffects.rainbow.active;

        // Trail
        p.trail.forEach((t, i) => {
            const alpha = (i / p.trail.length) * 0.3;
            const r = p.r * (i / p.trail.length) * 0.8;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(1, r), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        if (this.state === this.STATE.DEAD) return;

        const r = p.r * p.scale;
        const invBlink = p.invincible > 0 && Math.floor(p.invincible / 100) % 2 === 0;
        if (invBlink) return;

        ctx.save();
        ctx.translate(p.x, p.y);

        // Shield ring
        if (this.activeEffects.shield.active) {
            const sp = 0.6 + Math.sin(timestamp / 150) * 0.4;
            ctx.strokeStyle = `rgba(0,255,136,${sp})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00FF88';
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -timestamp / 50;
            ctx.beginPath();
            ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        }

        // Magnet ring
        if (this.activeEffects.magnet.active) {
            ctx.strokeStyle = `rgba(0,212,255,${0.3 + Math.sin(timestamp / 200) * 0.2})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 8]);
            ctx.lineDashOffset = timestamp / 30;
            ctx.beginPath();
            ctx.arc(0, 0, 170, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Color change flash ring
        if (p.colorChangeAnim > 0) {
            ctx.strokeStyle = `rgba(255,255,255,${p.colorChangeAnim})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, r + p.colorChangeAnim * 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Main glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = rainbow
            ? `hsl(${(timestamp / 10) % 360}, 100%, 60%)`
            : colorData.glow;

        // Body
        let bodyColor = colorData.fill;
        if (rainbow) bodyColor = `hsl(${(timestamp / 10) % 360}, 100%, 60%)`;

        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
        grad.addColorStop(0, this.lightenColor(bodyColor, 80));
        grad.addColorStop(0.35, bodyColor);
        grad.addColorStop(0.7, this.darkenColor(bodyColor, 20));
        grad.addColorStop(1, this.darkenColor(bodyColor, 50));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Outer ring
        ctx.strokeStyle = rainbow
            ? `hsl(${((timestamp / 10) + 60) % 360}, 100%, 80%)`
            : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner ring
        const pulseMod = 0.65 + Math.sin(p.pulseAnim) * 0.05;
        ctx.strokeStyle = rainbow
            ? `hsl(${((timestamp / 10) + 120) % 360}, 100%, 70%)`
            : `rgba(255,255,255,0.2)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r * pulseMod, 0, Math.PI * 2);
        ctx.stroke();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Color indicator (arrow)
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `bold ${r * 0.55}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(rainbow ? '🌈' : '●', 0, r * 0.2);

        ctx.restore();
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawParticlesD() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
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

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, 40);

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 13px Orbitron';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LVL ${this.level}`, 10, 24);
        ctx.shadowBlur = 0;

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 6;
        ctx.shadowColor = this.COLORS[this.playerColorIdx].glow;
        ctx.fillText(this.score, W / 2, 26);
        ctx.shadowBlur = 0;

        if (this.bestScore > 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.6)';
            ctx.font = '10px Rajdhani';
            ctx.fillText(`BEST: ${this.bestScore}`, W / 2, 38);
        }

        // Current color indicator
        const c = this.COLORS[this.playerColorIdx];
        ctx.textAlign = 'right';
        ctx.fillStyle = c.fill;
        ctx.shadowBlur = 8;
        ctx.shadowColor = c.glow;
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText(`● ${c.name}`, W - 12, 24);
        ctx.shadowBlur = 0;

        // Tap hint
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Rajdhani';
        ctx.fillText('TAP = CHANGE COLOR', W - 12, 38);

        // Combo display
        if (this.combo > 1 && this.comboTimer > 0) {
            const ca = Math.min(1, this.comboTimer / 500);
            ctx.globalAlpha = ca;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 13px Orbitron';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`x${this.combo} COMBO!`, W / 2, 55);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Active effects
        let efX = 10;
        const efInfo = {
            rainbow: { emoji: '🌈', color: '#FF006E' },
            magnet: { emoji: '🧲', color: '#00D4FF' },
            shield: { emoji: '🛡', color: '#00FF88' },
            slow: { emoji: '⏱', color: '#b347d9' }
        };
        Object.entries(this.activeEffects).forEach(([key, ef]) => {
            if (!ef.active || ef.duration === 0) return;
            const info = efInfo[key];
            if (!info) return;
            const pct = ef.timer / ef.duration;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(efX, 44, 44, 10, 3);
            ctx.fill();
            ctx.fillStyle = info.color;
            ctx.beginPath();
            ctx.roundRect(efX, 44, 44 * pct, 10, 3);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '8px Rajdhani';
            ctx.textAlign = 'left';
            ctx.fillText(info.emoji, efX + 1, 53);
            efX += 50;
        });

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawWaiting(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(cx - 150, cy - 50, 300, 95, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,71,217,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 22px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('COLOR BUMP', cx, cy - 12);
        ctx.shadowBlur = 0;

        ctx.font = '13px Rajdhani';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Move mouse / drag to control', cx, cy + 14);
        const bob = Math.sin(timestamp / 400) * 4;
        ctx.font = '11px Rajdhani';
        ctx.fillStyle = '#777';
        ctx.fillText('Tap / Click to change color & start', cx, cy + 35 + bob);
        ctx.textAlign = 'left';
    }

    drawDeathScreen(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const alpha = this.deathOverlayAlpha;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.5) return;
        const pa = (alpha - 0.5) / 0.5;
        ctx.globalAlpha = pa;

        const pw = Math.min(this.canvas.width - 40, 300);
        const ph = 240;

        ctx.fillStyle = 'rgba(5,2,15,0.97)';
        ctx.strokeStyle = 'rgba(255,0,110,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FF006E';
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 28px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', cx, cy - ph / 2 + 48);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + 20, cy - ph / 2 + 64);
        ctx.lineTo(cx + pw / 2 - 20, cy - ph / 2 + 64);
        ctx.stroke();

        const rows = [
            { label: 'SCORE', val: this.score, color: '#fff' },
            { label: 'BEST', val: this.bestScore, color: this.score >= this.bestScore ? '#FFD700' : '#fff' },
            { label: 'LEVEL', val: this.level, color: '#b347d9' },
            { label: 'MAX COMBO', val: `x${this.maxCombo}`, color: '#FFD700' },
            { label: 'BALLS POPPED', val: this.ballsPopped, color: '#00FF88' }
        ];

        rows.forEach((r, i) => {
            const ry = cy - ph / 2 + 90 + i * 28;
            ctx.font = '12px Rajdhani';
            ctx.fillStyle = '#777';
            ctx.textAlign = 'left';
            ctx.fillText(r.label, cx - pw / 2 + 22, ry);
            ctx.font = 'bold 13px Orbitron';
            ctx.fillStyle = r.color;
            ctx.textAlign = 'right';
            ctx.fillText(r.val, cx + pw / 2 - 22, ry);
        });

        const tap = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${tap})`;
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO PLAY AGAIN', cx, cy + ph / 2 - 16);

        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    // ==================== UTILS ====================

    lightenColor(color, amt) {
        if (!color.startsWith('#')) return color;
        const r = Math.min(255, parseInt(color.slice(1, 3), 16) + amt);
        const g = Math.min(255, parseInt(color.slice(3, 5), 16) + amt);
        const b = Math.min(255, parseInt(color.slice(5, 7), 16) + amt);
        return `rgb(${r},${g},${b})`;
    }

    darkenColor(color, amt) {
        if (!color.startsWith('#')) return color;
        const r = Math.max(0, parseInt(color.slice(1, 3), 16) - amt);
        const g = Math.max(0, parseInt(color.slice(3, 5), 16) - amt);
        const b = Math.max(0, parseInt(color.slice(5, 7), 16) - amt);
        return `rgb(${r},${g},${b})`;
    }

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

    resize() {}

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    }
}