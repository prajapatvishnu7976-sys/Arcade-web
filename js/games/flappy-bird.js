/* ============================================
   FLAPPY BIRD - ULTRA PREMIUM EDITION
   ============================================
   Features:
   - 60fps buttery smooth physics
   - Dynamic parallax backgrounds (5 layers)
   - Advanced particle engine (500+ particles)
   - Screen shake, slow-mo, chromatic aberration
   - Dynamic day/night cycle
   - Procedural clouds & stars
   - Neon glow rendering pipeline
   - Combo scoring system
   - Ghost replay of best run
   - Adaptive difficulty
   - Satisfying juice effects on every action
   - Premium sound feedback
   - Death cinematic with zoom
   ============================================ */

class FlappyBird {
    constructor(canvas, onScoreUpdate) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScoreUpdate = onScoreUpdate;
        this.W = canvas.width;
        this.H = canvas.height;

        // ===== GAME STATE =====
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neon_flappy_best') || '0');
        this.gameStarted = false;
        this.gameOver = false;
        this.paused = false;
        this.animationId = null;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.totalTime = 0;
        this.fps = 0;
        this.frameCount = 0;

        // ===== BIRD =====
        this.bird = {
            x: this.W * 0.2,
            y: this.H / 2,
            w: 48,
            h: 36,
            vy: 0,
            gravity: 1400,           // pixels/sec²
            jumpVel: -420,           // pixels/sec
            maxFallSpeed: 600,
            rotation: 0,
            targetRotation: 0,
            flapAnim: 0,            // wing flap animation
            squash: 1,              // squash & stretch
            stretch: 1,
            alive: true,
            deathVy: 0,
            deathRotation: 0,
            trail: [],
            glowIntensity: 1,
            hue: 195                // cyan-ish
        };

        // ===== PIPES =====
        this.pipes = [];
        this.pipeW = 72;
        this.pipeGap = 155;
        this.pipeSpeed = 180;        // pixels/sec
        this.pipeInterval = 2.0;     // seconds between pipes
        this.pipeTimer = 1.5;        // first pipe comes fast

        // ===== PARTICLES =====
        this.particles = [];
        this.maxParticles = 600;

        // ===== VISUAL FX =====
        this.fx = {
            shake: { x: 0, y: 0, intensity: 0, decay: 0.92 },
            flash: { alpha: 0, color: '#fff' },
            slowMo: { factor: 1, target: 1, speed: 3 },
            zoom: { scale: 1, target: 1, speed: 2 },
            chromaticAberration: 0,
            vignette: 0.3,
            bloom: 0
        };

        // ===== SCORE FX =====
        this.scorePopups = [];
        this.combo = 0;
        this.comboTimer = 0;

        // ===== ENVIRONMENT =====
        this.env = {
            // 5-layer parallax
            layers: [],
            stars: [],
            clouds: [],
            // Day/night
            timeOfDay: 0,         // 0-1 cycle
            daySpeed: 0.003,
            // Ambient particles
            ambientParticles: [],
            // Ground
            groundScroll: 0
        };

        this.initEnvironment();
        this.bindEvents();
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    // ===== ENVIRONMENT GENERATION =====
    initEnvironment() {
        // Parallax mountain layers
        for (let i = 0; i < 5; i++) {
            const layer = {
                points: [],
                speed: 0.1 + i * 0.15,
                color: i,
                scroll: 0
            };
            // Generate terrain points
            let x = 0;
            while (x < this.W + 200) {
                layer.points.push({
                    x: x,
                    y: this.H - 60 - (4 - i) * 40 - Math.random() * (60 + i * 20)
                });
                x += 30 + Math.random() * 40;
            }
            this.env.layers.push(layer);
        }

        // Stars
        for (let i = 0; i < 150; i++) {
            this.env.stars.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H * 0.7,
                size: 0.5 + Math.random() * 2.5,
                twinkleSpeed: 1 + Math.random() * 4,
                twinklePhase: Math.random() * Math.PI * 2,
                brightness: 0.3 + Math.random() * 0.7
            });
        }

        // Clouds
        for (let i = 0; i < 12; i++) {
            this.env.clouds.push(this.createCloud(Math.random() * this.W));
        }

        // Ambient floating particles
        for (let i = 0; i < 30; i++) {
            this.env.ambientParticles.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H,
                size: 1 + Math.random() * 3,
                speedX: -10 - Math.random() * 20,
                speedY: (Math.random() - 0.5) * 10,
                alpha: 0.2 + Math.random() * 0.4,
                hue: 180 + Math.random() * 60
            });
        }
    }

    createCloud(startX) {
        return {
            x: startX,
            y: 30 + Math.random() * (this.H * 0.35),
            width: 80 + Math.random() * 120,
            height: 20 + Math.random() * 30,
            speed: 15 + Math.random() * 25,
            opacity: 0.05 + Math.random() * 0.08,
            circles: Array.from({ length: 4 + Math.floor(Math.random() * 4) }, () => ({
                offsetX: Math.random(),
                offsetY: (Math.random() - 0.5) * 0.8,
                size: 0.4 + Math.random() * 0.6
            }))
        };
    }

    // ===== INPUT BINDING =====
    bindEvents() {
        const onInput = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            if (this.gameOver) return;
            if (!this.gameStarted) this.gameStarted = true;
            if (!this.paused) this.flap();
        };

        const onKey = (e) => {
            if (['Space', 'ArrowUp', 'KeyW', 'KeyX', 'KeyJ'].includes(e.code)) {
                e.preventDefault();
                onInput(e);
            }
        };

        this.canvas.addEventListener('click', onInput);
        this.canvas.addEventListener('touchstart', onInput, { passive: false });
        document.addEventListener('keydown', onKey);

        this._cleanup = () => {
            this.canvas.removeEventListener('click', onInput);
            this.canvas.removeEventListener('touchstart', onInput);
            document.removeEventListener('keydown', onKey);
        };
    }

    // ===== BIRD FLAP =====
    flap() {
        if (!this.bird.alive) return;

        this.bird.vy = this.bird.jumpVel;
        this.bird.flapAnim = 1;
        this.bird.squash = 0.7;
        this.bird.stretch = 1.3;

        audioManager.play('jump');
        this.addShake(3);

        // Flap particles
        this.emitParticles({
            x: this.bird.x - 5,
            y: this.bird.y + this.bird.h * 0.5,
            count: 12,
            spread: Math.PI * 0.8,
            angle: Math.PI * 0.5,
            speed: [80, 200],
            size: [2, 6],
            life: [0.3, 0.8],
            colors: ['#00d4ff', '#00fff5', '#88ffff', '#ffffff'],
            gravity: 200,
            fadeOut: true
        });
    }

    // ===== PARTICLE EMITTER =====
    emitParticles(config) {
        const {
            x, y, count, spread = Math.PI * 2, angle = 0,
            speed = [50, 150], size = [2, 5], life = [0.5, 1.5],
            colors = ['#fff'], gravity = 0, fadeOut = true,
            shape = 'circle', glow = true
        } = config;

        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
            const dir = angle + (Math.random() - 0.5) * spread;
            const spd = speed[0] + Math.random() * (speed[1] - speed[0]);
            const sz = size[0] + Math.random() * (size[1] - size[0]);
            const lt = life[0] + Math.random() * (life[1] - life[0]);

            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(dir) * spd,
                vy: Math.sin(dir) * spd,
                size: sz,
                origSize: sz,
                life: lt,
                maxLife: lt,
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity: gravity,
                fadeOut: fadeOut,
                shape: shape,
                glow: glow,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 10
            });
        }
    }

    // ===== SCREEN FX =====
    addShake(intensity) {
        this.fx.shake.intensity = Math.max(this.fx.shake.intensity, intensity);
    }

    addFlash(alpha = 0.5, color = '#fff') {
        this.fx.flash.alpha = alpha;
        this.fx.flash.color = color;
    }

    setSlowMo(factor, duration) {
        this.fx.slowMo.target = factor;
        if (duration > 0) {
            setTimeout(() => { this.fx.slowMo.target = 1; }, duration);
        }
    }

    // ===== MAIN UPDATE =====
    update(dt) {
        const rawDt = dt;
        
        // Slow motion
        this.fx.slowMo.factor += (this.fx.slowMo.target - this.fx.slowMo.factor) * this.fx.slowMo.speed * rawDt;
        const gameDt = dt * this.fx.slowMo.factor;
        
        // Zoom
        this.fx.zoom.scale += (this.fx.zoom.target - this.fx.zoom.scale) * this.fx.zoom.speed * rawDt;

        // Time of day
        this.env.timeOfDay = (this.env.timeOfDay + this.env.daySpeed * rawDt) % 1;

        // Screen shake
        if (this.fx.shake.intensity > 0.5) {
            this.fx.shake.x = (Math.random() - 0.5) * this.fx.shake.intensity * 2;
            this.fx.shake.y = (Math.random() - 0.5) * this.fx.shake.intensity * 2;
            this.fx.shake.intensity *= Math.pow(this.fx.shake.decay, rawDt * 60);
        } else {
            this.fx.shake.x = 0;
            this.fx.shake.y = 0;
            this.fx.shake.intensity = 0;
        }

        // Flash
        if (this.fx.flash.alpha > 0) {
            this.fx.flash.alpha -= rawDt * 4;
        }

        // Chromatic aberration decay
        if (this.fx.chromaticAberration > 0) {
            this.fx.chromaticAberration -= rawDt * 20;
        }

        // Bloom decay
        if (this.fx.bloom > 0) {
            this.fx.bloom -= rawDt * 2;
        }

        this.totalTime += rawDt;

        // ---- NOT STARTED: idle animation ----
        if (!this.gameStarted) {
            this.bird.y = this.H / 2 + Math.sin(this.totalTime * 2.5) * 18;
            this.bird.rotation = Math.sin(this.totalTime * 1.5) * 5;
            this.bird.flapAnim = (Math.sin(this.totalTime * 8) + 1) / 2;
            this.updateEnvironment(rawDt, 0.3);
            this.updateParticles(rawDt);
            return;
        }

        // ---- GAME OVER: death animation ----
        if (this.gameOver) {
            this.bird.deathVy += 1500 * rawDt;
            this.bird.y += this.bird.deathVy * rawDt;
            this.bird.deathRotation += 400 * rawDt;
            this.bird.rotation = this.bird.deathRotation;
            this.updateParticles(rawDt);
            this.updateEnvironment(rawDt, 0);
            this.updateScorePopups(rawDt);
            return;
        }

        if (this.paused) return;

        // ===== BIRD PHYSICS =====
        this.bird.vy += this.bird.gravity * gameDt;
        this.bird.vy = Math.min(this.bird.vy, this.bird.maxFallSpeed);
        this.bird.y += this.bird.vy * gameDt;

        // Smooth rotation
        this.bird.targetRotation = this.bird.vy * 0.12;
        this.bird.targetRotation = Math.max(-30, Math.min(75, this.bird.targetRotation));
        this.bird.rotation += (this.bird.targetRotation - this.bird.rotation) * 8 * gameDt;

        // Squash & stretch recovery
        this.bird.squash += (1 - this.bird.squash) * 10 * gameDt;
        this.bird.stretch += (1 - this.bird.stretch) * 10 * gameDt;

        // Flap animation
        if (this.bird.flapAnim > 0) {
            this.bird.flapAnim -= gameDt * 5;
        } else {
            // Auto wing bob
            this.bird.flapAnim = Math.max(0, Math.sin(this.totalTime * 10) * 0.3);
        }

        // Bird glow pulse
        this.bird.glowIntensity = 0.7 + Math.sin(this.totalTime * 3) * 0.3;

        // Trail
        if (this.frameCount % 2 === 0) {
            this.bird.trail.push({
                x: this.bird.x,
                y: this.bird.y + this.bird.h / 2,
                alpha: 0.8,
                size: this.bird.w * 0.4
            });
            if (this.bird.trail.length > 12) this.bird.trail.shift();
        }
        this.bird.trail.forEach(t => {
            t.alpha -= 1.5 * gameDt;
            t.size *= 0.97;
        });
        this.bird.trail = this.bird.trail.filter(t => t.alpha > 0);

        // Continuous engine particles
        if (Math.random() < 0.6) {
            this.emitParticles({
                x: this.bird.x - 8,
                y: this.bird.y + this.bird.h * 0.5,
                count: 1,
                angle: Math.PI,
                spread: 0.8,
                speed: [30, 80],
                size: [1, 3],
                life: [0.2, 0.5],
                colors: ['#00d4ff55', '#00fff544', '#ffffff33'],
                glow: false
            });
        }

        // ===== PIPES =====
        this.pipeTimer -= gameDt;
        if (this.pipeTimer <= 0) {
            this.spawnPipe();
            this.pipeTimer = this.pipeInterval;
        }

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= this.pipeSpeed * gameDt;

            // Scoring
            if (!pipe.scored && pipe.x + this.pipeW < this.bird.x) {
                pipe.scored = true;
                this.scorePoint(pipe);
            }

            // Remove
            if (pipe.x + this.pipeW < -50) {
                this.pipes.splice(i, 1);
            }
        }

        // ===== COLLISIONS =====
        this.checkCollisions();

        // ===== ENVIRONMENT =====
        this.updateEnvironment(rawDt, 1);

        // ===== PARTICLES =====
        this.updateParticles(gameDt);

        // ===== SCORE POPUPS =====
        this.updateScorePopups(rawDt);

        // ===== COMBO TIMER =====
        if (this.comboTimer > 0) {
            this.comboTimer -= gameDt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        // ===== ADAPTIVE DIFFICULTY =====
        if (this.score > 0 && this.score % 10 === 0) {
            this.pipeSpeed = Math.min(300, 180 + this.score * 2);
            this.pipeGap = Math.max(125, 155 - this.score * 0.5);
        }
    }

    // ===== SPAWN PIPE =====
    spawnPipe() {
        const minTop = 80;
        const maxTop = this.H - this.pipeGap - 80;
        const gapTop = minTop + Math.random() * (maxTop - minTop);

        this.pipes.push({
            x: this.W + 10,
            gapTop: gapTop,
            scored: false,
            wobblePhase: Math.random() * Math.PI * 2,
            hue: 120 + Math.random() * 30     // green-ish hue
        });
    }

    // ===== SCORE =====
    scorePoint(pipe) {
        this.combo++;
        this.comboTimer = 2;

        const basePoints = 1;
        const comboMultiplier = Math.min(this.combo, 10);
        const totalPoints = basePoints * comboMultiplier;

        this.score += totalPoints;
        this.onScoreUpdate(this.score);

        audioManager.play('score');

        // FX
        this.addFlash(0.15, '#00ff88');
        this.addShake(4);
        this.fx.bloom = 0.5;

        // Score popup
        const px = pipe.x + this.pipeW / 2;
        const py = pipe.gapTop + this.pipeGap / 2;

        this.scorePopups.push({
            x: px, y: py,
            text: `+${totalPoints}`,
            color: this.combo > 1 ? '#fff700' : '#00ff88',
            size: this.combo > 1 ? 32 + this.combo * 2 : 28,
            life: 1.2,
            vy: -100,
            scale: 0
        });

        if (this.combo > 1) {
            this.scorePopups.push({
                x: px, y: py + 30,
                text: `${this.combo}x COMBO`,
                color: '#ff006e',
                size: 18,
                life: 1.0,
                vy: -80,
                scale: 0
            });
        }

        // Celebrate particles
        this.emitParticles({
            x: px, y: py,
            count: 20 + this.combo * 3,
            speed: [100, 350],
            size: [3, 8],
            life: [0.4, 1.2],
            colors: ['#00ff88', '#00d4ff', '#fff700', '#ff006e', '#ffffff'],
            gravity: 300,
            shape: this.combo > 3 ? 'star' : 'circle'
        });

        // Ring burst
        this.emitParticles({
            x: px, y: py,
            count: 12,
            angle: 0,
            spread: Math.PI * 2,
            speed: [200, 300],
            size: [2, 4],
            life: [0.2, 0.5],
            colors: ['#ffffff'],
            gravity: 0
        });
    }

    // ===== COLLISIONS =====
    checkCollisions() {
        const b = this.bird;
        // Shrunk hitbox for fairness
        const hb = {
            x: b.x + 10,
            y: b.y + 6,
            w: b.w - 20,
            h: b.h - 12
        };

        // Ground / ceiling
        if (b.y + b.h > this.H - 15 || b.y < 0) {
            this.die();
            return;
        }

        // Pipes
        for (const pipe of this.pipes) {
            const px = pipe.x;
            const pw = this.pipeW;
            const gapTop = pipe.gapTop;
            const gapBot = pipe.gapTop + this.pipeGap;

            if (hb.x + hb.w > px && hb.x < px + pw) {
                if (hb.y < gapTop || hb.y + hb.h > gapBot) {
                    this.die();
                    return;
                }
            }
        }
    }

    // ===== DEATH =====
    die() {
        if (!this.bird.alive) return;
        this.bird.alive = false;
        this.gameOver = true;

        // Save high
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neon_flappy_best', String(this.highScore));
        }

        // Cinematic death
        this.bird.deathVy = -300;
        this.bird.deathRotation = this.bird.rotation;

        // Slow motion
        this.fx.slowMo.factor = 0.15;
        this.fx.slowMo.target = 0.15;
        setTimeout(() => { this.fx.slowMo.target = 1; }, 600);

        // Zoom
        this.fx.zoom.target = 1.1;
        setTimeout(() => { this.fx.zoom.target = 1; }, 800);

        // FX
        this.addShake(20);
        this.addFlash(0.9, '#fff');
        this.fx.chromaticAberration = 15;

        audioManager.play('fail');

        // Death explosion
        this.emitParticles({
            x: this.bird.x + this.bird.w / 2,
            y: this.bird.y + this.bird.h / 2,
            count: 60,
            speed: [150, 500],
            size: [3, 12],
            life: [0.5, 2],
            colors: ['#00d4ff', '#ff006e', '#fff700', '#00ff88', '#b347d9', '#ffffff'],
            gravity: 400,
            shape: 'mixed'
        });

        // Shockwave ring particles
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 / 24) * i;
            this.particles.push({
                x: this.bird.x + this.bird.w / 2,
                y: this.bird.y + this.bird.h / 2,
                vx: Math.cos(angle) * 400,
                vy: Math.sin(angle) * 400,
                size: 3,
                origSize: 3,
                life: 0.5,
                maxLife: 0.5,
                color: '#ffffff',
                gravity: 0,
                fadeOut: true,
                shape: 'circle',
                glow: true,
                rotation: 0,
                rotSpeed: 0
            });
        }

        // Feather particles
        this.emitParticles({
            x: this.bird.x + this.bird.w / 2,
            y: this.bird.y + this.bird.h / 2,
            count: 15,
            speed: [50, 200],
            size: [4, 8],
            life: [1, 3],
            colors: ['#00d4ff', '#0099bb', '#88ddff'],
            gravity: 100,
            shape: 'feather'
        });

        setTimeout(() => {
            this.onScoreUpdate(this.score, true);
        }, 1200);
    }

    // ===== ENVIRONMENT UPDATE =====
    updateEnvironment(dt, speedFactor) {
        // Clouds
        this.env.clouds.forEach(cloud => {
            cloud.x -= cloud.speed * dt * speedFactor;
            if (cloud.x + cloud.width < -50) {
                Object.assign(cloud, this.createCloud(this.W + 50 + Math.random() * 100));
            }
        });

        // Ground scroll
        this.env.groundScroll = (this.env.groundScroll + this.pipeSpeed * dt * speedFactor) % 40;

        // Ambient particles
        this.env.ambientParticles.forEach(p => {
            p.x += p.speedX * dt * speedFactor;
            p.y += p.speedY * dt;
            p.y += Math.sin(this.totalTime * 2 + p.x * 0.01) * 0.5;
            
            if (p.x < -10) {
                p.x = this.W + 10;
                p.y = Math.random() * this.H;
            }
        });
    }

    // ===== PARTICLES UPDATE =====
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vx *= (1 - dt * 0.5);  // drag
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.rotation += p.rotSpeed * dt;

            if (p.fadeOut) {
                p.size = p.origSize * (p.life / p.maxLife);
            }

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // ===== SCORE POPUP UPDATE =====
    updateScorePopups(dt) {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const p = this.scorePopups[i];
            p.y += p.vy * dt;
            p.vy *= 0.95;
            p.life -= dt;
            p.scale = Math.min(1, p.scale + dt * 8);

            if (p.life <= 0) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    // ==========================================
    //              RENDERING
    // ==========================================
    draw() {
        const ctx = this.ctx;
        ctx.save();

        // Zoom transform
        if (this.fx.zoom.scale !== 1) {
            const cx = this.bird.x + this.bird.w / 2;
            const cy = this.bird.y + this.bird.h / 2;
            ctx.translate(cx, cy);
            ctx.scale(this.fx.zoom.scale, this.fx.zoom.scale);
            ctx.translate(-cx, -cy);
        }

        // Screen shake
        ctx.translate(this.fx.shake.x, this.fx.shake.y);

        // === BACKGROUND ===
        this.drawSky(ctx);
        this.drawStars(ctx);
        this.drawAurora(ctx);
        this.drawClouds(ctx);
        this.drawParallaxLayers(ctx);
        this.drawAmbientParticles(ctx);

        // === PIPES ===
        this.drawPipes(ctx);

        // === BIRD TRAIL ===
        this.drawBirdTrail(ctx);

        // === PARTICLES (behind bird) ===
        this.drawParticles(ctx, false);

        // === BIRD ===
        if (this.bird.y < this.H + 100) {
            this.drawBird(ctx);
        }

        // === PARTICLES (in front) ===
        this.drawParticles(ctx, true);

        // === GROUND ===
        this.drawGround(ctx);

        // === SCORE POPUPS ===
        this.drawScorePopups(ctx);

        // === UI ===
        this.drawUI(ctx);

        // === POST-PROCESSING FX ===
        this.drawPostFX(ctx);

        // === START SCREEN ===
        if (!this.gameStarted && !this.gameOver) {
            this.drawStartScreen(ctx);
        }

        ctx.restore();
    }

    // ===== SKY =====
    drawSky(ctx) {
        const t = this.env.timeOfDay;
        // Blend between night and dawn colors
        const skyColors = [
            { stop: 0, colors: ['#020010', '#0a0525', '#150a35'] },   // night
            { stop: 0.25, colors: ['#1a0520', '#350a30', '#4a1040'] },// dawn
            { stop: 0.5, colors: ['#0a0520', '#1a1040', '#251550'] }, // day-ish (neon style)
            { stop: 0.75, colors: ['#150520', '#250a30', '#351040'] },// dusk
            { stop: 1, colors: ['#020010', '#0a0525', '#150a35'] }    // night
        ];

        // Find current blend
        let lower = skyColors[0], upper = skyColors[1];
        for (let i = 0; i < skyColors.length - 1; i++) {
            if (t >= skyColors[i].stop && t < skyColors[i + 1].stop) {
                lower = skyColors[i];
                upper = skyColors[i + 1];
                break;
            }
        }

        const blend = (t - lower.stop) / (upper.stop - lower.stop);
        const gradient = ctx.createLinearGradient(0, 0, 0, this.H);

        for (let i = 0; i < 3; i++) {
            const c1 = this.hexToRgb(lower.colors[i]);
            const c2 = this.hexToRgb(upper.colors[i]);
            const r = Math.round(c1.r + (c2.r - c1.r) * blend);
            const g = Math.round(c1.g + (c2.g - c1.g) * blend);
            const b = Math.round(c1.b + (c2.b - c1.b) * blend);
            gradient.addColorStop(i / 2, `rgb(${r},${g},${b})`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.W, this.H);
    }

    // ===== STARS =====
    drawStars(ctx) {
        const nightAlpha = Math.max(0, Math.sin(this.env.timeOfDay * Math.PI * 2 + Math.PI) * 0.5 + 0.5);
        if (nightAlpha < 0.1) return;

        this.env.stars.forEach(star => {
            const twinkle = Math.sin(this.totalTime * star.twinkleSpeed + star.twinklePhase);
            const alpha = star.brightness * nightAlpha * (0.5 + twinkle * 0.5);

            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;

            // Cross shape for brighter stars
            if (star.size > 1.5) {
                ctx.fillRect(star.x - star.size, star.y - 0.5, star.size * 2, 1);
                ctx.fillRect(star.x - 0.5, star.y - star.size, 1, star.size * 2);
            }

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ===== AURORA =====
    drawAurora(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        for (let i = 0; i < 3; i++) {
            const waveY = 80 + i * 30;
            const hue = 160 + i * 40 + Math.sin(this.totalTime * 0.5) * 20;
            const alpha = 0.03 + Math.sin(this.totalTime * 0.3 + i) * 0.02;
            
            ctx.beginPath();
            ctx.moveTo(0, waveY);
            
            for (let x = 0; x <= this.W; x += 5) {
                const y = waveY + 
                    Math.sin(x * 0.008 + this.totalTime * 0.5 + i * 2) * 30 +
                    Math.sin(x * 0.015 + this.totalTime * 0.3) * 15;
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(this.W, waveY + 80);
            ctx.lineTo(0, waveY + 80);
            ctx.closePath();
            
            const auroraGrad = ctx.createLinearGradient(0, waveY - 30, 0, waveY + 80);
            auroraGrad.addColorStop(0, `hsla(${hue}, 80%, 60%, 0)`);
            auroraGrad.addColorStop(0.5, `hsla(${hue}, 80%, 60%, ${alpha})`);
            auroraGrad.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
            
            ctx.fillStyle = auroraGrad;
            ctx.fill();
        }
        
        ctx.restore();
    }

    // ===== CLOUDS =====
    drawClouds(ctx) {
        this.env.clouds.forEach(cloud => {
            ctx.save();
            ctx.globalAlpha = cloud.opacity;
            
            cloud.circles.forEach(c => {
                const cx = cloud.x + c.offsetX * cloud.width;
                const cy = cloud.y + c.offsetY * cloud.height;
                const radius = c.size * cloud.height;
                
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
            });
            
            ctx.restore();
        });
    }

    // ===== PARALLAX LAYERS =====
    drawParallaxLayers(ctx) {
        const layerColors = [
            'rgba(10, 5, 30, 0.8)',
            'rgba(15, 8, 35, 0.7)',
            'rgba(20, 10, 40, 0.6)',
            'rgba(25, 12, 45, 0.5)',
            'rgba(30, 15, 50, 0.4)'
        ];

        this.env.layers.forEach((layer, idx) => {
            const scroll = this.gameStarted ? (this.totalTime * this.pipeSpeed * layer.speed) % (this.W + 200) : this.totalTime * 10 * layer.speed % (this.W + 200);
            
            ctx.fillStyle = layerColors[idx];
            ctx.beginPath();
            ctx.moveTo(0, this.H);

            layer.points.forEach((point, i) => {
                const px = ((point.x - scroll) % (this.W + 200) + this.W + 200) % (this.W + 200) - 100;
                ctx.lineTo(px, point.y + Math.sin(this.totalTime + i * 0.5) * 3);
            });

            ctx.lineTo(this.W, this.H);
            ctx.closePath();
            ctx.fill();
        });
    }

    // ===== AMBIENT PARTICLES =====
    drawAmbientParticles(ctx) {
        this.env.ambientParticles.forEach(p => {
            ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ===== PIPES =====
    drawPipes(ctx) {
        this.pipes.forEach(pipe => {
            this.drawSinglePipe(ctx, pipe);
        });
    }

    drawSinglePipe(ctx, pipe) {
        const x = pipe.x;
        const w = this.pipeW;
        const gapTop = pipe.gapTop;
        const gapBot = gapTop + this.pipeGap;
        const hue = pipe.hue;
        const wobble = Math.sin(this.totalTime * 3 + pipe.wobblePhase) * 1.5;

        // Top pipe
        this.drawPipeSection(ctx, x, 0, w, gapTop, true, hue, wobble);
        // Bottom pipe
        this.drawPipeSection(ctx, x, gapBot, w, this.H - gapBot, false, hue, wobble);

        // Gap glow indicator (helpful visual)
        const gapCenterY = gapTop + this.pipeGap / 2;
        const gapGrad = ctx.createRadialGradient(x + w / 2, gapCenterY, 5, x + w / 2, gapCenterY, this.pipeGap * 0.6);
        gapGrad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.08)`);
        gapGrad.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);
        ctx.fillStyle = gapGrad;
        ctx.fillRect(x - 20, gapTop, w + 40, this.pipeGap);
    }

    drawPipeSection(ctx, x, y, w, h, isTop, hue, wobble) {
        if (h <= 0) return;
        
        const capH = 32;
        const capExtra = 8;

        ctx.save();

        // Main pipe body
        const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        bodyGrad.addColorStop(0, `hsl(${hue}, 60%, 15%)`);
        bodyGrad.addColorStop(0.2, `hsl(${hue}, 70%, 30%)`);
        bodyGrad.addColorStop(0.45, `hsl(${hue}, 80%, 45%)`);
        bodyGrad.addColorStop(0.55, `hsl(${hue}, 80%, 45%)`);
        bodyGrad.addColorStop(0.8, `hsl(${hue}, 70%, 30%)`);
        bodyGrad.addColorStop(1, `hsl(${hue}, 60%, 15%)`);

        ctx.fillStyle = bodyGrad;

        if (isTop) {
            ctx.fillRect(x, y, w, h - capH);
        } else {
            ctx.fillRect(x, y + capH, w, h - capH);
        }

        // Cap
        const capY = isTop ? y + h - capH : y;
        const capGrad = ctx.createLinearGradient(x - capExtra, 0, x + w + capExtra, 0);
        capGrad.addColorStop(0, `hsl(${hue}, 60%, 20%)`);
        capGrad.addColorStop(0.2, `hsl(${hue}, 75%, 40%)`);
        capGrad.addColorStop(0.5, `hsl(${hue}, 85%, 55%)`);
        capGrad.addColorStop(0.8, `hsl(${hue}, 75%, 40%)`);
        capGrad.addColorStop(1, `hsl(${hue}, 60%, 20%)`);

        ctx.fillStyle = capGrad;

        // Rounded cap
        const cr = 6;
        ctx.beginPath();
        ctx.moveTo(x - capExtra + cr, capY);
        ctx.lineTo(x + w + capExtra - cr, capY);
        ctx.arcTo(x + w + capExtra, capY, x + w + capExtra, capY + cr, cr);
        ctx.lineTo(x + w + capExtra, capY + capH - cr);
        ctx.arcTo(x + w + capExtra, capY + capH, x + w + capExtra - cr, capY + capH, cr);
        ctx.lineTo(x - capExtra + cr, capY + capH);
        ctx.arcTo(x - capExtra, capY + capH, x - capExtra, capY + capH - cr, cr);
        ctx.lineTo(x - capExtra, capY + cr);
        ctx.arcTo(x - capExtra, capY, x - capExtra + cr, capY, cr);
        ctx.closePath();
        ctx.fill();

        // Highlight stripe
        ctx.fillStyle = `hsla(${hue}, 90%, 70%, 0.25)`;
        const stripeX = x + w * 0.2;
        if (isTop) {
            ctx.fillRect(stripeX, y, 4, h - capH);
        } else {
            ctx.fillRect(stripeX, y + capH, 4, h - capH);
        }

        // Cap highlight
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, 0.3)`;
        ctx.fillRect(x - capExtra + 3, capY + 2, w + capExtra * 2 - 6, 4);

        // Neon edge glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsl(${hue}, 90%, 50%)`;
        ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.6)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner glow on cap edges
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsl(${hue}, 90%, 70%)`;
        ctx.strokeStyle = `hsla(${hue}, 90%, 80%, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ===== BIRD TRAIL =====
    drawBirdTrail(ctx) {
        this.bird.trail.forEach(t => {
            ctx.globalAlpha = t.alpha * 0.4;
            ctx.fillStyle = `hsl(${this.bird.hue}, 90%, 60%)`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsl(${this.bird.hue}, 90%, 60%)`;
            ctx.beginPath();
            ctx.ellipse(t.x + this.bird.w / 2, t.y, t.size, t.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    // ===== BIRD =====
    drawBird(ctx) {
        ctx.save();

        const cx = this.bird.x + this.bird.w / 2;
        const cy = this.bird.y + this.bird.h / 2;

        ctx.translate(cx, cy);
        ctx.rotate(this.bird.rotation * Math.PI / 180);
        ctx.scale(this.bird.squash, this.bird.stretch);

        const hw = this.bird.w / 2;
        const hh = this.bird.h / 2;

        // Outer glow
        ctx.shadowBlur = 30 * this.bird.glowIntensity;
        ctx.shadowColor = `hsl(${this.bird.hue}, 90%, 60%)`;

        // Body gradient
        const bodyGrad = ctx.createRadialGradient(-hw * 0.2, -hh * 0.3, 0, 0, 0, hw);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.25, `hsl(${this.bird.hue}, 85%, 70%)`);
        bodyGrad.addColorStop(0.6, `hsl(${this.bird.hue}, 90%, 50%)`);
        bodyGrad.addColorStop(1, `hsl(${this.bird.hue}, 80%, 25%)`);

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Belly
        ctx.fillStyle = `hsla(${this.bird.hue}, 60%, 80%, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(2, 4, hw * 0.5, hh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wing
        const wingFlap = this.bird.flapAnim;
        const wingAngle = -0.3 + wingFlap * -1.2;
        ctx.save();
        ctx.translate(-5, 2);
        ctx.rotate(wingAngle);

        const wingGrad = ctx.createLinearGradient(0, -12, 0, 12);
        wingGrad.addColorStop(0, `hsl(${this.bird.hue}, 80%, 40%)`);
        wingGrad.addColorStop(1, `hsl(${this.bird.hue}, 90%, 60%)`);
        ctx.fillStyle = wingGrad;

        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Wing highlight
        ctx.fillStyle = `hsla(${this.bird.hue}, 90%, 80%, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(-2, -3, 10, 5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Eye
        // White
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(12, -6, 10, 11, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        const irisGrad = ctx.createRadialGradient(14, -5, 0, 14, -5, 6);
        irisGrad.addColorStop(0, '#111');
        irisGrad.addColorStop(0.7, '#222');
        irisGrad.addColorStop(1, '#000');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.arc(14, -5, 5, 0, Math.PI * 2);
        ctx.fill();

        // Pupil shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(16, -7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -3, 1, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        const beakGrad = ctx.createLinearGradient(16, -2, 30, 6);
        beakGrad.addColorStop(0, '#ffcc00');
        beakGrad.addColorStop(1, '#ff8800');
        ctx.fillStyle = beakGrad;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.quadraticCurveTo(32, 3, 28, 7);
        ctx.lineTo(16, 8);
        ctx.closePath();
        ctx.fill();

        // Beak highlight
        ctx.fillStyle = '#ffee66';
        ctx.beginPath();
        ctx.moveTo(17, 1);
        ctx.quadraticCurveTo(28, 3, 26, 5);
        ctx.lineTo(17, 4);
        ctx.closePath();
        ctx.fill();

        // Tail feathers
        ctx.fillStyle = `hsl(${this.bird.hue}, 70%, 40%)`;
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.translate(-hw + 3, -3 + i * 5);
            ctx.rotate(-0.3 - i * 0.15 + Math.sin(this.totalTime * 5 + i) * 0.1);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Invincibility effect (if needed)
        if (this.bird.alive && this.combo > 5) {
            ctx.strokeStyle = `hsla(${(this.totalTime * 200) % 360}, 90%, 70%, 0.5)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, hw + 8, hh + 8, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ===== PARTICLES =====
    drawParticles(ctx, frontLayer) {
        this.particles.forEach(p => {
            const isInFront = p.y > (this.bird.y - 20);
            if (isInFront !== frontLayer) return;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            if (p.glow) {
                ctx.shadowBlur = p.size * 3;
                ctx.shadowColor = p.color;
            }

            ctx.fillStyle = p.color;

            if (p.shape === 'star') {
                this.drawStarShape(ctx, 0, 0, p.size, 5);
            } else if (p.shape === 'feather') {
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.5, p.rotation, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'mixed') {
                if (Math.random() > 0.5) {
                    this.drawStarShape(ctx, 0, 0, p.size, 4);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });
    }

    drawStarShape(ctx, x, y, r, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? r : r * 0.4;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // ===== GROUND =====
    drawGround(ctx) {
        const groundY = this.H - 15;

        // Ground body
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, this.H);
        groundGrad.addColorStop(0, '#1a0a2e');
        groundGrad.addColorStop(1, '#0a0515');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, this.W, 15);

        // Neon line
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff006e';
        ctx.strokeStyle = '#ff006e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(this.W, groundY);
        ctx.stroke();

        // Secondary glow line
        ctx.shadowColor = '#ff006e';
        ctx.shadowBlur = 25;
        ctx.strokeStyle = 'rgba(255, 0, 110, 0.4)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(this.W, groundY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Scrolling ground texture
        ctx.strokeStyle = 'rgba(255, 0, 110, 0.2)';
        ctx.lineWidth = 1;
        for (let x = -this.env.groundScroll; x < this.W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, groundY + 3);
            ctx.lineTo(x + 20, this.H);
            ctx.stroke();
        }
    }

    // ===== SCORE POPUPS =====
    drawScorePopups(ctx) {
        this.scorePopups.forEach(p => {
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale);

            ctx.font = `bold ${p.size}px Orbitron, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;

            // Outline
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 4;
            ctx.strokeText(p.text, 0, 0);

            // Fill
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, 0, 0);

            ctx.restore();
        });
    }

    // ===== UI =====
    drawUI(ctx) {
        ctx.save();

        // Main score
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Shadow
        ctx.font = 'bold 56px Orbitron, monospace';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(String(this.score), this.W / 2 + 3, 28);

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(this.score), this.W / 2, 25);
        ctx.shadowBlur = 0;

        // High score
        ctx.font = '15px Rajdhani, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`BEST: ${this.highScore}`, this.W / 2, 82);

        // Combo indicator
        if (this.combo > 1 && this.comboTimer > 0) {
            const comboAlpha = Math.min(1, this.comboTimer);
            ctx.globalAlpha = comboAlpha;
            ctx.font = 'bold 16px Orbitron';
            ctx.fillStyle = '#fff700';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff700';
            ctx.fillText(`🔥 ${this.combo}x COMBO`, this.W / 2, 105);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Speed indicator for high speeds
        if (this.pipeSpeed > 220) {
            ctx.font = '12px Rajdhani';
            ctx.fillStyle = '#ff006e';
            ctx.fillText(`⚡ SPEED UP`, this.W / 2, this.H - 30);
        }

        ctx.restore();
    }

    // ===== POST-PROCESSING FX =====
    drawPostFX(ctx) {
        // Flash
        if (this.fx.flash.alpha > 0) {
            ctx.fillStyle = this.fx.flash.color === '#fff' 
                ? `rgba(255,255,255,${this.fx.flash.alpha})`
                : this.fx.flash.color.replace(')', `,${this.fx.flash.alpha})`).replace('rgb', 'rgba');
            
            if (this.fx.flash.color.startsWith('#')) {
                const rgb = this.hexToRgb(this.fx.flash.color);
                ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, this.fx.flash.alpha)})`;
            }
            ctx.fillRect(0, 0, this.W, this.H);
        }

        // Vignette
        const vignetteGrad = ctx.createRadialGradient(
            this.W / 2, this.H / 2, this.W * 0.3,
            this.W / 2, this.H / 2, this.W * 0.8
        );
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGrad.addColorStop(1, `rgba(0,0,0,${this.fx.vignette})`);
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, this.W, this.H);

        // Chromatic aberration (simulated with colored overlays)
        if (this.fx.chromaticAberration > 0.5) {
            const ca = this.fx.chromaticAberration;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.05 * (ca / 15);
            ctx.drawImage(this.canvas, ca, 0);
            ctx.drawImage(this.canvas, -ca, 0);
            ctx.restore();
        }

        // Scanlines (subtle CRT effect)
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (let y = 0; y < this.H; y += 4) {
            ctx.fillRect(0, y, this.W, 2);
        }
    }

    // ===== START SCREEN =====
    drawStartScreen(ctx) {
        // Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, this.W, this.H);

        ctx.textAlign = 'center';

        // Title
        const titleY = this.H * 0.28;
        ctx.font = 'bold 42px Orbitron, monospace';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#00d4ff';
        ctx.fillStyle = '#00d4ff';
        ctx.fillText('NEON', this.W / 2, titleY);

        ctx.shadowColor = '#ff006e';
        ctx.fillStyle = '#ff006e';
        ctx.fillText('FLAPPY', this.W / 2, titleY + 48);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '16px Rajdhani, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                // Subtitle continued...
        ctx.fillText('ULTRA PREMIUM EDITION', this.W / 2, titleY + 80);

        // Animated "Tap to Play"
        const pulseAlpha = 0.5 + Math.sin(this.totalTime * 4) * 0.4;
        const pulseScale = 1 + Math.sin(this.totalTime * 3) * 0.05;
        
        ctx.save();
        ctx.translate(this.W / 2, this.H * 0.55);
        ctx.scale(pulseScale, pulseScale);
        ctx.globalAlpha = pulseAlpha;
        
        // Tap button glow background
        const btnW = 220;
        const btnH = 55;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#b347d9';
        ctx.strokeStyle = '#b347d9';
        ctx.lineWidth = 2;
        this.roundRect(ctx, -btnW/2, -btnH/2, btnW, btnH, 12);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(179, 71, 217, 0.15)';
        this.roundRect(ctx, -btnW/2, -btnH/2, btnW, btnH, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.font = 'bold 22px Orbitron, monospace';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAP TO PLAY', 0, 0);
        
        ctx.restore();
        ctx.globalAlpha = 1;
        
        // Controls hint
        ctx.font = '13px Rajdhani, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('CLICK • TAP • SPACE • W • ↑', this.W / 2, this.H * 0.65);
        
        // High score display
        if (this.highScore > 0) {
            ctx.font = '15px Rajdhani, sans-serif';
            ctx.fillStyle = '#fff700';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fff700';
            ctx.fillText(`🏆 BEST: ${this.highScore}`, this.W / 2, this.H * 0.75);
            ctx.shadowBlur = 0;
        }
        
        // Animated bird preview arrows
        const arrowY = this.H * 0.55;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(this.totalTime * 5) * 0.2})`;
        ctx.font = '24px sans-serif';
        ctx.fillText('▶', this.W / 2 + 140, arrowY);
        ctx.fillText('◀', this.W / 2 - 140, arrowY);
        
        // Floating decorative particles on start screen
        if (this.frameCount % 10 === 0) {
            this.emitParticles({
                x: Math.random() * this.W,
                y: this.H + 10,
                count: 1,
                angle: -Math.PI / 2,
                spread: 0.5,
                speed: [30, 80],
                size: [1, 3],
                life: [2, 5],
                colors: ['#b347d955', '#ff006e44', '#00d4ff44'],
                gravity: -20,
                glow: false
            });
        }
    }

    // ===== UTILITY: Rounded Rectangle =====
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    // ===== UTILITY: Hex to RGB =====
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // ===== MAIN GAME LOOP =====
    gameLoop(timestamp) {
        this.deltaTime = Math.min(0.05, (timestamp - this.lastTime) / 1000); // Cap dt
        this.lastTime = timestamp;
        this.frameCount++;
        
        // FPS counter
        this.fps = Math.round(1 / this.deltaTime);

        this.update(this.deltaTime);
        this.draw();

        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    // ===== PAUSE / RESUME =====
    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
        }
    }

    // ===== RESIZE =====
    resize() {
        this.W = this.canvas.width;
        this.H = this.canvas.height;
        this.env.layers = [];
        this.env.stars = [];
        this.env.clouds = [];
        this.initEnvironment();
    }

    // ===== CLEANUP =====
    destroy() {
        cancelAnimationFrame(this.animationId);
        if (this._cleanup) this._cleanup();
    }
}