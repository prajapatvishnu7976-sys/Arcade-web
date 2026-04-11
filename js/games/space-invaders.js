/* ============================================
   SPACE INVADERS - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class SpaceInvaders {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('space_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Game States
        this.STATE = { WAITING: 0, PLAYING: 1, DEAD: 2, LEVEL_UP: 3 };
        this.state = this.STATE.WAITING;

        // Player
        this.player = {
            x: canvas.width / 2,
            y: canvas.height - 55,
            w: 48, h: 28,
            speed: 5,
            shooting: false,
            shootCooldown: 0,
            shootRate: 280,
            lives: 3,
            invincible: 0,
            thrusterAnim: 0,
            hit: false,
            hitTimer: 0,
            shield: false,
            shieldTimer: 0
        };

        // Bullets
        this.playerBullets = [];
        this.enemyBullets = [];

        // Enemies
        this.enemies = [];
        this.enemyDir = 1;
        this.enemyMoveTimer = 0;
        this.enemyMoveInterval = 800;
        this.enemyDropDistance = 18;
        this.enemyShooting = true;
        this.enemyShootTimer = 0;
        this.enemyShootInterval = 1200;

        // Level
        this.level = 1;
        this.wave = 1;

        // Barriers
        this.barriers = [];

        // Boss
        this.boss = null;
        this.bossActive = false;
        this.bossTimer = 0;

        // UFO
        this.ufo = null;
        this.ufoTimer = 0;
        this.ufoInterval = 15000;

        // Powerups
        this.powerups = [];

        // Explosions & Particles
        this.particles = [];
        this.explosions = [];
        this.scorePopups = [];
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';

        // Background
        this.stars = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 2 + 0.3,
            speed: Math.random() * 0.3 + 0.05,
            t: Math.random() * Math.PI * 2
        }));
        this.nebulas = Array.from({ length: 3 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 120 + 60,
            color: ['#1a0030', '#001a30', '#001a10'][Math.floor(Math.random() * 3)],
            alpha: Math.random() * 0.15 + 0.05
        }));

        // Input
        this.keys = {};
        this.lastTime = 0;

        this.setupLevel();
        this.createBarriers();

        this.boundKeyDown = (e) => { this.keys[e.key] = true; };
        this.boundKeyUp = (e) => { this.keys[e.key] = false; };
        this.boundClick = this.handleClick.bind(this);
        this.boundTouch = this.handleTouch.bind(this);
        this.boundTouchMove = this.handleTouchMove.bind(this);

        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
        canvas.addEventListener('click', this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch, { passive: false });
        canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });

        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== SETUP ====================

    setupLevel() {
        this.enemies = [];
        const rows = Math.min(3 + Math.floor(this.level / 2), 6);
        const cols = Math.min(7 + this.level, 12);
        const startX = (this.canvas.width - cols * 52) / 2 + 26;
        const startY = 70 + (this.wave - 1) * 5;

        const types = [
            { hp: 1, points: 10, color: '#FF006E', glow: '#ff4499', size: 'small', emoji: '👾' },
            { hp: 2, points: 20, color: '#FF8C00', glow: '#ffaa44', size: 'medium', emoji: '🛸' },
            { hp: 3, points: 30, color: '#b347d9', glow: '#dd88ff', size: 'large', emoji: '👽' },
        ];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const typeIdx = Math.min(Math.floor(r * 3 / rows), 2);
                const t = types[typeIdx];
                this.enemies.push({
                    x: startX + c * 52,
                    y: startY + r * 42,
                    w: 34, h: 28,
                    type: typeIdx,
                    hp: t.hp + Math.floor(this.level / 3),
                    maxHp: t.hp + Math.floor(this.level / 3),
                    points: t.points * this.level,
                    color: t.color,
                    glow: t.glow,
                    emoji: t.emoji,
                    alive: true,
                    animFrame: 0,
                    animTimer: 0,
                    hit: false,
                    hitTimer: 0,
                    deathAnim: false,
                    deathTimer: 0
                });
            }
        }

        this.enemyMoveInterval = Math.max(200, 800 - (this.level - 1) * 60);
        this.enemyShootInterval = Math.max(500, 1200 - (this.level - 1) * 80);
        this.enemyMoveTimer = 0;
        this.enemyShootTimer = 0;
        this.enemyDir = 1;
    }

    createBarriers() {
        this.barriers = [];
        const barrierCount = 4;
        const barrierW = 60;
        const barrierH = 40;
        const spacing = (this.canvas.width - barrierCount * barrierW) / (barrierCount + 1);

        for (let i = 0; i < barrierCount; i++) {
            const bx = spacing + i * (barrierW + spacing);
            const by = this.canvas.height - 120;
            const blocks = [];

            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 6; c++) {
                    // Shape it like a bunker
                    if (r === 0 && (c === 0 || c === 5)) continue;
                    if (r === 3 && (c === 2 || c === 3)) continue;
                    blocks.push({
                        x: bx + c * 10,
                        y: by + r * 10,
                        w: 10, h: 10,
                        hp: 4,
                        maxHp: 4
                    });
                }
            }
            this.barriers.push({ x: bx, y: by, blocks });
        }
    }

    spawnBoss() {
        this.boss = {
            x: this.canvas.width / 2,
            y: 80,
            w: 90, h: 50,
            hp: 20 + this.level * 5,
            maxHp: 20 + this.level * 5,
            speed: 1.5 + this.level * 0.2,
            dir: 1,
            phase: 1,
            shootTimer: 0,
            shootInterval: 800,
            pattern: 0,
            patternTimer: 0,
            anim: 0,
            color: '#FF0055',
            glow: '#ff4488',
            hit: false,
            hitTimer: 0
        };
        this.bossActive = true;
    }

    spawnUFO() {
        this.ufo = {
            x: -40,
            y: 45,
            speed: 2.5,
            points: [50, 100, 150, 300][Math.floor(Math.random() * 4)],
            color: '#FF006E',
            anim: 0
        };
    }

    // ==================== INPUT ====================

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
        if (this.state === this.STATE.DEAD && this.flashAlpha < 0.2) { this.restartGame(); return; }
        this.player.x = mx;
        this.shootPlayer();
    }

    handleTouch(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
        if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
        if (this.state === this.STATE.DEAD && this.flashAlpha < 0.1) { this.restartGame(); return; }
        this.player.x = mx;
        this.shootPlayer();
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.state !== this.STATE.PLAYING) return;
        const rect = this.canvas.getBoundingClientRect();
        this.player.x = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
    }

    shootPlayer() {
        if (this.player.shootCooldown > 0) return;
        this.playerBullets.push({
            x: this.player.x,
            y: this.player.y - 20,
            w: 4, h: 14,
            speed: 10,
            color: '#00FF88',
            glow: '#00ff88',
            trail: []
        });
        this.player.shootCooldown = this.player.shootRate;
        if (window.audioManager) audioManager.play('shoot');
    }

    restartGame() {
        this.score = 0;
        this.onScore(0);
        this.state = this.STATE.WAITING;
        this.gameOver = false;
        this.level = 1;
        this.wave = 1;
        this.player.lives = 3;
        this.player.x = this.canvas.width / 2;
        this.player.invincible = 0;
        this.player.shield = false;
        this.player.shieldTimer = 0;
        this.playerBullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.explosions = [];
        this.scorePopups = [];
        this.powerups = [];
        this.boss = null;
        this.bossActive = false;
        this.ufo = null;
        this.ufoTimer = 0;
        this.flashAlpha = 0;
        this.deathOverlayAlpha = 0;
        this.setupLevel();
        this.createBarriers();
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        // Stars scroll
        this.stars.forEach(s => {
            s.y += s.speed;
            if (s.y > this.canvas.height) { s.y = 0; s.x = Math.random() * this.canvas.width; }
            s.t += 0.02;
        });

        // Screen shake
        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 20);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.4 * (this.screenShake.timer / 20);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.04;

        if (this.state === this.STATE.WAITING) return;

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, (this.deathOverlayAlpha || 0) + 0.012);
            this.updateParticles(dt);
            return;
        }

        if (this.state === this.STATE.LEVEL_UP) {
            this.levelUpTimer = (this.levelUpTimer || 0) + dt;
            if (this.levelUpTimer > 2000) {
                this.levelUpTimer = 0;
                this.state = this.STATE.PLAYING;
                this.wave++;
                this.setupLevel();
                this.createBarriers();
            }
            return;
        }

        // Player input
        this.updatePlayer(timestamp, dt);

        // Enemy movement
        this.updateEnemies(timestamp, dt);

        // Boss
        if (this.bossActive && this.boss) this.updateBoss(timestamp, dt);

        // UFO
        this.updateUFO(timestamp, dt);

        // Bullets
        this.updateBullets(dt);

        // Powerups
        this.updatePowerups(dt);

        // Particles & explosions
        this.updateParticles(dt);

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        // UFO timer
        this.ufoTimer += dt;
        if (this.ufoTimer >= this.ufoInterval && !this.ufo) {
            this.ufoTimer = 0;
            this.spawnUFO();
        }

        // Check level complete
        const aliveEnemies = this.enemies.filter(e => e.alive);
        if (aliveEnemies.length === 0 && !this.bossActive) {
            if (this.level % 5 === 0 && !this.boss) {
                this.spawnBoss();
            } else {
                this.state = this.STATE.LEVEL_UP;
                this.level++;
                this.score += 200 * this.level;
                this.onScore(this.score);
                if (window.audioManager) audioManager.play('levelUp');
            }
        }
    }

    updatePlayer(timestamp, dt) {
        const p = this.player;

        // Keyboard movement
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) p.x -= p.speed;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.x += p.speed;
        p.x = Math.max(p.w / 2, Math.min(this.canvas.width - p.w / 2, p.x));

        // Auto shoot with space
        if ((this.keys[' '] || this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'])) {
            if (p.shootCooldown <= 0) this.shootPlayer();
        }

        if (p.shootCooldown > 0) p.shootCooldown -= dt;
        p.thrusterAnim += 0.2;

        if (p.invincible > 0) p.invincible -= dt;
        if (p.hitTimer > 0) { p.hitTimer -= dt; if (p.hitTimer <= 0) p.hit = false; }
        if (p.shieldTimer > 0) {
            p.shieldTimer -= dt;
            if (p.shieldTimer <= 0) { p.shield = false; p.shieldTimer = 0; }
        }
    }

    updateEnemies(timestamp, dt) {
        // Animate enemies
        this.enemies.forEach(e => {
            e.animTimer += dt;
            if (e.animTimer > 600) { e.animFrame = 1 - e.animFrame; e.animTimer = 0; }
            if (e.hitTimer > 0) { e.hitTimer -= dt; if (e.hitTimer <= 0) e.hit = false; }
            if (e.deathAnim) {
                e.deathTimer += dt;
                if (e.deathTimer > 400) e.alive = false;
            }
        });

        // Move enemies
        this.enemyMoveTimer += dt;
        if (this.enemyMoveTimer >= this.enemyMoveInterval) {
            this.enemyMoveTimer = 0;
            const alive = this.enemies.filter(e => e.alive && !e.deathAnim);
            if (alive.length === 0) return;

            // Speed up as fewer enemies remain
            const speedFactor = 1 + (1 - alive.length / (this.enemies.length || 1)) * 2;
            const moveAmt = 12 * this.enemyDir * speedFactor;

            let hitWall = false;
            alive.forEach(e => {
                if (e.x + moveAmt < e.w / 2 + 8 || e.x + moveAmt > this.canvas.width - e.w / 2 - 8) {
                    hitWall = true;
                }
            });

            if (hitWall) {
                this.enemyDir *= -1;
                alive.forEach(e => { e.y += this.enemyDropDistance; });

                // Check if enemies reached player
                if (alive.some(e => e.y + e.h / 2 >= this.player.y - 30)) {
                    this.killPlayer();
                    return;
                }
            } else {
                alive.forEach(e => { e.x += moveAmt; });
            }

            // Adjust interval based on count
            this.enemyMoveInterval = Math.max(80, (800 - (this.level - 1) * 60) * (alive.length / 30));
        }

        // Enemy shooting
        this.enemyShootTimer += dt;
        if (this.enemyShootTimer >= this.enemyShootInterval) {
            this.enemyShootTimer = 0;
            const alive = this.enemies.filter(e => e.alive && !e.deathAnim);
            if (alive.length === 0) return;

            // Bottom-most in each column shoots
            const cols = {};
            alive.forEach(e => {
                const col = Math.round(e.x / 52);
                if (!cols[col] || e.y > cols[col].y) cols[col] = e;
            });

            const shooters = Object.values(cols);
            const numShooters = Math.min(Math.ceil(this.level / 2) + 1, shooters.length);
            const selectedShooters = shooters.sort(() => Math.random() - 0.5).slice(0, numShooters);

            selectedShooters.forEach(e => {
                this.enemyBullets.push({
                    x: e.x, y: e.y + e.h / 2,
                    w: 3, h: 10,
                    speed: 4 + this.level * 0.3,
                    color: e.color,
                    glow: e.glow,
                    trail: [],
                    type: 'normal'
                });
            });
            if (window.audioManager) audioManager.play('shoot');
        }
    }

    updateBoss(timestamp, dt) {
        const b = this.boss;
        if (!b) return;

        b.anim += dt;
        if (b.hitTimer > 0) { b.hitTimer -= dt; if (b.hitTimer <= 0) b.hit = false; }

        // Movement
        b.x += b.speed * b.dir;
        if (b.x > this.canvas.width - b.w / 2 - 10 || b.x < b.w / 2 + 10) {
            b.dir *= -1;
        }

        // Phase change
        const hpPct = b.hp / b.maxHp;
        if (hpPct < 0.5 && b.phase === 1) {
            b.phase = 2;
            b.speed *= 1.5;
            b.shootInterval = 500;
            this.flashAlpha = 0.3;
            this.flashColor = '#FF0055';
        }
        if (hpPct < 0.25 && b.phase === 2) {
            b.phase = 3;
            b.speed *= 1.3;
            b.shootInterval = 300;
        }

        // Shooting patterns
        b.shootTimer += dt;
        if (b.shootTimer >= b.shootInterval) {
            b.shootTimer = 0;
            b.patternTimer++;
            const pattern = b.patternTimer % 4;

            if (pattern === 0) {
                // Straight down
                this.enemyBullets.push({ x: b.x, y: b.y + b.h / 2, w: 4, h: 14, speed: 5, color: '#FF0055', glow: '#ff4488', trail: [], type: 'boss' });
            } else if (pattern === 1) {
                // Spread
                for (let a = -2; a <= 2; a++) {
                    this.enemyBullets.push({ x: b.x + a * 20, y: b.y + b.h / 2, w: 4, h: 12, speed: 4 + Math.abs(a), color: '#FF8C00', glow: '#ffaa44', trail: [], type: 'boss' });
                }
            } else if (pattern === 2) {
                // Aimed at player
                const dx = this.player.x - b.x;
                const dy = this.player.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const spd = 7;
                this.enemyBullets.push({ x: b.x, y: b.y + b.h / 2, vx: dx / dist * spd, vy: dy / dist * spd, w: 5, h: 5, speed: spd, color: '#b347d9', glow: '#dd88ff', trail: [], type: 'homing' });
            } else {
                // Rapid fire
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (this.boss) this.enemyBullets.push({ x: this.boss.x + (i - 1) * 25, y: this.boss.y + this.boss.h / 2, w: 3, h: 10, speed: 6, color: '#FF006E', glow: '#ff4499', trail: [], type: 'boss' });
                    }, i * 120);
                }
            }
        }
    }

    updateUFO(timestamp, dt) {
        if (!this.ufo) return;
        this.ufo.x += this.ufo.speed;
        this.ufo.anim += dt;

        if (this.ufo.x > this.canvas.width + 50) {
            this.ufo = null;
        }

        // Check player bullet collision
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            if (Math.abs(b.x - this.ufo.x) < 30 && Math.abs(b.y - this.ufo.y) < 20) {
                const pts = this.ufo.points;
                this.score += pts;
                this.onScore(this.score);
                this.spawnExplosion(this.ufo.x, this.ufo.y, '#FF006E', 20);
                this.scorePopups.push({ x: this.ufo.x, y: this.ufo.y - 20, text: `🛸 +${pts}!`, color: '#FF006E', life: 1500, opacity: 1 });
                this.playerBullets.splice(i, 1);
                this.ufo = null;
                this.screenShake.timer = 8;
                this.screenShake.intensity = 4;
                if (window.audioManager) audioManager.play('levelUp');
                break;
            }
        }
    }

    updateBullets(dt) {
        // Player bullets
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i];
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 6) b.trail.shift();
            b.y -= b.speed;

            if (b.y < -20) { this.playerBullets.splice(i, 1); continue; }

            let hit = false;

            // Hit boss
            if (this.bossActive && this.boss) {
                if (Math.abs(b.x - this.boss.x) < this.boss.w / 2 &&
                    Math.abs(b.y - this.boss.y) < this.boss.h / 2) {
                    this.boss.hp--;
                    this.boss.hit = true;
                    this.boss.hitTimer = 150;
                    this.spawnParticles(b.x, b.y, '#FF0055', 5);
                    this.playerBullets.splice(i, 1);
                    this.score += 5;
                    this.onScore(this.score);

                    if (this.boss.hp <= 0) {
                        this.killBoss();
                    }
                    hit = true;
                }
            }
            if (hit) continue;

            // Hit enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                if (!e.alive || e.deathAnim) continue;
                if (Math.abs(b.x - e.x) < e.w / 2 + 2 && Math.abs(b.y - e.y) < e.h / 2 + 2) {
                    e.hp--;
                    e.hit = true;
                    e.hitTimer = 150;
                    this.spawnParticles(b.x, b.y, e.color, 5);

                    if (e.hp <= 0) {
                        e.deathAnim = true;
                        e.deathTimer = 0;
                        this.spawnExplosion(e.x, e.y, e.color, 15);
                        this.score += e.points;
                        this.onScore(this.score);
                        if (this.score > this.bestScore) {
                            this.bestScore = this.score;
                            localStorage.setItem('space_best', this.bestScore);
                        }
                        this.scorePopups.push({ x: e.x, y: e.y, text: `+${e.points}`, color: e.color, life: 800, opacity: 1 });

                        // Powerup drop
                        if (Math.random() < 0.12) this.dropPowerup(e.x, e.y);
                        if (window.audioManager) audioManager.play('pop');
                    }
                    this.playerBullets.splice(i, 1);
                    hit = true;
                    break;
                }
            }
            if (hit) continue;

            // Hit barriers
            for (const barrier of this.barriers) {
                for (let k = barrier.blocks.length - 1; k >= 0; k--) {
                    const bl = barrier.blocks[k];
                    if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
                        bl.hp--;
                        if (bl.hp <= 0) barrier.blocks.splice(k, 1);
                        this.playerBullets.splice(i, 1);
                        this.spawnParticles(b.x, b.y, '#44aa44', 3);
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }
        }

        // Enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 5) b.trail.shift();

            if (b.vx !== undefined) {
                b.x += b.vx;
                b.y += b.vy;
            } else {
                b.y += b.speed;
            }

            if (b.y > this.canvas.height + 20 || b.x < -20 || b.x > this.canvas.width + 20) {
                this.enemyBullets.splice(i, 1);
                continue;
            }

            let hit = false;

            // Hit barriers
            for (const barrier of this.barriers) {
                for (let k = barrier.blocks.length - 1; k >= 0; k--) {
                    const bl = barrier.blocks[k];
                    if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
                        bl.hp--;
                        if (bl.hp <= 0) barrier.blocks.splice(k, 1);
                        this.enemyBullets.splice(i, 1);
                        hit = true;
                        break;
                    }
                }
                if (hit) break;
            }
            if (hit) continue;

            // Hit player
            if (this.player.invincible <= 0) {
                if (Math.abs(b.x - this.player.x) < this.player.w / 2 - 4 &&
                    Math.abs(b.y - this.player.y) < this.player.h / 2) {
                    this.enemyBullets.splice(i, 1);
                    if (this.player.shield) {
                        this.player.shield = false;
                        this.player.shieldTimer = 0;
                        this.spawnExplosion(b.x, b.y, '#00d4ff', 10);
                        this.flashAlpha = 0.25;
                        this.flashColor = '#00d4ff';
                    } else {
                        this.killPlayer();
                    }
                }
            }
        }
    }

    updatePowerups(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += 1;
            p.pulse = (p.pulse || 0) + 0.06;

            if (p.y > this.canvas.height + 30) { this.powerups.splice(i, 1); continue; }

            if (Math.abs(p.x - this.player.x) < 20 && Math.abs(p.y - this.player.y) < 20) {
                this.applyPowerup(p);
                this.powerups.splice(i, 1);
            }
        }
    }

    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.1; p.vx *= 0.97;
            p.life -= p.decay;
            p.size *= 0.96;
            return p.life > 0 && p.size > 0.3;
        });

        this.explosions = this.explosions.filter(e => {
            e.radius += 3;
            e.opacity -= 0.05;
            e.rings = e.rings.map(r => ({ ...r, radius: r.radius + 2.5, opacity: r.opacity - 0.06 })).filter(r => r.opacity > 0);
            return e.opacity > 0;
        });
    }

    killPlayer() {
        this.player.lives--;
        this.player.hit = true;
        this.player.hitTimer = 300;
        this.player.invincible = 2000;

        this.spawnExplosion(this.player.x, this.player.y, '#00D4FF', 20);
        this.screenShake.timer = 20;
        this.screenShake.intensity = 14;
        this.flashAlpha = 0.6;
        this.flashColor = '#ffffff';

        if (window.audioManager) audioManager.play('fail');

        if (this.player.lives <= 0) {
            this.gameOver = true;
            this.state = this.STATE.DEAD;
            this.deathOverlayAlpha = 0;
            setTimeout(() => this.onScore(this.score, true), 1500);
            if (window.audioManager) audioManager.play('gameOver');
        }
    }

    killBoss() {
        this.spawnExplosion(this.boss.x, this.boss.y, '#FF0055', 30);
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.boss) return;
                this.spawnExplosion(
                    this.boss.x + (Math.random() - 0.5) * 80,
                    this.boss.y + (Math.random() - 0.5) * 40,
                    ['#FF0055', '#FF8C00', '#FFD700'][Math.floor(Math.random() * 3)],
                    15
                );
            }, i * 150);
        }

        this.score += 500 * this.level;
        this.onScore(this.score);
        this.scorePopups.push({ x: this.boss.x, y: this.boss.y - 30, text: `👹 BOSS DOWN! +${500 * this.level}`, color: '#FFD700', life: 2000, opacity: 1 });

        this.boss = null;
        this.bossActive = false;
        this.screenShake.timer = 25;
        this.screenShake.intensity = 16;
        this.flashAlpha = 0.5;
        this.flashColor = '#FFD700';

        this.state = this.STATE.LEVEL_UP;
        this.level++;
        if (window.audioManager) audioManager.play('levelUp');
    }

    dropPowerup(x, y) {
        const types = [
            { type: 'shield', color: '#00D4FF', emoji: '🛡', label: 'SHIELD' },
            { type: 'rapidfire', color: '#FFD700', emoji: '⚡', label: 'RAPID' },
            { type: 'life', color: '#FF006E', emoji: '❤️', label: '+LIFE' }
        ];
        const t = types[Math.floor(Math.random() * types.length)];
        this.powerups.push({ x, y, ...t, pulse: 0 });
    }

    applyPowerup(p) {
        if (p.type === 'shield') {
            this.player.shield = true;
            this.player.shieldTimer = 8000;
        } else if (p.type === 'rapidfire') {
            this.player.shootRate = 120;
            setTimeout(() => { if (this.player) this.player.shootRate = 280; }, 5000);
        } else if (p.type === 'life') {
            this.player.lives = Math.min(this.player.lives + 1, 5);
        }

        this.spawnParticles(p.x, p.y, p.color, 15);
        this.scorePopups.push({ x: p.x, y: p.y, text: `${p.emoji} ${p.label}!`, color: p.color, life: 1200, opacity: 1 });
        this.flashAlpha = 0.15;
        this.flashColor = p.color;
        if (window.audioManager) audioManager.play('powerup');
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 1,
                life: 1, decay: 0.04,
                color
            });
        }
    }

    spawnExplosion(x, y, color, size) {
        this.explosions.push({
            x, y, radius: 5, opacity: 1, color, size,
            rings: [
                { radius: 5, opacity: 0.8 },
                { radius: 10, opacity: 0.5 }
            ]
        });
        this.spawnParticles(x, y, color, size);
        for (let i = 0; i < Math.floor(size / 3); i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 2,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.025,
                color: '#fff'
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
        this.drawNebulas();
        this.drawBarriers();
        this.drawEnemies(timestamp);
        if (this.bossActive && this.boss) this.drawBoss(timestamp);
        if (this.ufo) this.drawUFO(timestamp);
        this.drawPowerups(timestamp);
        this.drawExplosions();
        this.drawParticlesD();
        this.drawBullets();
        this.drawPlayer(timestamp);
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
        ctx.fillStyle = '#03030f';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.stars.forEach(s => {
            const a = 0.3 + Math.sin(s.t) * 0.3;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawNebulas() {
        const ctx = this.ctx;
        this.nebulas.forEach(n => {
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            grad.addColorStop(0, n.color.replace(')', `,${n.alpha})`).replace('rgb', 'rgba'));
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawBarriers() {
        const ctx = this.ctx;
        this.barriers.forEach(barrier => {
            barrier.blocks.forEach(bl => {
                const hpPct = bl.hp / bl.maxHp;
                const alpha = 0.4 + hpPct * 0.6;
                ctx.fillStyle = `rgba(68,170,68,${alpha})`;
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#44aa44';
                ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
                ctx.shadowBlur = 0;

                // Damage cracks
                if (hpPct < 0.5) {
                    ctx.strokeStyle = `rgba(0,0,0,${1 - hpPct})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(bl.x + 2, bl.y + 2);
                    ctx.lineTo(bl.x + bl.w - 2, bl.y + bl.h - 2);
                    ctx.stroke();
                }
            });
        });
    }

    drawEnemies(timestamp) {
        const ctx = this.ctx;
        this.enemies.forEach(e => {
            if (!e.alive && !e.deathAnim) return;

            ctx.save();
            ctx.translate(e.x, e.y);

            if (e.deathAnim) {
                const prog = e.deathTimer / 400;
                ctx.globalAlpha = 1 - prog;
                ctx.scale(1 + prog * 0.5, 1 + prog * 0.5);
            }

            if (e.hit) {
                ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.5;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = e.glow;

            // Draw enemy based on type
            this.drawEnemyShape(ctx, e, timestamp);

            // HP bar (for multi-hp enemies)
            if (e.maxHp > 1) {
                const bw = e.w;
                const hpPct = e.hp / e.maxHp;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-bw / 2, e.h / 2 + 2, bw, 4);
                ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#FFD700' : '#FF0055';
                ctx.fillRect(-bw / 2, e.h / 2 + 2, bw * hpPct, 4);
            }

            ctx.restore();
        });
    }

    drawEnemyShape(ctx, e, timestamp) {
        const frame = e.animFrame;
        const anim = Math.sin(timestamp / 400 + e.x) * 2;

        if (e.type === 0) {
            // Small - Octopus style
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.ellipse(0, -4 + anim * 0.3, 12, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tentacles
            for (let t = -2; t <= 2; t++) {
                ctx.beginPath();
                ctx.moveTo(t * 5, 4);
                ctx.quadraticCurveTo(t * 5 + (frame ? 3 : -3), 10, t * 5 + (frame ? -2 : 2), 13);
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-4, -4, 3, 0, Math.PI * 2);
            ctx.arc(4, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-4 + frame, -4, 1.5, 0, Math.PI * 2);
            ctx.arc(4 + frame, -4, 1.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (e.type === 1) {
            // Medium - Crab style
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            // Claws
            const clawY = frame ? 3 : -3;
            ctx.beginPath();
            ctx.ellipse(-16, clawY, 6, 4, 0.3, 0, Math.PI * 2);
            ctx.ellipse(16, clawY, 6, 4, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // Arms
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-16, clawY);
            ctx.moveTo(10, 0);
            ctx.lineTo(16, clawY);
            ctx.stroke();
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-6, -3, 4, 0, Math.PI * 2);
            ctx.arc(6, -3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-6, -3, 2, 0, Math.PI * 2);
            ctx.arc(6, -3, 2, 0, Math.PI * 2);
            ctx.fill();

        } else {
            // Large - UFO alien style
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.ellipse(0, 2, 16, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            // Dome
            ctx.fillStyle = this.lightenColor(e.color, 40);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.ellipse(0, -4, 10, 8, 0, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Lights
            const lights = ['-8,4', '0,6', '8,4'];
            lights.forEach((l, i) => {
                const [lx, ly] = l.split(',').map(Number);
                ctx.fillStyle = i === frame ? '#FFD700' : 'rgba(255,215,0,0.3)';
                ctx.beginPath();
                ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });
            // Arms
            const armY = frame ? 6 : 2;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-14, armY);
            ctx.lineTo(-20, armY + 5);
            ctx.moveTo(14, armY);
            ctx.lineTo(20, armY + 5);
            ctx.stroke();
        }
    }

    drawBoss(timestamp) {
        const ctx = this.ctx;
        const b = this.boss;

        ctx.save();
        ctx.translate(b.x, b.y);

        if (b.hit) ctx.globalAlpha = 0.6;

        // Phase glow
        const phaseColors = { 1: '#FF0055', 2: '#FF8C00', 3: '#FFD700' };
        ctx.shadowBlur = 25 + Math.sin(timestamp / 200) * 10;
        ctx.shadowColor = phaseColors[b.phase];

        // Body
        const bodyGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, b.w / 2);
        bodyGrad.addColorStop(0, '#660020');
        bodyGrad.addColorStop(0.5, '#330010');
        bodyGrad.addColorStop(1, '#110005');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring
        ctx.strokeStyle = phaseColors[b.phase];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner details
        ctx.strokeStyle = `rgba(255,0,85,0.4)`;
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, b.w / 2 * (i / 3.5), b.h / 2 * (i / 3.5), b.anim * 0.001, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Eye
        ctx.fillStyle = phaseColors[b.phase];
        ctx.shadowBlur = 15;
        ctx.shadowColor = phaseColors[b.phase];
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(3, -3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cannons
        const cannonPositions = [-30, 0, 30];
        cannonPositions.forEach(cx => {
            ctx.fillStyle = '#440015';
            ctx.fillRect(cx - 5, b.h / 2 - 5, 10, 18);
            ctx.fillStyle = phaseColors[b.phase];
            ctx.fillRect(cx - 3, b.h / 2 + 5, 6, 8);
        });

        // HP Bar
        const bw = b.w + 20;
        const hpPct = b.hp / b.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(-bw / 2, -b.h / 2 - 18, bw, 10);
        const hpGrad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        hpGrad.addColorStop(0, '#FF0055');
        hpGrad.addColorStop(0.5, '#FF8C00');
        hpGrad.addColorStop(1, '#FFD700');
        ctx.fillStyle = hpGrad;
        ctx.fillRect(-bw / 2, -b.h / 2 - 18, bw * hpPct, 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-bw / 2, -b.h / 2 - 18, bw, 10);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS  ${b.hp}/${b.maxHp}`, 0, -b.h / 2 - 10);

        ctx.restore();
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawUFO(timestamp) {
        const ctx = this.ctx;
        const u = this.ufo;

        ctx.save();
        ctx.translate(u.x, u.y);

        ctx.shadowBlur = 12;
        ctx.shadowColor = u.color;

        // Saucer
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.ellipse(0, 4, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome
        ctx.fillStyle = '#ffaacc';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, -2, 16, 12, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Lights
        const lightColors = ['#FFD700', '#00FF88', '#00D4FF', '#FF006E'];
        for (let i = 0; i < 5; i++) {
            const lx = -20 + i * 10;
            const active = Math.floor(u.anim / 200) % 5 === i;
            ctx.fillStyle = active ? lightColors[i % 4] : 'rgba(100,100,100,0.3)';
            ctx.beginPath();
            ctx.arc(lx, 8, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Points label
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(u.points, 0, -18);

        ctx.restore();
        ctx.textAlign = 'left';
    }

    drawPowerups(timestamp) {
        const ctx = this.ctx;
        this.powerups.forEach(p => {
            const pulse = 0.9 + Math.sin(p.pulse) * 0.1;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-12, -12, 24, 24, 6);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font = '16px serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.emoji, 0, 6);

            ctx.restore();
        });
        ctx.textAlign = 'left';
    }

    drawBullets() {
        const ctx = this.ctx;

        // Player bullets
        this.playerBullets.forEach(b => {
            // Trail
            b.trail.forEach((t, i) => {
                ctx.globalAlpha = (i / b.trail.length) * 0.4;
                ctx.fillStyle = b.color;
                ctx.fillRect(t.x - b.w / 2, t.y, b.w * 0.7, b.h * 0.7);
            });
            ctx.globalAlpha = 1;

            ctx.shadowBlur = 10;
            ctx.shadowColor = b.glow;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);

            // Bright tip
            ctx.fillStyle = '#fff';
            ctx.fillRect(b.x - 1, b.y, 2, 4);
            ctx.shadowBlur = 0;
        });

        // Enemy bullets
        this.enemyBullets.forEach(b => {
            b.trail.forEach((t, i) => {
                ctx.globalAlpha = (i / b.trail.length) * 0.3;
                ctx.fillStyle = b.color;
                ctx.fillRect(t.x - (b.w || 3) / 2, t.y, b.w || 3, (b.h || 10) * 0.7);
            });
            ctx.globalAlpha = 1;

            ctx.shadowBlur = 8;
            ctx.shadowColor = b.glow;
            ctx.fillStyle = b.color;

            if (b.type === 'homing') {
                ctx.beginPath();
                ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(b.x - (b.w || 3) / 2, b.y, b.w || 3, b.h || 10);
            }
            ctx.shadowBlur = 0;
        });
    }

    drawPlayer(timestamp) {
        const ctx = this.ctx;
        const p = this.player;

        if (p.invincible > 0 && Math.floor(p.invincible / 100) % 2 === 0) return;

        ctx.save();
        ctx.translate(p.x, p.y);

        // Shield bubble
        if (p.shield) {
            const sp = 0.6 + Math.sin(timestamp / 150) * 0.4;
            ctx.strokeStyle = `rgba(0,212,255,${sp})`;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00d4ff';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(0,212,255,${sp * 0.08})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Thruster flame
        const flameH = 12 + Math.sin(p.thrusterAnim * 3) * 5;
        const flameGrad = ctx.createLinearGradient(0, 10, 0, 10 + flameH);
        flameGrad.addColorStop(0, '#FF8C00');
        flameGrad.addColorStop(0.5, '#FF4400');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-8, 10);
        ctx.lineTo(0, 10 + flameH);
        ctx.lineTo(8, 10);
        ctx.closePath();
        ctx.fill();

        // Side thrusters
        const sflameH = flameH * 0.6;
        ctx.beginPath();
        ctx.moveTo(-20, 8);
        ctx.lineTo(-16, 8 + sflameH);
        ctx.lineTo(-12, 8);
        ctx.closePath();
        ctx.moveTo(12, 8);
        ctx.lineTo(16, 8 + sflameH);
        ctx.lineTo(20, 8);
        ctx.closePath();
        ctx.fillStyle = '#FF6600';
        ctx.fill();

        // Ship glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00D4FF';

        // Main body
        const bodyGrad = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
        bodyGrad.addColorStop(0, '#00D4FF');
        bodyGrad.addColorStop(0.4, '#0088CC');
        bodyGrad.addColorStop(1, '#004488');
        ctx.fillStyle = bodyGrad;

        // Ship shape
        ctx.beginPath();
        ctx.moveTo(0, -p.h / 2);
        ctx.lineTo(-p.w * 0.25, 0);
        ctx.lineTo(-p.w / 2, p.h / 2);
        ctx.lineTo(p.w / 2, p.h / 2);
        ctx.lineTo(p.w * 0.25, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Wings
        ctx.fillStyle = '#005588';
        ctx.beginPath();
        ctx.moveTo(-p.w * 0.25, 0);
        ctx.lineTo(-p.w / 2, p.h / 2);
        ctx.lineTo(-p.w / 2 - 12, p.h / 2 - 5);
        ctx.lineTo(-p.w * 0.35, -2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.w * 0.25, 0);
        ctx.lineTo(p.w / 2, p.h / 2);
        ctx.lineTo(p.w / 2 + 12, p.h / 2 - 5);
        ctx.lineTo(p.w * 0.35, -2);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        const cockGrad = ctx.createRadialGradient(0, -5, 2, 0, -5, 10);
        cockGrad.addColorStop(0, '#88ffff');
        cockGrad.addColorStop(0.5, '#00aacc');
        cockGrad.addColorStop(1, '#004466');
        ctx.fillStyle = cockGrad;
        ctx.beginPath();
        ctx.ellipse(0, -5, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(-2, -8, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Cannons
        ctx.fillStyle = '#003355';
        ctx.fillRect(-p.w / 2 - 4, -2, 6, 12);
        ctx.fillRect(p.w / 2 - 2, -2, 6, 12);
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(-p.w / 2 - 3, 4, 4, 5);
        ctx.fillRect(p.w / 2 - 1, 4, 4, 5);

        ctx.restore();
    }

    drawExplosions() {
        const ctx = this.ctx;
        this.explosions.forEach(e => {
            ctx.shadowBlur = 12;
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = e.opacity;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();

            e.rings.forEach(r => {
                ctx.globalAlpha = r.opacity;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(e.x, e.y, r.radius, 0, Math.PI * 2);
                ctx.stroke();
            });
        });
        ctx.globalAlpha = 1;
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

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, 38);

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00D4FF';
        ctx.fillText(`${this.score}`, 12, 24);
        ctx.shadowBlur = 0;

        // Best
        ctx.fillStyle = 'rgba(255,215,0,0.6)';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`BEST: ${this.bestScore}`, 12, 36);

        // Level & Wave
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LEVEL ${this.level}`, W / 2, 22);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#666';
        ctx.font = '10px Rajdhani';
        ctx.fillText(`WAVE ${this.wave}`, W / 2, 34);

        // Lives
        ctx.textAlign = 'right';
        for (let i = 0; i < 5; i++) {
            if (i < this.player.lives) {
                ctx.fillStyle = '#FF006E';
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#FF006E';
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.shadowBlur = 0;
            }
            ctx.font = '14px serif';
            ctx.fillText('🚀', W - 14 - i * 22, 24);
        }
        ctx.shadowBlur = 0;

        // Enemy count
        const alive = this.enemies.filter(e => e.alive && !e.deathAnim).length;
        if (!this.bossActive && alive > 0) {
            ctx.fillStyle = 'rgba(255,100,100,0.5)';
            ctx.font = '11px Rajdhani';
            ctx.textAlign = 'right';
            ctx.fillText(`👾 ${alive}`, W - 10, 36);
        }

        // Shield bar
        if (this.player.shield) {
            const pct = this.player.shieldTimer / 8000;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(8, 42, 80, 8, 4);
            ctx.fill();
            ctx.fillStyle = '#00D4FF';
            ctx.beginPath();
            ctx.roundRect(8, 42, 80 * pct, 8, 4);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '8px Rajdhani';
            ctx.textAlign = 'left';
            ctx.fillText('🛡 SHIELD', 10, 50);
        }

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawWaiting(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(cx - 145, cy - 55, 290, 100, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,71,217,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 26px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00D4FF';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00D4FF';
        ctx.fillText('SPACE INVADERS', cx, cy - 14);
        ctx.shadowBlur = 0;

        const bob = Math.sin(timestamp / 400) * 4;
        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Click / Touch to Start', cx, cy + 20 + bob);
        ctx.font = '11px Rajdhani';
        ctx.fillStyle = '#666';
        ctx.fillText('Arrow Keys / WASD  •  Space to Shoot', cx, cy + 38);
        ctx.textAlign = 'left';
    }

    drawLevelUp(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const prog = Math.min(1, (this.levelUpTimer || 0) / 2000);

        ctx.fillStyle = `rgba(0,0,0,${prog * 0.6})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.globalAlpha = prog;
        ctx.font = 'bold 32px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF88';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FF88';
        ctx.fillText('WAVE CLEAR!', cx, cy - 20);
        ctx.shadowBlur = 0;
        ctx.font = '18px Rajdhani';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Level ${this.level} incoming...`, cx, cy + 20);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawDeathScreen(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const alpha = this.deathOverlayAlpha || 0;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.5) return;
        const pa = (alpha - 0.5) / 0.5;
        ctx.globalAlpha = pa;

        const pw = Math.min(this.canvas.width - 40, 300);
        const ph = 230;

        ctx.fillStyle = 'rgba(5,3,15,0.97)';
        ctx.strokeStyle = 'rgba(255,0,85,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0055';
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
        ctx.moveTo(cx - pw / 2 + 20, cy - ph / 2 + 68);
        ctx.lineTo(cx + pw / 2 - 20, cy - ph / 2 + 68);
        ctx.stroke();

        const rows = [
            { label: 'SCORE', val: this.score, color: '#fff' },
            { label: 'BEST', val: this.bestScore, color: this.score >= this.bestScore ? '#FFD700' : '#fff' },
            { label: 'LEVEL', val: this.level, color: '#b347d9' },
            { label: 'WAVE', val: this.wave, color: '#00D4FF' }
        ];

        rows.forEach((r, i) => {
            const ry = cy - ph / 2 + 100 + i * 30;
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
        const b = Math.max(0, parseInt(color.slice(5, 7), 16) + amt);
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
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 55;
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    }
}