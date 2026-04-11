/* ============================================
   NEON SNAKE - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class SnakeNeon {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('snake_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Grid
        this.CELL = 22;
        this.COLS = Math.floor(canvas.width / this.CELL);
        this.ROWS = Math.floor((canvas.height - 60) / this.CELL);
        this.offsetX = Math.floor((canvas.width - this.COLS * this.CELL) / 2);
        this.offsetY = 50;

        // Game State
        this.STATE = { WAITING: 0, PLAYING: 1, DEAD: 2 };
        this.state = this.STATE.WAITING;

        // Snake
        this.snake = [];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.dirQueue = [];

        // Food
        this.food = [];
        this.bonusFood = null;
        this.bonusFoodTimer = 0;
        this.bonusFoodDuration = 8000;

        // Power ups
        this.powerups = [];
        this.activeEffects = {
            speed: { active: false, timer: 0, duration: 5000 },
            ghost: { active: false, timer: 0, duration: 4000 },
            magnet: { active: false, timer: 0, duration: 6000 },
            double: { active: false, timer: 0, duration: 7000 }
        };

        // Speed
        this.baseSpeed = 130;
        this.speed = this.baseSpeed;
        this.lastMoveTime = 0;

        // Visual
        this.particles = [];
        this.scorePopups = [];
        this.gridFlash = [];
        this.deathAnim = { active: false, progress: 0, pieces: [] };
        this.eatAnim = { active: false, timer: 0, x: 0, y: 0, color: '' };
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';

        // Background
        this.bgTime = 0;
        this.stars = Array.from({ length: 50 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.5 + 0.3,
            t: Math.random() * Math.PI * 2
        }));

        // Walls (obstacles from level 3)
        this.walls = [];

        // Level
        this.level = 1;
        this.foodEaten = 0;
        this.foodPerLevel = 8;
        this.deathOverlayAlpha = 0;
        this.levelUpAnim = { active: false, timer: 0 };

        // Combo
        this.combo = 0;
        this.comboTimer = 0;
        this.comboDisplay = { scale: 1, opacity: 0 };

        this.initGame();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== INIT ====================

    initGame() {
        const startX = Math.floor(this.COLS / 2);
        const startY = Math.floor(this.ROWS / 2);
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.dirQueue = [];
        this.food = [];
        this.bonusFood = null;
        this.bonusFoodTimer = 0;
        this.powerups = [];
        this.walls = [];
        this.particles = [];
        this.scorePopups = [];
        this.combo = 0;
        this.comboTimer = 0;
        this.spawnFood();
        this.spawnFood();
    }

    spawnFood() {
        let pos;
        let tries = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * this.COLS),
                y: Math.floor(Math.random() * this.ROWS)
            };
            tries++;
        } while (
            (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
            this.food.some(f => f.x === pos.x && f.y === pos.y) ||
            this.walls.some(w => w.x === pos.x && w.y === pos.y)) &&
            tries < 100
        );

        const types = ['normal', 'normal', 'normal', 'bonus', 'super'];
        const type = types[Math.floor(Math.random() * types.length)];
        const foodColors = {
            normal: { color: '#FF006E', glow: '#ff4499', points: 10, emoji: '🍎' },
            bonus: { color: '#FFD700', glow: '#FFE44D', points: 25, emoji: '⭐' },
            super: { color: '#00FF88', glow: '#44FFaa', points: 50, emoji: '💎' }
        };

        const fd = foodColors[type];
        this.food.push({
            x: pos.x,
            y: pos.y,
            type,
            color: fd.color,
            glow: fd.glow,
            points: fd.points,
            emoji: fd.emoji,
            pulse: Math.random() * Math.PI * 2,
            scale: 0,
            rotation: 0
        });
    }

    spawnBonusFood() {
        let pos;
        let tries = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * this.COLS),
                y: Math.floor(Math.random() * this.ROWS)
            };
            tries++;
        } while (
            (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
            this.food.some(f => f.x === pos.x && f.y === pos.y)) &&
            tries < 100
        );
        this.bonusFood = {
            x: pos.x, y: pos.y,
            color: '#b347d9', glow: '#dd88ff',
            points: 100, pulse: 0,
            timer: this.bonusFoodDuration,
            scale: 0
        };
        this.bonusFoodTimer = this.bonusFoodDuration;
    }

    spawnPowerup() {
        if (this.powerups.length >= 2) return;
        let pos;
        let tries = 0;
        do {
            pos = { x: Math.floor(Math.random() * this.COLS), y: Math.floor(Math.random() * this.ROWS) };
            tries++;
        } while (
            (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
            this.food.some(f => f.x === pos.x && f.y === pos.y)) && tries < 100
        );

        const types = ['speed', 'ghost', 'magnet', 'double'];
        const type = types[Math.floor(Math.random() * types.length)];
        const info = {
            speed: { color: '#FF8C00', emoji: '⚡', label: 'SPEED' },
            ghost: { color: '#00D4FF', emoji: '👻', label: 'GHOST' },
            magnet: { color: '#FF006E', emoji: '🧲', label: 'MAGNET' },
            double: { color: '#FFD700', emoji: '×2', label: 'DOUBLE' }
        };
        this.powerups.push({
            x: pos.x, y: pos.y, type,
            ...info[type],
            scale: 0, pulse: 0,
            life: 10000
        });
    }

    spawnWalls() {
        if (this.level < 3) return;
        const wallCount = Math.min((this.level - 2) * 2, 10);
        this.walls = [];
        for (let i = 0; i < wallCount; i++) {
            let pos;
            let tries = 0;
            do {
                pos = { x: Math.floor(Math.random() * this.COLS), y: Math.floor(Math.random() * this.ROWS) };
                tries++;
            } while (
                (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
                this.food.some(f => f.x === pos.x && f.y === pos.y) ||
                this.walls.some(w => w.x === pos.x && w.y === pos.y)) &&
                tries < 100
            );
            this.walls.push({ x: pos.x, y: pos.y, pulse: Math.random() * Math.PI * 2 });
        }
    }

    // ==================== EVENTS ====================

    bindEvents() {
        this.boundKey = this.handleKey.bind(this);
        document.addEventListener('keydown', this.boundKey);

        // Touch swipe
        this.touchStart = null;
        this.boundTouchStart = (e) => {
            e.preventDefault();
            this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            if (this.state === this.STATE.WAITING) this.startGame();
        };
        this.boundTouchEnd = (e) => {
            e.preventDefault();
            if (!this.touchStart) return;
            const dx = e.changedTouches[0].clientX - this.touchStart.x;
            const dy = e.changedTouches[0].clientY - this.touchStart.y;
            if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
                if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) this.restartGame();
                return;
            }
            if (Math.abs(dx) > Math.abs(dy)) {
                this.queueDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
            } else {
                this.queueDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
            }
            this.touchStart = null;
        };
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    }

    handleKey(e) {
        const keyMap = {
            'ArrowUp': { x: 0, y: -1 }, 'w': { x: 0, y: -1 }, 'W': { x: 0, y: -1 },
            'ArrowDown': { x: 0, y: 1 }, 's': { x: 0, y: 1 }, 'S': { x: 0, y: 1 },
            'ArrowLeft': { x: -1, y: 0 }, 'a': { x: -1, y: 0 }, 'A': { x: -1, y: 0 },
            'ArrowRight': { x: 1, y: 0 }, 'd': { x: 1, y: 0 }, 'D': { x: 1, y: 0 }
        };
        if (keyMap[e.key]) {
            e.preventDefault();
            this.queueDir(keyMap[e.key]);
            if (this.state === this.STATE.WAITING) this.startGame();
        }
        if (e.key === 'Enter' && this.state === this.STATE.DEAD) this.restartGame();
    }

    queueDir(newDir) {
        const last = this.dirQueue.length > 0
            ? this.dirQueue[this.dirQueue.length - 1]
            : this.dir;
        if (newDir.x === -last.x && newDir.y === 0) return;
        if (newDir.y === -last.y && newDir.x === 0) return;
        if (newDir.x === last.x && newDir.y === last.y) return;
        if (this.dirQueue.length < 2) this.dirQueue.push(newDir);
    }

    startGame() {
        this.state = this.STATE.PLAYING;
        this.lastMoveTime = performance.now();
    }

    restartGame() {
        this.score = 0;
        this.onScore(0);
        this.state = this.STATE.WAITING;
        this.gameOver = false;
        this.level = 1;
        this.foodEaten = 0;
        this.speed = this.baseSpeed;
        this.deathOverlayAlpha = 0;
        this.deathAnim = { active: false, progress: 0, pieces: [] };
        Object.keys(this.activeEffects).forEach(k => {
            this.activeEffects[k].active = false;
            this.activeEffects[k].timer = 0;
        });
        this.initGame();
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.t += 0.02);

        // Screen shake
        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 15);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.5 * (this.screenShake.timer / 15);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.05;

        // Animate food
        this.food.forEach(f => {
            f.pulse += 0.06;
            f.scale = Math.min(1, f.scale + 0.08);
            f.rotation += 0.02;
        });

        // Animate bonus food
        if (this.bonusFood) {
            this.bonusFood.pulse += 0.1;
            this.bonusFood.scale = Math.min(1, this.bonusFood.scale + 0.08);
            this.bonusFoodTimer -= dt;
            if (this.bonusFoodTimer <= 0) this.bonusFood = null;
        }

        // Animate powerups
        this.powerups.forEach(p => {
            p.pulse += 0.06;
            p.scale = Math.min(1, p.scale + 0.08);
            p.life -= dt;
        });
        this.powerups = this.powerups.filter(p => p.life > 0);

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            this.comboDisplay.opacity = Math.min(1, this.comboTimer / 500);
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.comboDisplay.opacity = 0;
            }
        }

        // Level up anim
        if (this.levelUpAnim.active) {
            this.levelUpAnim.timer -= dt;
            if (this.levelUpAnim.timer <= 0) this.levelUpAnim.active = false;
        }

        // Eat anim
        if (this.eatAnim.active) {
            this.eatAnim.timer -= dt;
            if (this.eatAnim.timer <= 0) this.eatAnim.active = false;
        }

        // Update active effects
        Object.keys(this.activeEffects).forEach(key => {
            const ef = this.activeEffects[key];
            if (ef.active) {
                ef.timer -= dt;
                if (ef.timer <= 0) { ef.active = false; ef.timer = 0; }
            }
        });

        // Update speed
        const speedEffect = this.activeEffects.speed.active ? 0.6 : 1;
        this.speed = Math.max(60, this.baseSpeed - (this.level - 1) * 10) * speedEffect;

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += p.gravity || 0;
            p.vx *= 0.97; p.vy *= 0.99;
            p.life -= p.decay;
            p.size *= 0.96;
            return p.life > 0 && p.size > 0.3;
        });

        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        if (this.state === this.STATE.WAITING) return;

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.015);
            if (this.deathAnim.active) {
                this.deathAnim.progress = Math.min(1, this.deathAnim.progress + 0.03);
                this.deathAnim.pieces.forEach(p => {
                    p.x += p.vx; p.y += p.vy;
                    p.vy += 0.3; p.vx *= 0.98;
                    p.rotation += p.rotSpeed;
                    p.life -= 0.02;
                });
            }
            return;
        }

        // Magnet effect
        if (this.activeEffects.magnet.active) {
            const head = this.snake[0];
            this.food.forEach(f => {
                const fx = this.offsetX + f.x * this.CELL + this.CELL / 2;
                const fy = this.offsetY + f.y * this.CELL + this.CELL / 2;
                const hx = this.offsetX + head.x * this.CELL + this.CELL / 2;
                const hy = this.offsetY + head.y * this.CELL + this.CELL / 2;
                const dx = hx - fx; const dy = hy - fy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120 && dist > 5) {
                    const pull = 0.04;
                    const nx = f.x + (dx / dist) * pull;
                    const ny = f.y + (dy / dist) * pull;
                    f.x = Math.max(0, Math.min(this.COLS - 1, nx));
                    f.y = Math.max(0, Math.min(this.ROWS - 1, ny));
                }
            });
        }

        // Move snake
        if (timestamp - this.lastMoveTime >= this.speed) {
            this.lastMoveTime = timestamp;
            this.moveSnake(timestamp);
        }
    }

    moveSnake(timestamp) {
        // Apply queued direction
        if (this.dirQueue.length > 0) {
            this.dir = this.dirQueue.shift();
        }

        const head = this.snake[0];
        let newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

        // Wall wrap or collision
        if (this.activeEffects.ghost.active) {
            newHead.x = (newHead.x + this.COLS) % this.COLS;
            newHead.y = (newHead.y + this.ROWS) % this.ROWS;
        } else {
            if (newHead.x < 0 || newHead.x >= this.COLS || newHead.y < 0 || newHead.y >= this.ROWS) {
                this.die(newHead);
                return;
            }
        }

        // Self collision (skip head)
        if (!this.activeEffects.ghost.active) {
            if (this.snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) {
                this.die(newHead);
                return;
            }
        }

        // Wall collision
        if (this.walls.some(w => w.x === newHead.x && w.y === newHead.y)) {
            this.die(newHead);
            return;
        }

        this.snake.unshift(newHead);

        // Check food
        let eaten = false;
        for (let i = this.food.length - 1; i >= 0; i--) {
            const f = this.food[i];
            if (Math.floor(f.x) === newHead.x && Math.floor(f.y) === newHead.y) {
                this.eatFood(f, i, timestamp);
                eaten = true;
                break;
            }
        }

        // Check bonus food
        if (this.bonusFood &&
            Math.floor(this.bonusFood.x) === newHead.x &&
            Math.floor(this.bonusFood.y) === newHead.y) {
            this.eatBonusFood(timestamp);
            eaten = true;
        }

        // Check powerup
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            if (p.x === newHead.x && p.y === newHead.y) {
                this.collectPowerup(p, i);
                break;
            }
        }

        if (!eaten) this.snake.pop();
    }

    eatFood(food, idx, timestamp) {
        this.combo++;
        this.comboTimer = 2000;
        this.comboDisplay.opacity = 1;
        this.comboDisplay.scale = 1.5;

        const multiplier = this.activeEffects.double.active ? 2 : 1;
        const comboBonus = Math.min(this.combo - 1, 5) * 5;
        const gained = (food.points + comboBonus) * multiplier;
        this.score += gained;
        this.onScore(this.score);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('snake_best', this.bestScore);
        }

        const px = this.offsetX + food.x * this.CELL + this.CELL / 2;
        const py = this.offsetY + food.y * this.CELL + this.CELL / 2;

        this.spawnEatParticles(px, py, food.color);
        this.eatAnim = { active: true, timer: 300, x: px, y: py, color: food.color };

        this.scorePopups.push({
            x: px, y: py,
            text: this.combo > 1 ? `+${gained} x${this.combo}!` : `+${gained}`,
            color: this.combo > 2 ? '#FFD700' : food.color,
            life: 1200, opacity: 1
        });

        this.food.splice(idx, 1);
        this.foodEaten++;
        this.spawnFood();

        // Bonus food spawn chance
        if (!this.bonusFood && this.foodEaten % 5 === 0) this.spawnBonusFood();

        // Powerup spawn chance
        if (Math.random() < 0.15) this.spawnPowerup();

        // Level up
        if (this.foodEaten % this.foodPerLevel === 0) this.levelUp();

        this.flashAlpha = 0.08;
        this.flashColor = food.color;

        if (window.audioManager) audioManager.play('collect');
    }

    eatBonusFood(timestamp) {
        const multiplier = this.activeEffects.double.active ? 2 : 1;
        const gained = this.bonusFood.points * multiplier;
        this.score += gained;
        this.onScore(this.score);

        const px = this.offsetX + this.bonusFood.x * this.CELL + this.CELL / 2;
        const py = this.offsetY + this.bonusFood.y * this.CELL + this.CELL / 2;
        this.spawnEatParticles(px, py, '#b347d9');
        this.spawnEatParticles(px, py, '#FFD700');

        this.scorePopups.push({
            x: px, y: py,
            text: `💫 BONUS +${gained}!`,
            color: '#b347d9',
            life: 1500, opacity: 1
        });

        this.bonusFood = null;
        this.bonusFoodTimer = 0;
        this.screenShake.timer = 8;
        this.screenShake.intensity = 5;
        this.flashAlpha = 0.2;
        this.flashColor = '#b347d9';
        if (window.audioManager) audioManager.play('levelUp');
    }

    collectPowerup(p, idx) {
        const ef = this.activeEffects[p.type];
        ef.active = true;
        ef.timer = ef.duration;

        const px = this.offsetX + p.x * this.CELL + this.CELL / 2;
        const py = this.offsetY + p.y * this.CELL + this.CELL / 2;
        this.spawnEatParticles(px, py, p.color);

        this.scorePopups.push({
            x: px, y: py,
            text: `${p.emoji} ${p.label}!`,
            color: p.color,
            life: 1500, opacity: 1
        });

        this.powerups.splice(idx, 1);
        this.flashAlpha = 0.15;
        this.flashColor = p.color;
        if (window.audioManager) audioManager.play('powerup');
    }

    levelUp() {
        this.level++;
        this.score += 50;
        this.onScore(this.score);
        this.levelUpAnim = { active: true, timer: 1500 };
        this.spawnWalls();
        this.screenShake.timer = 12;
        this.screenShake.intensity = 6;
        this.flashAlpha = 0.3;
        this.flashColor = '#00FF88';
        if (window.audioManager) audioManager.play('levelUp');
    }

    die(pos) {
        this.gameOver = true;
        this.state = this.STATE.DEAD;

        // Death pieces
        this.deathAnim.active = true;
        this.snake.forEach((s, i) => {
            const px = this.offsetX + s.x * this.CELL + this.CELL / 2;
            const py = this.offsetY + s.y * this.CELL + this.CELL / 2;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.deathAnim.pieces.push({
                x: px, y: py,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                life: 1,
                color: this.getSnakeColor(i, this.snake.length),
                size: this.CELL - 4
            });
        });

        this.screenShake.timer = 20;
        this.screenShake.intensity = 12;
        this.flashAlpha = 0.6;
        this.flashColor = '#FF0055';

        setTimeout(() => this.onScore(this.score, true), 1200);
        if (window.audioManager) audioManager.play('gameOver');
    }

    spawnEatParticles(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                life: 1, decay: 0.04,
                color, gravity: 0.1
            });
        }
        // Sparkles
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.03,
                color: '#fff', gravity: 0.05
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
        this.drawGrid();
        this.drawWalls(timestamp);
        this.drawFood(timestamp);
        this.drawBonusFood(timestamp);
        this.drawPowerups(timestamp);
        this.drawSnake(timestamp);
        this.drawParticles();
        this.drawScorePopups();
        this.drawDeathPieces();

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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
        bg.addColorStop(0, '#080518');
        bg.addColorStop(0.6, '#050310');
        bg.addColorStop(1, '#020108');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        this.stars.forEach(s => {
            const a = (Math.sin(s.t) + 1) / 2 * 0.5 + 0.1;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawGrid() {
        const ctx = this.ctx;
        const ghostActive = this.activeEffects.ghost.active;

        // Grid border
        ctx.strokeStyle = ghostActive
            ? 'rgba(0,212,255,0.4)'
            : 'rgba(179,71,217,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            this.offsetX - 1, this.offsetY - 1,
            this.COLS * this.CELL + 2, this.ROWS * this.CELL + 2
        );

        // Grid lines
        ctx.strokeStyle = ghostActive
            ? 'rgba(0,212,255,0.04)'
            : 'rgba(179,71,217,0.04)';
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= this.COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(this.offsetX + c * this.CELL, this.offsetY);
            ctx.lineTo(this.offsetX + c * this.CELL, this.offsetY + this.ROWS * this.CELL);
            ctx.stroke();
        }
        for (let r = 0; r <= this.ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(this.offsetX, this.offsetY + r * this.CELL);
            ctx.lineTo(this.offsetX + this.COLS * this.CELL, this.offsetY + r * this.CELL);
            ctx.stroke();
        }

        // Ghost mode overlay
        if (ghostActive) {
            ctx.fillStyle = 'rgba(0,212,255,0.03)';
            ctx.fillRect(this.offsetX, this.offsetY, this.COLS * this.CELL, this.ROWS * this.CELL);
        }
    }

    drawWalls(timestamp) {
        const ctx = this.ctx;
        this.walls.forEach(w => {
            w.pulse += 0.05;
            const glow = 0.4 + Math.sin(w.pulse) * 0.3;
            const x = this.offsetX + w.x * this.CELL;
            const y = this.offsetY + w.y * this.CELL;
            const s = this.CELL - 2;

            ctx.shadowBlur = 8;
            ctx.shadowColor = `rgba(255,50,50,${glow})`;
            ctx.fillStyle = `rgba(200,30,30,${0.7 + glow * 0.3})`;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, s, s, 3);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,100,100,0.3)';
            ctx.fillRect(x + 3, y + 3, s * 0.4, s * 0.3);
            ctx.shadowBlur = 0;

            // X mark
            ctx.strokeStyle = 'rgba(255,200,200,0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 5);
            ctx.lineTo(x + s - 3, y + s - 3);
            ctx.moveTo(x + s - 3, y + 5);
            ctx.lineTo(x + 5, y + s - 3);
            ctx.stroke();
        });
        ctx.shadowBlur = 0;
    }

    drawFood(timestamp) {
        const ctx = this.ctx;
        this.food.forEach(f => {
            const x = this.offsetX + f.x * this.CELL + this.CELL / 2;
            const y = this.offsetY + f.y * this.CELL + this.CELL / 2;
            const pulse = 0.85 + Math.sin(f.pulse) * 0.15;
            const r = (this.CELL / 2 - 2) * f.scale * pulse;

            ctx.save();
            ctx.translate(x, y);

            // Outer glow ring
            ctx.shadowBlur = 15;
            ctx.shadowColor = f.glow;
            ctx.strokeStyle = f.glow;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3 + Math.sin(f.pulse) * 0.2;
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Body
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
            grad.addColorStop(0, this.lightenColor(f.color, 60));
            grad.addColorStop(0.6, f.color);
            grad.addColorStop(1, this.darkenColor(f.color, 40));
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath();
            ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.35, r * 0.22, -0.5, 0, Math.PI * 2);
            ctx.fill();

            // Super food special
            if (f.type === 'super') {
                ctx.rotate(f.rotation);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 6; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI * 2 * i) / 6);
                    ctx.beginPath();
                    ctx.moveTo(r * 0.6, 0);
                    ctx.lineTo(r * 1.3, 0);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            ctx.restore();
        });
    }

    drawBonusFood(timestamp) {
        if (!this.bonusFood) return;
        const ctx = this.ctx;
        const bf = this.bonusFood;
        const x = this.offsetX + bf.x * this.CELL + this.CELL / 2;
        const y = this.offsetY + bf.y * this.CELL + this.CELL / 2;
        const pulse = 0.8 + Math.sin(bf.pulse * 2) * 0.2;
        const r = (this.CELL / 2 - 1) * bf.scale * pulse;
        const timeLeft = this.bonusFoodTimer / this.bonusFoodDuration;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bf.pulse * 0.5);

        // Rotating ring
        ctx.strokeStyle = `rgba(179,71,217,${0.4 + Math.sin(bf.pulse) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#b347d9';
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2 * timeLeft);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        grad.addColorStop(0, '#dd88ff');
        grad.addColorStop(0.5, '#b347d9');
        grad.addColorStop(1, '#6611aa');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#b347d9';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.35, r * 0.22, -0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawPowerups(timestamp) {
        const ctx = this.ctx;
        this.powerups.forEach(p => {
            const x = this.offsetX + p.x * this.CELL + this.CELL / 2;
            const y = this.offsetY + p.y * this.CELL + this.CELL / 2;
            const pulse = 0.9 + Math.sin(p.pulse) * 0.1;

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(p.scale * pulse, p.scale * pulse);

            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.roundRect(-10, -10, 20, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font = '14px serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.emoji, 0, 5);

            ctx.restore();
        });
        ctx.textAlign = 'left';
    }

    getSnakeColor(index, total) {
        const hue = 280 + (index / total) * 60;
        const light = 65 - (index / total) * 20;
        return `hsl(${hue},80%,${light}%)`;
    }

    drawSnake(timestamp) {
        const ctx = this.ctx;
        const ghost = this.activeEffects.ghost.active;
        const magnet = this.activeEffects.magnet.active;

        // Draw body segments (back to front)
        for (let i = this.snake.length - 1; i >= 0; i--) {
            const s = this.snake[i];
            const x = this.offsetX + s.x * this.CELL;
            const y = this.offsetY + s.y * this.CELL;
            const cs = this.CELL - 2;

            const color = this.getSnakeColor(i, this.snake.length);

            if (ghost) ctx.globalAlpha = 0.6;

            ctx.shadowBlur = i === 0 ? 15 : 6;
            ctx.shadowColor = i === 0 ? '#00fff5' : color;

            const grad = ctx.createLinearGradient(x, y, x + cs, y + cs);
            grad.addColorStop(0, this.lightenColor(color, 30));
            grad.addColorStop(1, this.darkenColor(color, 20));
            ctx.fillStyle = grad;

            const radius = i === 0 ? 7 : 5;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, cs, cs, radius);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Segment shine
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 3, cs * 0.5, cs * 0.35, 3);
            ctx.fill();

            // Head special
            if (i === 0) {
                const hx = x + this.CELL / 2;
                const hy = y + this.CELL / 2;

                // Eyes
                const eyeOffsets = [
                    { ex: this.dir.y !== 0 ? -4 : 0, ey: this.dir.x !== 0 ? -4 : 0 },
                    { ex: this.dir.y !== 0 ? 4 : 0, ey: this.dir.x !== 0 ? 4 : 0 }
                ];

                if (this.dir.x === 1) { eyeOffsets[0].ex = 3; eyeOffsets[0].ey = -4; eyeOffsets[1].ex = 3; eyeOffsets[1].ey = 4; }
                if (this.dir.x === -1) { eyeOffsets[0].ex = -3; eyeOffsets[0].ey = -4; eyeOffsets[1].ex = -3; eyeOffsets[1].ey = 4; }
                if (this.dir.y === 1) { eyeOffsets[0].ex = -4; eyeOffsets[0].ey = 3; eyeOffsets[1].ex = 4; eyeOffsets[1].ey = 3; }
                if (this.dir.y === -1) { eyeOffsets[0].ex = -4; eyeOffsets[0].ey = -3; eyeOffsets[1].ex = 4; eyeOffsets[1].ey = -3; }

                eyeOffsets.forEach(eo => {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(hx + eo.ex, hy + eo.ey, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    ctx.arc(hx + eo.ex + 0.5, hy + eo.ey + 0.5, 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(hx + eo.ex + 1, hy + eo.ey, 0.8, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Tongue
                const tx = hx + this.dir.x * 11;
                const ty = hy + this.dir.y * 11;
                ctx.strokeStyle = '#FF0055';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(hx + this.dir.x * 7, hy + this.dir.y * 7);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                // Tongue fork
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx + this.dir.y * 3 + this.dir.x * 3, ty + this.dir.x * 3 + this.dir.y * 3);
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - this.dir.y * 3 + this.dir.x * 3, ty - this.dir.x * 3 + this.dir.y * 3);
                ctx.stroke();

                // Magnet effect arc
                if (magnet) {
                    ctx.strokeStyle = `rgba(255,0,110,${0.4 + Math.sin(timestamp / 200) * 0.3})`;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([3, 5]);
                    ctx.beginPath();
                    ctx.arc(hx, hy, 120, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            ctx.globalAlpha = 1;
        }
    }

    drawParticles() {
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

    drawScorePopups() {
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

    drawDeathPieces() {
        if (!this.deathAnim.active) return;
        const ctx = this.ctx;
        this.deathAnim.pieces.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, 4);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawHUD(timestamp) {
        const ctx = this.ctx;
        const W = this.canvas.width;

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, this.offsetY - 4);

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 13px Orbitron';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LVL ${this.level}`, 10, 30);
        ctx.shadowBlur = 0;

        // Score
        ctx.fillStyle = '#00fff5';
        ctx.font = 'bold 18px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00fff5';
        ctx.fillText(this.score, W / 2, 30);
        ctx.shadowBlur = 0;

        // Best
        if (this.bestScore > 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.6)';
            ctx.font = '11px Rajdhani';
            ctx.fillText(`BEST: ${this.bestScore}`, W / 2, 44);
        }

        // Snake length
        ctx.fillStyle = '#00FF88';
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'right';
        ctx.fillText(`🐍 ${this.snake.length}`, W - 10, 22);

        // Combo
        if (this.combo > 1 && this.comboDisplay.opacity > 0) {
            ctx.globalAlpha = this.comboDisplay.opacity;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 11px Orbitron';
            ctx.textAlign = 'right';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`x${this.combo} COMBO!`, W - 10, 38);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Active effects
        let efX = 8;
        Object.entries(this.activeEffects).forEach(([key, ef]) => {
            if (!ef.active) return;
            const info = {
                speed: { color: '#FF8C00', emoji: '⚡' },
                ghost: { color: '#00D4FF', emoji: '👻' },
                magnet: { color: '#FF006E', emoji: '🧲' },
                double: { color: '#FFD700', emoji: '×2' }
            };
            const i = info[key];
            const pct = ef.timer / ef.duration;
            ctx.fillStyle = i.color;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.roundRect(efX, this.offsetY - 22, 40, 16, 4);
            ctx.fill();
            ctx.globalAlpha = pct;
            ctx.fillStyle = this.lightenColor(i.color, 40);
            ctx.beginPath();
            ctx.roundRect(efX, this.offsetY - 22, 40 * pct, 16, 4);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = '10px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(i.emoji, efX + 20, this.offsetY - 10);
            efX += 46;
        });

        // Level up animation
        if (this.levelUpAnim.active) {
            const prog = this.levelUpAnim.timer / 1500;
            ctx.globalAlpha = prog;
            ctx.font = 'bold 28px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00FF88';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00FF88';
            ctx.fillText(`LEVEL ${this.level}!`, W / 2, this.canvas.height / 2 - 20);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawWaiting(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2 + 20;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(cx - 130, cy - 45, 260, 80, 15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(179,71,217,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 22px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00fff5';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00fff5';
        ctx.fillText('NEON SNAKE', cx, cy - 12);
        ctx.shadowBlur = 0;

        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Arrow Keys / WASD / Swipe to Start', cx, cy + 15);

        const bob = Math.sin(timestamp / 400) * 5;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '11px Rajdhani';
        ctx.fillText('Press any direction to play', cx, cy + 38 + bob);
        ctx.textAlign = 'left';
    }

    drawDeathScreen(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const alpha = this.deathOverlayAlpha;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.65) return;
        const pa = (alpha - 0.65) / 0.35;
        ctx.globalAlpha = pa;

        const pw = Math.min(this.canvas.width - 40, 280);
        const ph = 210;
        ctx.fillStyle = 'rgba(8,3,20,0.97)';
        ctx.strokeStyle = 'rgba(255,0,85,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0055';
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 26px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', cx, cy - ph / 2 + 42);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + 20, cy - ph / 2 + 58);
        ctx.lineTo(cx + pw / 2 - 20, cy - ph / 2 + 58);
        ctx.stroke();

        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'left';
        ctx.fillText('SCORE', cx - pw / 2 + 25, cy - 15);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'right';
        ctx.fillText(this.score, cx + pw / 2 - 25, cy - 10);

        ctx.font = '13px Rajdhani';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'left';
        ctx.fillText('BEST', cx - pw / 2 + 25, cy + 18);
        ctx.font = 'bold 16px Orbitron';
        ctx.fillStyle = this.score >= this.bestScore ? '#FFD700' : '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(this.bestScore, cx + pw / 2 - 25, cy + 22);

        ctx.font = '13px Rajdhani';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'left';
        ctx.fillText('LENGTH', cx - pw / 2 + 25, cy + 48);
        ctx.fillStyle = '#00ff88';
        ctx.textAlign = 'right';
        ctx.fillText(`🐍 ${this.snake.length}`, cx + pw / 2 - 25, cy + 52);

        const tap = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${tap})`;
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('TAP / ENTER to Play Again', cx, cy + ph / 2 - 15);

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
        this.COLS = Math.floor(this.canvas.width / this.CELL);
        this.ROWS = Math.floor((this.canvas.height - 60) / this.CELL);
        this.offsetX = Math.floor((this.canvas.width - this.COLS * this.CELL) / 2);
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        document.removeEventListener('keydown', this.boundKey);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    }
}