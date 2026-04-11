/* ============================================
   NEON BREAKOUT - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class Breakout {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('breakout_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Game States
        this.STATE = { WAITING: 0, PLAYING: 1, DEAD: 2, LEVEL_UP: 3 };
        this.state = this.STATE.WAITING;

        // Level
        this.level = 1;
        this.lives = 3;

        // Paddle
        this.paddle = {
            x: canvas.width / 2,
            y: canvas.height - 38,
            w: 100, h: 14,
            speed: 7,
            targetX: canvas.width / 2,
            color: '#b347d9',
            glow: '#b347d9',
            magnetActive: false,
            magnetTimer: 0,
            laserActive: false,
            laserTimer: 0,
            wideActive: false,
            wideTimer: 0,
            hitAnim: 0
        };

        // Ball(s)
        this.balls = [];
        this.initBall();

        // Bricks
        this.bricks = [];

        // Power-ups
        this.powerups = [];
        this.activePowerups = {
            multiball: false,
            wide: false,
            laser: false,
            magnet: false,
            slow: false,
            shield: false
        };
        this.shieldLine = false;
        this.shieldAlpha = 0;

        // Lasers
        this.lasers = [];
        this.laserCooldown = 0;

        // Particles & Effects
        this.particles = [];
        this.explosions = [];
        this.scorePopups = [];
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';
        this.levelUpTimer = 0;
        this.deathOverlayAlpha = 0;

        // Background
        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.8 + 0.3,
            t: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.005
        }));
        this.bgGrid = [];

        // Combo
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;

        // Input
        this.keys = {};
        this.mouseX = canvas.width / 2;

        this.createBricks();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== INIT ====================

    initBall() {
        this.balls = [{
            x: this.canvas.width / 2,
            y: this.paddle.y - 12,
            vx: (Math.random() > 0.5 ? 1 : -1) * 4,
            vy: -4,
            r: 8,
            speed: 5 + this.level * 0.3,
            attached: true,
            trail: [],
            color: '#ffffff',
            glow: '#00d4ff',
            spin: 0
        }];
    }

    createBricks() {
        this.bricks = [];
        const padding = 8;
        const cols = 10;
        const brickW = (this.canvas.width - padding * (cols + 1)) / cols;
        const brickH = 22;
        const startY = 55;
        const rows = Math.min(4 + this.level, 10);

        const patterns = [
            // Normal
            (r, c) => true,
            // Diamond
            (r, c) => Math.abs(r - rows / 2) + Math.abs(c - cols / 2) < (rows + cols) / 3,
            // Checkerboard
            (r, c) => (r + c) % 2 === 0,
            // Border
            (r, c) => r === 0 || r === rows - 1 || c === 0 || c === cols - 1,
            // X pattern
            (r, c) => Math.abs(r - c) < 2 || Math.abs(r - (rows - 1 - c)) < 2
        ];

        const patternFn = patterns[this.level % patterns.length];

        const colorSets = [
            ['#FF006E', '#FF4499', '#FF8CC6'],
            ['#FF8C00', '#FFB347', '#FFD700'],
            ['#00FF88', '#44FFaa', '#00D4FF'],
            ['#b347d9', '#dd88ff', '#00D4FF'],
            ['#FF0055', '#FF8C00', '#FFD700', '#00FF88', '#00D4FF', '#b347d9']
        ];
        const colorSet = colorSets[this.level % colorSets.length];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!patternFn(r, c)) continue;

                const x = padding + c * (brickW + padding);
                const y = startY + r * (brickH + padding);
                const colorIdx = r % colorSet.length;
                const color = colorSet[colorIdx];

                // Special bricks based on level
                let type = 'normal';
                let hp = 1;
                const rand = Math.random();

                if (this.level >= 2 && rand < 0.08) { type = 'steel'; hp = 3; }
                else if (this.level >= 3 && rand < 0.12) { type = 'explosive'; hp = 1; }
                else if (this.level >= 4 && rand < 0.06) { type = 'gold'; hp = 2; }
                else if (this.level >= 5 && rand < 0.05) { type = 'rainbow'; hp = 4; }

                this.bricks.push({
                    x, y, w: brickW, h: brickH,
                    color,
                    type,
                    hp, maxHp: hp,
                    alive: true,
                    points: this.getBrickPoints(type, r),
                    hit: false, hitTimer: 0,
                    scale: 0,
                    colorIdx: r,
                    shimmer: Math.random() * Math.PI * 2,
                    powerupChance: Math.random()
                });
            }
        }

        // Scale in animation
        this.bricks.forEach((b, i) => {
            setTimeout(() => { if (b) b.scale = 1; }, i * 8);
        });
    }

    getBrickPoints(type, row) {
        const basePoints = { normal: 10, steel: 30, explosive: 20, gold: 50, rainbow: 80 };
        return (basePoints[type] || 10) * (1 + row * 0.5) * this.level;
    }

    // ==================== EVENTS ====================

    bindEvents() {
        this.boundKeyDown = (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ') {
                e.preventDefault();
                this.releaseBall();
            }
        };
        this.boundKeyUp = (e) => { this.keys[e.key] = false; };
        this.boundMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        };
        this.boundClick = (e) => {
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            this.releaseBall();
            if (this.paddle.laserActive && this.laserCooldown <= 0) this.fireLaser();
        };
        this.boundTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
        };
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            this.releaseBall();
        };

        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('click', this.boundClick);
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    }

    releaseBall() {
        this.balls.forEach(b => {
            if (b.attached) {
                b.attached = false;
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
                b.vx = Math.cos(angle) * b.speed;
                b.vy = Math.sin(angle) * b.speed;
            }
        });
    }

    fireLaser() {
        if (this.laserCooldown > 0) return;
        this.lasers.push(
            { x: this.paddle.x - 20, y: this.paddle.y - 15, speed: 12, active: true },
            { x: this.paddle.x + 20, y: this.paddle.y - 15, speed: 12, active: true }
        );
        this.laserCooldown = 400;
        if (window.audioManager) audioManager.play('shoot');
    }

    restartGame() {
        this.score = 0;
        this.onScore(0);
        this.state = this.STATE.WAITING;
        this.gameOver = false;
        this.level = 1;
        this.lives = 3;
        this.combo = 0;
        this.comboTimer = 0;
        this.deathOverlayAlpha = 0;
        this.flashAlpha = 0;
        this.powerups = [];
        this.lasers = [];
        this.particles = [];
        this.explosions = [];
        this.scorePopups = [];
        Object.keys(this.activePowerups).forEach(k => this.activePowerups[k] = false);
        this.paddle.w = 100;
        this.paddle.magnetActive = false;
        this.paddle.laserActive = false;
        this.paddle.wideActive = false;
        this.shieldLine = false;
        this.initBall();
        this.createBricks();
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        this.stars.forEach(s => s.t += s.speed);

        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 20);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.4 * (this.screenShake.timer / 20);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.04;

        // Bricks shimmer
        this.bricks.forEach(b => { if (b.alive) b.shimmer += 0.03; });

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        if (this.state === this.STATE.WAITING) return;
        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.015);
            this.updateParticles(dt);
            return;
        }
        if (this.state === this.STATE.LEVEL_UP) {
            this.levelUpTimer -= dt;
            if (this.levelUpTimer <= 0) {
                this.state = this.STATE.PLAYING;
                this.level++;
                this.createBricks();
                this.initBall();
                this.powerups = [];
                this.lasers = [];
                Object.keys(this.activePowerups).forEach(k => this.activePowerups[k] = false);
                this.paddle.w = this.paddle.wideActive ? 160 : 100;
            }
            this.updateParticles(dt);
            return;
        }

        // Paddle
        this.updatePaddle(dt);

        // Balls
        this.updateBalls(dt);

        // Lasers
        this.updateLasers(dt);
        if (this.laserCooldown > 0) this.laserCooldown -= dt;

        // Powerups
        this.updatePowerups(dt);

        // Active powerup timers
        this.updateActivePowerups(dt);

        // Particles
        this.updateParticles(dt);

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        // Shield
        if (this.shieldAlpha > 0) this.shieldAlpha -= 0.03;

        // Check level complete
        if (this.bricks.filter(b => b.alive && b.type !== 'steel').length === 0) {
            this.state = this.STATE.LEVEL_UP;
            this.levelUpTimer = 1800;
            this.score += 200 * this.level;
            this.onScore(this.score);
            this.screenShake.timer = 15;
            this.screenShake.intensity = 8;
            this.flashAlpha = 0.4;
            this.flashColor = '#00FF88';
            if (window.audioManager) audioManager.play('levelUp');
        }
    }

    updatePaddle(dt) {
        const p = this.paddle;

        // Keyboard
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) p.targetX -= p.speed * 2;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.targetX += p.speed * 2;

        // Mouse/touch
        p.targetX = this.mouseX;

        // Smooth movement
        p.x += (p.targetX - p.x) * 0.18;
        p.x = Math.max(p.w / 2, Math.min(this.canvas.width - p.w / 2, p.x));

        // Hit animation
        if (p.hitAnim > 0) p.hitAnim -= dt;

        // Timers
        if (p.magnetTimer > 0) { p.magnetTimer -= dt; if (p.magnetTimer <= 0) { p.magnetActive = false; this.activePowerups.magnet = false; } }
        if (p.laserTimer > 0) { p.laserTimer -= dt; if (p.laserTimer <= 0) { p.laserActive = false; this.activePowerups.laser = false; } }
        if (p.wideTimer > 0) {
            p.wideTimer -= dt;
            if (p.wideTimer <= 0) {
                p.wideActive = false;
                this.activePowerups.wide = false;
                p.w = 100;
            }
        }
    }

    updateBalls(dt) {
        const slowFactor = this.activePowerups.slow ? 0.55 : 1;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            if (ball.attached) {
                ball.x = this.paddle.x + (ball.attachOffset || 0);
                ball.y = this.paddle.y - this.paddle.h / 2 - ball.r;

                // Magnet - hold ball
                if (this.paddle.magnetActive) {
                    ball.attachOffset = ball.attachOffset || 0;
                    continue;
                }
                continue;
            }

            // Trail
            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 12) ball.trail.shift();

            // Move
            ball.x += ball.vx * slowFactor;
            ball.y += ball.vy * slowFactor;

            // Normalize speed
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const targetSpd = ball.speed * slowFactor;
            if (Math.abs(spd - targetSpd) > 0.5) {
                ball.vx = (ball.vx / spd) * targetSpd;
                ball.vy = (ball.vy / spd) * targetSpd;
            }

            // Wall collisions
            if (ball.x - ball.r <= 0) {
                ball.x = ball.r;
                ball.vx = Math.abs(ball.vx);
                this.spawnWallHitParticles(ball.x, ball.y);
                if (window.audioManager) audioManager.play('bounce');
            }
            if (ball.x + ball.r >= this.canvas.width) {
                ball.x = this.canvas.width - ball.r;
                ball.vx = -Math.abs(ball.vx);
                this.spawnWallHitParticles(ball.x, ball.y);
                if (window.audioManager) audioManager.play('bounce');
            }
            if (ball.y - ball.r <= 0) {
                ball.y = ball.r;
                ball.vy = Math.abs(ball.vy);
                this.spawnWallHitParticles(ball.x, ball.y);
                if (window.audioManager) audioManager.play('bounce');
            }

            // Bottom - lose ball
            if (ball.y + ball.r > this.canvas.height + 20) {
                if (this.activePowerups.shield) {
                    // Shield bounce
                    ball.y = this.canvas.height - 30;
                    ball.vy = -Math.abs(ball.vy);
                    this.shieldAlpha = 1;
                    this.activePowerups.shield = false;
                    this.shieldLine = false;
                    this.flashAlpha = 0.2;
                    this.flashColor = '#00D4FF';
                    if (window.audioManager) audioManager.play('powerup');
                } else {
                    this.balls.splice(i, 1);
                    if (this.balls.length === 0) this.lostBall();
                }
                continue;
            }

            // Paddle collision
            this.checkPaddleCollision(ball);

            // Brick collision
            this.checkBrickCollisions(ball);
        }
    }

    checkPaddleCollision(ball) {
        const p = this.paddle;
        const pw = p.wideActive ? p.w : p.w;

        if (ball.x > p.x - pw / 2 - ball.r &&
            ball.x < p.x + pw / 2 + ball.r &&
            ball.y + ball.r > p.y - p.h / 2 &&
            ball.y + ball.r < p.y + p.h / 2 + 10 &&
            ball.vy > 0) {

            // Angle based on hit position
            const hitPos = (ball.x - p.x) / (pw / 2);
            const maxAngle = Math.PI * 0.75;
            const angle = (Math.PI / 2) + hitPos * (maxAngle / 2 - Math.PI / 2);

            ball.vx = Math.cos(angle) * ball.speed;
            ball.vy = -Math.abs(Math.sin(angle) * ball.speed);
            ball.y = p.y - p.h / 2 - ball.r;

            // Add spin from paddle movement
            const paddleVel = (p.x - (p.prevX || p.x));
            ball.vx += paddleVel * 0.3;
            ball.spin = paddleVel * 0.1;

            p.prevX = p.x;
            p.hitAnim = 200;

            // Magnet - attach ball
            if (p.magnetActive) {
                ball.attached = true;
                ball.attachOffset = ball.x - p.x;
            }

            this.combo++;
            this.comboTimer = 3000;
            this.maxCombo = Math.max(this.maxCombo, this.combo);

            this.spawnPaddleHitParticles(ball.x, ball.y);
            if (window.audioManager) audioManager.play('bounce');
        }
        p.prevX = p.x;
    }

    checkBrickCollisions(ball) {
        for (let i = 0; i < this.bricks.length; i++) {
            const b = this.bricks[i];
            if (!b.alive) continue;

            const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
            const closestY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < ball.r) {
                // Bounce direction
                if (Math.abs(dx) > Math.abs(dy)) {
                    ball.vx *= -1;
                } else {
                    ball.vy *= -1;
                }

                // Push out
                const overlap = ball.r - dist;
                if (dist > 0) {
                    ball.x += (dx / dist) * overlap;
                    ball.y += (dy / dist) * overlap;
                }

                this.hitBrick(b, ball);
                break;
            }
        }
    }

    hitBrick(brick, ball) {
        brick.hp--;
        brick.hit = true;
        brick.hitTimer = 150;

        if (brick.type === 'rainbow') {
            const colors = ['#FF006E', '#FF8C00', '#FFD700', '#00FF88', '#00D4FF', '#b347d9'];
            brick.color = colors[Math.floor(Math.random() * colors.length)];
        }

        if (brick.hp <= 0) {
            brick.alive = false;

            // Explosion for explosive bricks
            if (brick.type === 'explosive') {
                this.triggerExplosion(brick);
            }

            const comboMult = Math.min(this.combo, 8);
            const pts = Math.round(brick.points * (1 + comboMult * 0.1));
            this.score += pts;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('breakout_best', this.bestScore);
            }
            this.onScore(this.score);

            this.spawnBrickParticles(
                brick.x + brick.w / 2,
                brick.y + brick.h / 2,
                brick.color
            );

            this.explosions.push({
                x: brick.x + brick.w / 2,
                y: brick.y + brick.h / 2,
                radius: 4, maxRadius: brick.w / 2,
                opacity: 0.8, color: brick.color
            });

            this.scorePopups.push({
                x: brick.x + brick.w / 2,
                y: brick.y,
                text: comboMult > 1 ? `+${pts} x${comboMult}!` : `+${pts}`,
                color: comboMult > 2 ? '#FFD700' : brick.color,
                life: 1000, opacity: 1
            });

            // Powerup drop
            if (brick.powerupChance < 0.18 + this.level * 0.01) {
                this.dropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
            }

            this.screenShake.timer = comboMult > 3 ? 8 : 3;
            this.screenShake.intensity = comboMult > 3 ? 6 : 2;

            if (window.audioManager) {
                if (comboMult > 3) audioManager.play('success');
                else audioManager.play('hit');
            }
        } else {
            this.spawnBrickParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 4);
            if (window.audioManager) audioManager.play('bounce');
        }
    }

    triggerExplosion(brick) {
        const cx = brick.x + brick.w / 2;
        const cy = brick.y + brick.h / 2;
        const radius = 70;

        // Kill nearby bricks
        this.bricks.forEach(b => {
            if (!b.alive || b === brick) return;
            const bx = b.x + b.w / 2;
            const by = b.y + b.h / 2;
            const dist = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
            if (dist < radius && b.type !== 'steel') {
                b.hp = 0;
                b.alive = false;
                this.score += b.points;
                this.spawnBrickParticles(bx, by, b.color);
            }
        });

        // Big explosion effect
        for (let i = 0; i < 3; i++) {
            this.explosions.push({
                x: cx + (Math.random() - 0.5) * 40,
                y: cy + (Math.random() - 0.5) * 20,
                radius: 4, maxRadius: 40 + i * 15,
                opacity: 1, color: i === 0 ? '#FFD700' : i === 1 ? '#FF8C00' : '#FF0055'
            });
        }

        this.spawnBrickParticles(cx, cy, '#FF8C00', 20);
        this.screenShake.timer = 15;
        this.screenShake.intensity = 10;
        this.flashAlpha = 0.3;
        this.flashColor = '#FF8C00';
        this.onScore(this.score);
        if (window.audioManager) audioManager.play('levelUp');
    }

    updateLasers(dt) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.y -= laser.speed;

            if (laser.y < -10) { this.lasers.splice(i, 1); continue; }

            // Check brick collision
            let hit = false;
            for (const b of this.bricks) {
                if (!b.alive) continue;
                if (laser.x > b.x && laser.x < b.x + b.w &&
                    laser.y > b.y && laser.y < b.y + b.h) {
                    this.hitBrick(b, { x: laser.x, y: laser.y, r: 2 });
                    this.lasers.splice(i, 1);
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }
    }

    dropPowerup(x, y) {
        const types = [
            { type: 'multiball', color: '#FF006E', emoji: '🔴', label: 'MULTI' },
            { type: 'wide', color: '#00FF88', emoji: '⬛', label: 'WIDE' },
            { type: 'laser', color: '#FFD700', emoji: '⚡', label: 'LASER' },
            { type: 'magnet', color: '#00D4FF', emoji: '🧲', label: 'MAGNET' },
            { type: 'slow', color: '#b347d9', emoji: '⏱', label: 'SLOW' },
            { type: 'shield', color: '#00FF88', emoji: '🛡', label: 'SHIELD' },
            { type: 'life', color: '#FF006E', emoji: '❤️', label: '+LIFE' }
        ];

        const t = types[Math.floor(Math.random() * types.length)];
        this.powerups.push({
            x, y, vy: 2,
            ...t,
            pulse: Math.random() * Math.PI * 2,
            w: 36, h: 20
        });
    }

    updatePowerups(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.vy;
            p.pulse += 0.06;

            if (p.y > this.canvas.height + 30) { this.powerups.splice(i, 1); continue; }

            // Collect
            if (p.x > this.paddle.x - this.paddle.w / 2 - p.w / 2 &&
                p.x < this.paddle.x + this.paddle.w / 2 + p.w / 2 &&
                p.y > this.paddle.y - this.paddle.h / 2 - p.h &&
                p.y < this.paddle.y + this.paddle.h / 2) {
                this.applyPowerup(p);
                this.powerups.splice(i, 1);
            }
        }
    }

    applyPowerup(p) {
        switch (p.type) {
            case 'multiball':
                const mainBall = this.balls.find(b => !b.attached) || this.balls[0];
                if (mainBall) {
                    for (let i = 0; i < 2; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        this.balls.push({
                            x: mainBall.x, y: mainBall.y,
                            vx: Math.cos(angle) * mainBall.speed,
                            vy: -Math.abs(Math.sin(angle) * mainBall.speed),
                            r: 8, speed: mainBall.speed,
                            attached: false, trail: [],
                            color: ['#FF006E', '#FFD700', '#00FF88'][i],
                            glow: ['#ff4499', '#FFE44D', '#44ffaa'][i],
                            spin: 0
                        });
                    }
                }
                this.activePowerups.multiball = true;
                break;
            case 'wide':
                this.paddle.w = 160;
                this.paddle.wideActive = true;
                this.paddle.wideTimer = 8000;
                this.activePowerups.wide = true;
                break;
            case 'laser':
                this.paddle.laserActive = true;
                this.paddle.laserTimer = 8000;
                this.activePowerups.laser = true;
                break;
            case 'magnet':
                this.paddle.magnetActive = true;
                this.paddle.magnetTimer = 6000;
                this.activePowerups.magnet = true;
                break;
            case 'slow':
                this.activePowerups.slow = true;
                setTimeout(() => { this.activePowerups.slow = false; }, 6000);
                break;
            case 'shield':
                this.activePowerups.shield = true;
                this.shieldLine = true;
                break;
            case 'life':
                this.lives = Math.min(this.lives + 1, 5);
                break;
        }

        this.spawnBrickParticles(p.x, p.y, p.color, 12);
        this.scorePopups.push({
            x: p.x, y: p.y,
            text: `${p.emoji} ${p.label}!`,
            color: p.color, life: 1200, opacity: 1
        });
        this.flashAlpha = 0.15;
        this.flashColor = p.color;
        if (window.audioManager) audioManager.play('powerup');
    }

    updateActivePowerups(dt) {
        if (this.paddle.laserActive) {
            if (this.keys[' '] && this.laserCooldown <= 0) this.fireLaser();
        }
    }

    lostBall() {
        this.lives--;
        this.screenShake.timer = 20;
        this.screenShake.intensity = 12;
        this.flashAlpha = 0.5;
        this.flashColor = '#FF0055';

        if (this.lives <= 0) {
            this.gameOver = true;
            this.state = this.STATE.DEAD;
            setTimeout(() => this.onScore(this.score, true), 1200);
            if (window.audioManager) audioManager.play('gameOver');
        } else {
            this.initBall();
            this.paddle.w = 100;
            this.paddle.magnetActive = false;
            this.paddle.laserActive = false;
            Object.keys(this.activePowerups).forEach(k => this.activePowerups[k] = false);
            if (window.audioManager) audioManager.play('fail');
        }
    }

    // ==================== PARTICLES ====================

    spawnBrickParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: Math.random() * 5 + 2,
                life: 1, decay: 0.03,
                color, gravity: 0.12
            });
        }
    }

    spawnPaddleHitParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 3 - 1,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.06,
                color: this.paddle.color, gravity: 0.1
            });
        }
    }

    spawnWallHitParticles(x, y) {
        for (let i = 0; i < 4; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                size: Math.random() * 2 + 1,
                life: 1, decay: 0.08,
                color: '#fff', gravity: 0.05
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
            e.radius += 3;
            e.opacity -= 0.05;
            return e.opacity > 0 && e.radius < (e.maxRadius || 60);
        });
    }

    // ==================== DRAW ====================

    draw(timestamp) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        this.drawBackground(timestamp);
        this.drawShield();
        this.drawBricks(timestamp);
        this.drawPowerupsD(timestamp);
        this.drawLasersD();
        this.drawExplosions();
        this.drawParticlesD();
        this.drawBalls(timestamp);
        this.drawPaddle(timestamp);
        this.drawScorePopupsD();

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        }

        this.drawHUD(timestamp);

        if (this.state === this.STATE.WAITING) this.drawWaiting(timestamp);
        if (this.state === this.STATE.LEVEL_UP) this.drawLevelUp(timestamp);
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

        this.stars.forEach(s => {
            const a = 0.2 + Math.sin(s.t) * 0.3;
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Grid glow
        ctx.strokeStyle = 'rgba(179,71,217,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }

    drawShield() {
        if (!this.shieldLine && this.shieldAlpha <= 0) return;
        const ctx = this.ctx;
        const alpha = this.shieldLine ? (0.4 + Math.sin(Date.now() / 200) * 0.3) : this.shieldAlpha;
        ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00d4ff';
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(0, this.canvas.height - 18);
        ctx.lineTo(this.canvas.width, this.canvas.height - 18);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    drawBricks(timestamp) {
        const ctx = this.ctx;
        this.bricks.forEach(b => {
            if (!b.alive) return;

            const hpPct = b.hp / b.maxHp;
            const shimmer = Math.sin(b.shimmer) * 0.1;

            ctx.save();
            ctx.translate(b.x + b.w / 2, b.y + b.h / 2);

            if (b.scale !== 1) {
                const s = b.scale || 0;
                ctx.scale(s, s);
            }

            if (b.hit) {
                ctx.globalAlpha = 0.6;
            }

            // Main brick
            const isSteel = b.type === 'steel';
            const isExplosive = b.type === 'explosive';
            const isGold = b.type === 'gold';
            const isRainbow = b.type === 'rainbow';

            ctx.shadowBlur = 8 + shimmer * 15;
            ctx.shadowColor = b.color;

            // Gradient fill
            const grad = ctx.createLinearGradient(-b.w / 2, -b.h / 2, b.w / 2, b.h / 2);
            if (isSteel) {
                grad.addColorStop(0, '#888');
                grad.addColorStop(0.5, '#ccc');
                grad.addColorStop(1, '#666');
            } else {
                grad.addColorStop(0, this.lightenColor(b.color, 50));
                grad.addColorStop(0.4, b.color);
                grad.addColorStop(1, this.darkenColor(b.color, 40));
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 5);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Border
            ctx.strokeStyle = `rgba(255,255,255,${0.15 + shimmer * 0.2})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Shine
            ctx.fillStyle = `rgba(255,255,255,${0.18 + shimmer * 0.1})`;
            ctx.beginPath();
            ctx.roundRect(-b.w / 2 + 3, -b.h / 2 + 3, b.w - 6, b.h * 0.4, 3);
            ctx.fill();

            // HP cracks
            if (b.maxHp > 1) {
                const crackAlpha = 1 - hpPct;
                ctx.strokeStyle = `rgba(0,0,0,${crackAlpha * 0.6})`;
                ctx.lineWidth = 1.5;
                for (let c = 0; c < b.maxHp - b.hp; c++) {
                    ctx.beginPath();
                    ctx.moveTo(-b.w / 2 + 5 + c * 12, -b.h / 2 + 3);
                    ctx.lineTo(-b.w / 2 + 5 + c * 12 + 8, b.h / 2 - 3);
                    ctx.stroke();
                }
            }

            // Special markers
            if (isExplosive) {
                ctx.font = '12px serif';
                ctx.textAlign = 'center';
                ctx.fillText('💥', 0, 5);
            } else if (isGold) {
                ctx.fillStyle = 'rgba(255,215,0,0.4)';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (isRainbow) {
                const rColors = ['#FF006E', '#FF8C00', '#FFD700', '#00FF88', '#00D4FF', '#b347d9'];
                rColors.forEach((rc, i) => {
                    ctx.fillStyle = rc;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(-b.w / 2 + i * (b.w / 6), -b.h / 2, b.w / 6, b.h);
                });
                ctx.globalAlpha = 1;
            }

            ctx.restore();

            if (b.hitTimer > 0) b.hitTimer -= 16;
            if (b.hitTimer <= 0) b.hit = false;
        });
        ctx.textAlign = 'left';
    }

    drawBalls(timestamp) {
        const ctx = this.ctx;
        this.balls.forEach(ball => {
            // Trail
            ball.trail.forEach((t, i) => {
                const a = (i / ball.trail.length) * 0.4;
                const r = ball.r * (i / ball.trail.length) * 0.8;
                ctx.globalAlpha = a;
                ctx.beginPath();
                ctx.arc(t.x, t.y, Math.max(1, r), 0, Math.PI * 2);
                ctx.fillStyle = ball.glow;
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // Glow
            ctx.shadowBlur = 18;
            ctx.shadowColor = ball.glow;

            // Ball body
            const ballGrad = ctx.createRadialGradient(
                ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 1,
                ball.x, ball.y, ball.r
            );
            ballGrad.addColorStop(0, '#fff');
            ballGrad.addColorStop(0.4, ball.color || '#ddd');
            ballGrad.addColorStop(1, ball.glow);
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fillStyle = ballGrad;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Attached indicator
            if (ball.attached) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(ball.x, ball.y + ball.r);
                ctx.lineTo(ball.x, ball.y + ball.r + 15);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }

    drawPaddle(timestamp) {
        const ctx = this.ctx;
        const p = this.paddle;
        const pw = p.w;
        const hitScale = p.hitAnim > 0 ? 1 + (p.hitAnim / 200) * 0.08 : 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(hitScale, hitScale);

        // Glow
        ctx.shadowBlur = p.laserActive ? 20 : p.magnetActive ? 18 : 12;
        ctx.shadowColor = p.laserActive ? '#FFD700' : p.magnetActive ? '#00D4FF' : '#b347d9';

        // Paddle gradient
        const pg = ctx.createLinearGradient(-pw / 2, -p.h / 2, pw / 2, p.h / 2);
        if (p.laserActive) {
            pg.addColorStop(0, '#886600');
            pg.addColorStop(0.3, '#FFD700');
            pg.addColorStop(0.7, '#FFD700');
            pg.addColorStop(1, '#886600');
        } else if (p.magnetActive) {
            pg.addColorStop(0, '#006688');
            pg.addColorStop(0.3, '#00D4FF');
            pg.addColorStop(0.7, '#00D4FF');
            pg.addColorStop(1, '#006688');
        } else if (p.wideActive) {
            pg.addColorStop(0, '#006644');
            pg.addColorStop(0.3, '#00FF88');
            pg.addColorStop(0.7, '#00FF88');
            pg.addColorStop(1, '#006644');
        } else {
            pg.addColorStop(0, '#5a1a88');
            pg.addColorStop(0.3, '#b347d9');
            pg.addColorStop(0.7, '#b347d9');
            pg.addColorStop(1, '#5a1a88');
        }
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.roundRect(-pw / 2, -p.h / 2, pw, p.h, 7);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(-pw / 2 + 4, -p.h / 2 + 2, pw - 8, p.h * 0.4, 4);
        ctx.fill();

        // Laser ports
        if (p.laserActive) {
            [-pw / 2 + 8, pw / 2 - 8].forEach(lx => {
                ctx.fillStyle = '#FFD700';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#FFD700';
                ctx.beginPath();
                ctx.arc(lx, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
        }

        // Magnet poles
        if (p.magnetActive) {
            ctx.fillStyle = '#FF006E';
            ctx.fillRect(-pw / 2 + 5, -p.h / 2, 12, p.h);
            ctx.fillStyle = '#00D4FF';
            ctx.fillRect(pw / 2 - 17, -p.h / 2, 12, p.h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('N', -pw / 2 + 11, 3);
            ctx.fillText('S', pw / 2 - 11, 3);
        }

        ctx.restore();
        ctx.textAlign = 'left';
    }

    drawPowerupsD(timestamp) {
        const ctx = this.ctx;
        this.powerups.forEach(p => {
            const pulse = 0.9 + Math.sin(p.pulse) * 0.1;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = p.color;
            ctx.font = 'bold 9px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(p.emoji + ' ' + p.label, 0, 4);
            ctx.shadowBlur = 0;

            ctx.restore();
        });
        ctx.textAlign = 'left';
    }

    drawLasersD() {
        const ctx = this.ctx;
        this.lasers.forEach(laser => {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#FFD700';
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(laser.x - 2, laser.y - 8, 4, 16);
            ctx.fillStyle = '#fff';
            ctx.fillRect(laser.x - 1, laser.y - 6, 2, 4);
            ctx.shadowBlur = 0;
        });
    }

    drawExplosions() {
        const ctx = this.ctx;
        this.explosions.forEach(e => {
            ctx.globalAlpha = e.opacity;
            ctx.shadowBlur = 10;
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
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
            ctx.font = 'bold 13px Orbitron';
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

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Orbitron';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`${this.score}`, 10, 26);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,215,0,0.5)';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`BEST: ${this.bestScore}`, 10, 37);

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LEVEL ${this.level}`, W / 2, 24);
        ctx.shadowBlur = 0;

        // Bricks left
        const aliveBricks = this.bricks.filter(b => b.alive && b.type !== 'steel').length;
        ctx.fillStyle = '#555';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`🧱 ${aliveBricks}`, W / 2, 36);

        // Lives
        ctx.textAlign = 'right';
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i < this.lives ? '#FF006E' : 'rgba(255,255,255,0.1)';
            ctx.shadowBlur = i < this.lives ? 6 : 0;
            ctx.shadowColor = '#FF006E';
            ctx.font = '14px serif';
            ctx.fillText('●', W - 10 - i * 18, 26);
        }
        ctx.shadowBlur = 0;

        // Ball count
        if (this.balls.length > 1) {
            ctx.fillStyle = '#00D4FF';
            ctx.font = '11px Orbitron';
            ctx.textAlign = 'right';
            ctx.fillText(`🔴 x${this.balls.length}`, W - 10, 38);
        }

        // Active powerup bars
        let barX = 5;
        const barEntries = [
            { key: 'wide', label: '⬛', color: '#00FF88', timer: this.paddle.wideTimer, max: 8000 },
            { key: 'laser', label: '⚡', color: '#FFD700', timer: this.paddle.laserTimer, max: 8000 },
            { key: 'magnet', label: '🧲', color: '#00D4FF', timer: this.paddle.magnetTimer, max: 6000 },
        ];

        barEntries.forEach(e => {
            if (!this.activePowerups[e.key]) return;
            const pct = e.timer / e.max;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(barX, 42, 55, 8, 3);
            ctx.fill();
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.roundRect(barX, 42, 55 * pct, 8, 3);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '8px Rajdhani';
            ctx.textAlign = 'left';
            ctx.fillText(e.label, barX + 2, 50);
            barX += 60;
        });

        if (this.activePowerups.slow) {
            ctx.fillStyle = 'rgba(179,71,217,0.3)';
            ctx.fillRect(0, 0, 5, this.canvas.height);
            ctx.fillRect(W - 5, 0, 5, this.canvas.height);
        }

        // Combo
        if (this.combo > 2) {
            const ca = Math.min(1, this.comboTimer / 1000);
            ctx.globalAlpha = ca;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`x${this.combo} COMBO!`, W / 2, 56);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawWaiting(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2 + 60;
        const bob = Math.sin(timestamp / 400) * 5;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(cx - 140, cy - 38, 280, 75, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,71,217,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 22px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#b347d9';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#b347d9';
        ctx.fillText('NEON BREAKOUT', cx, cy - 8);
        ctx.shadowBlur = 0;
        ctx.font = '13px Rajdhani';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Click / Move Mouse / Touch', cx, cy + 18 + bob);
        ctx.font = '11px Rajdhani';
        ctx.fillStyle = '#666';
        ctx.fillText('Space to launch ball', cx, cy + 34);
        ctx.textAlign = 'left';
    }

    drawLevelUp(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const prog = 1 - (this.levelUpTimer / 1800);

        ctx.fillStyle = `rgba(0,0,0,${prog * 0.6})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.globalAlpha = Math.min(1, prog * 2);
        ctx.font = 'bold 36px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF88';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FF88';
        ctx.fillText('LEVEL CLEAR!', cx, cy - 20);
        ctx.shadowBlur = 0;
        ctx.font = '18px Rajdhani';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Level ${this.level + 1} incoming...`, cx, cy + 20);

        // Stars
        for (let i = 0; i < 3; i++) {
            const starProg = Math.max(0, prog * 3 - i);
            ctx.globalAlpha = Math.min(1, starProg);
            ctx.font = '36px serif';
            ctx.fillText('⭐', cx + (i - 1) * 50, cy + 65);
        }

        ctx.globalAlpha = 1;
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
        ctx.strokeStyle = 'rgba(179,71,217,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#b347d9';
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 30px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', cx, cy - ph / 2 + 50);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + 20, cy - ph / 2 + 65);
        ctx.lineTo(cx + pw / 2 - 20, cy - ph / 2 + 65);
        ctx.stroke();

        const rows = [
            { label: 'SCORE', val: this.score, color: '#fff' },
            { label: 'BEST', val: this.bestScore, color: this.score >= this.bestScore ? '#FFD700' : '#fff' },
            { label: 'LEVEL', val: this.level, color: '#b347d9' },
            { label: 'MAX COMBO', val: `x${this.maxCombo}`, color: '#FFD700' }
        ];

        rows.forEach((r, i) => {
            const ry = cy - ph / 2 + 98 + i * 32;
            ctx.font = '13px Rajdhani';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'left';
            ctx.fillText(r.label, cx - pw / 2 + 25, ry);
            ctx.font = 'bold 14px Orbitron';
            ctx.fillStyle = r.color;
            ctx.textAlign = 'right';
            ctx.fillText(r.val, cx + pw / 2 - 25, ry);
        });

        const tap = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${tap})`;
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO PLAY AGAIN', cx, cy + ph / 2 - 18);

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

    resize() {
        this.paddle.y = this.canvas.height - 38;
        this.balls.forEach(b => { if (b.attached) b.y = this.paddle.y - this.paddle.h / 2 - b.r; });
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    }
}