// ============================================================
// NEONARCADE - PREMIUM PARTICLES.JS v3.0
// Khatarnak Particle System with Advanced Effects
// ============================================================

'use strict';

// ============================================================
// 1. CONSTANTS & CONFIG
// ============================================================

const PARTICLE_CONFIG = {
    // Particle counts (screen size ke hisaab se)
    maxParticles: {
        mobile: 40,
        tablet: 60,
        desktop: 90
    },
    // Connection settings
    connectionDistance: 130,
    connectionOpacity: 0.35,
    connectionWidth: 0.8,
    // Mouse interaction
    mouseRadius: 160,
    mouseForce: 2.5,
    mouseGrowth: 3.5,
    // Animation speeds
    minSpeed: 0.1,
    maxSpeed: 0.5,
    // Particle sizes
    minSize: 0.8,
    maxSize: 3.0,
    // Special effects
    shootingStarInterval: 4000,
    pulseRingInterval: 6000,
    // Performance
    targetFPS: 60,
    fpsCheckInterval: 2000
};

// Color palettes - theme ke hisaab se
const COLOR_PALETTES = {
    cyber: ['#00f5ff', '#bc13fe', '#ff6b35', '#00ff88', '#ffff00'],
    matrix: ['#39ff14', '#00ff41', '#008f11', '#00ff00', '#7fff00'],
    sunset: ['#ff6b35', '#fe2254', '#ffff00', '#ff9500', '#ff3864'],
    ocean: ['#00b4d8', '#0077b6', '#90e0ef', '#48cae4', '#caf0f8'],
    default: ['#b347d9', '#ff006e', '#00d4ff', '#00fff5', '#00ff88']
};

// ============================================================
// 2. PARTICLE TYPES
// ============================================================

const PARTICLE_TYPES = ['circle', 'star', 'triangle', 'diamond', 'ring'];

// ============================================================
// 3. MAIN PARTICLE SYSTEM CLASS
// ============================================================

class ParticleSystem {
    constructor(canvasId, options = {}) {
        // Canvas setup
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`ParticleSystem: Canvas "${canvasId}" not found`);
            return;
        }

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.isInitialized = false;
        this.isRunning = false;
        this.animationId = null;

        // Options merge karo
        this.options = {
            interactive: true,
            showConnections: true,
            showShootingStars: true,
            showPulseRings: true,
            colorPalette: 'default',
            performanceMode: false,
            attractMode: false,       // true = attract, false = repel
            ...options
        };

        // State
        this.particles = [];
        this.shootingStars = [];
        this.pulseRings = [];
        this.clickBursts = [];

        // Mouse/Touch tracking
        this.pointer = {
            x: null,
            y: null,
            radius: PARTICLE_CONFIG.mouseRadius,
            isDown: false
        };

        // Performance tracking
        this.performance = {
            fps: 60,
            frameCount: 0,
            lastFPSCheck: performance.now(),
            lastFrameTime: performance.now(),
            isLowPerformance: false
        };

        // Timers
        this.timers = {
            shootingStar: null,
            pulseRing: null
        };

        // Colors
        this.colors = COLOR_PALETTES[this.options.colorPalette] || COLOR_PALETTES.default;

        // Initialize karo
        this.init();
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    init() {
        this.resize();
        this.createParticles();
        this.bindEvents();
        this.startSpecialEffects();
        this.animate();
        this.isInitialized = true;
        this.isRunning = true;
    }

    // ============================================================
    // CANVAS RESIZE
    // ============================================================

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.deviceType = this.getDeviceType();
    }

    getDeviceType() {
        const w = window.innerWidth;
        if (w < 768) return 'mobile';
        if (w < 1024) return 'tablet';
        return 'desktop';
    }

    getParticleCount() {
        if (this.performance.isLowPerformance) {
            return Math.floor(PARTICLE_CONFIG.maxParticles[this.deviceType] * 0.5);
        }
        return PARTICLE_CONFIG.maxParticles[this.deviceType];
    }

    // ============================================================
    // PARTICLE CREATION
    // ============================================================

    createParticles() {
        this.particles = [];
        const count = this.getParticleCount();

        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(this));
        }
    }

    addParticle() {
        if (this.particles.length < this.getParticleCount() * 1.2) {
            this.particles.push(new Particle(this));
        }
    }

    removeExcessParticles() {
        const max = this.getParticleCount();
        if (this.particles.length > max) {
            this.particles.splice(max);
        }
    }

    // ============================================================
    // SPECIAL EFFECTS
    // ============================================================

    startSpecialEffects() {
        // Shooting stars
        if (this.options.showShootingStars) {
            this.timers.shootingStar = setInterval(() => {
                if (!document.hidden && this.isRunning) {
                    this.createShootingStar();
                }
            }, PARTICLE_CONFIG.shootingStarInterval);
        }

        // Pulse rings
        if (this.options.showPulseRings) {
            this.timers.pulseRing = setInterval(() => {
                if (!document.hidden && this.isRunning) {
                    this.createPulseRing();
                }
            }, PARTICLE_CONFIG.pulseRingInterval);
        }
    }

    createShootingStar() {
        const fromLeft = Math.random() > 0.5;
        this.shootingStars.push({
            x: fromLeft ? -10 : this.canvas.width + 10,
            y: Math.random() * this.canvas.height * 0.6,
            speedX: fromLeft ? (Math.random() * 8 + 6) : -(Math.random() * 8 + 6),
            speedY: Math.random() * 3 + 1,
            length: Math.random() * 80 + 60,
            opacity: 1,
            size: Math.random() * 1.5 + 0.5,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            trail: []
        });
    }

    createPulseRing(x, y) {
        const ringX = x || Math.random() * this.canvas.width;
        const ringY = y || Math.random() * this.canvas.height;
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];

        this.pulseRings.push({
            x: ringX,
            y: ringY,
            radius: 5,
            maxRadius: Math.random() * 100 + 80,
            opacity: 0.8,
            speed: Math.random() * 1.5 + 0.8,
            color,
            lineWidth: Math.random() * 2 + 0.5
        });
    }

    createClickBurst(x, y) {
        const burstCount = this.performance.isLowPerformance ? 6 : 12;
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];

        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 / burstCount) * i;
            const speed = Math.random() * 4 + 2;

            this.clickBursts.push({
                x,
                y,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                size: Math.random() * 3 + 1,
                opacity: 1,
                color,
                gravity: 0.1,
                life: 1,
                decay: Math.random() * 0.02 + 0.02
            });
        }

        // Pulse ring bhi create karo
        this.createPulseRing(x, y);
    }

    // ============================================================
    // EVENT BINDING
    // ============================================================

    bindEvents() {
        // Resize
        this._onResize = this._debounce(() => {
            this.resize();
            this.createParticles();
        }, 250);
        window.addEventListener('resize', this._onResize);

        if (this.options.interactive) {
            // Mouse events
            this._onMouseMove = (e) => {
                this.pointer.x = e.clientX;
                this.pointer.y = e.clientY;
            };

            this._onMouseOut = () => {
                this.pointer.x = null;
                this.pointer.y = null;
            };

            this._onMouseDown = (e) => {
                this.pointer.isDown = true;
                if (!this.options.performanceMode) {
                    this.createClickBurst(e.clientX, e.clientY);
                }
            };

            this._onMouseUp = () => {
                this.pointer.isDown = false;
            };

            window.addEventListener('mousemove', this._onMouseMove, { passive: true });
            window.addEventListener('mouseout', this._onMouseOut);
            window.addEventListener('mousedown', this._onMouseDown);
            window.addEventListener('mouseup', this._onMouseUp);

            // Touch events (mobile support)
            this._onTouchStart = (e) => {
                const touch = e.touches[0];
                this.pointer.x = touch.clientX;
                this.pointer.y = touch.clientY;
                if (!this.options.performanceMode) {
                    this.createClickBurst(touch.clientX, touch.clientY);
                }
            };

            this._onTouchMove = (e) => {
                const touch = e.touches[0];
                this.pointer.x = touch.clientX;
                this.pointer.y = touch.clientY;
            };

            this._onTouchEnd = () => {
                this.pointer.x = null;
                this.pointer.y = null;
            };

            window.addEventListener('touchstart', this._onTouchStart, { passive: true });
            window.addEventListener('touchmove', this._onTouchMove, { passive: true });
            window.addEventListener('touchend', this._onTouchEnd);
        }

        // Tab visibility - pause/resume animation
        this._onVisibilityChange = () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    // ============================================================
    // ANIMATION LOOP
    // ============================================================

    animate() {
        if (!this.isRunning) return;

        const now = performance.now();
        const delta = now - this.performance.lastFrameTime;

        // FPS cap - 60fps pe limit rakho
        if (delta < 1000 / 62) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }

        this.performance.lastFrameTime = now;
        this.performance.frameCount++;

        // FPS calculate karo
        if (now - this.performance.lastFPSCheck >= PARTICLE_CONFIG.fpsCheckInterval) {
            this.performance.fps = Math.round(
                this.performance.frameCount * 1000 /
                (now - this.performance.lastFPSCheck)
            );
            this.performance.frameCount = 0;
            this.performance.lastFPSCheck = now;
            this.checkPerformance();
        }

        // Canvas clear karo
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render order (back to front)
        this.drawShootingStars();
        this.drawPulseRings();

        if (this.options.showConnections && !this.performance.isLowPerformance) {
            this.drawConnections();
        }

        this.drawParticles();
        this.drawClickBursts();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    // ============================================================
    // DRAW: SHOOTING STARS
    // ============================================================

    drawShootingStars() {
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const star = this.shootingStars[i];

            // Trail update karo
            star.trail.push({ x: star.x, y: star.y });
            if (star.trail.length > 15) star.trail.shift();

            // Move karo
            star.x += star.speedX;
            star.y += star.speedY;
            star.opacity -= 0.012;

            // Draw trail
            if (star.trail.length > 1) {
                const gradient = this.ctx.createLinearGradient(
                    star.trail[0].x, star.trail[0].y,
                    star.x, star.y
                );
                gradient.addColorStop(0, `${star.color}00`);
                gradient.addColorStop(1, `${star.color}${Math.floor(star.opacity * 255).toString(16).padStart(2, '0')}`);

                this.ctx.beginPath();
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = star.size;
                this.ctx.moveTo(star.trail[0].x, star.trail[0].y);

                star.trail.forEach(point => {
                    this.ctx.lineTo(point.x, point.y);
                });

                this.ctx.lineTo(star.x, star.y);
                this.ctx.stroke();
            }

            // Head draw karo
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size * 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = star.opacity;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = star.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;

            // Remove if out of bounds or faded
            if (
                star.opacity <= 0 ||
                star.x < -50 ||
                star.x > this.canvas.width + 50 ||
                star.y > this.canvas.height + 50
            ) {
                this.shootingStars.splice(i, 1);
            }
        }
    }

    // ============================================================
    // DRAW: PULSE RINGS
    // ============================================================

    drawPulseRings() {
        for (let i = this.pulseRings.length - 1; i >= 0; i--) {
            const ring = this.pulseRings[i];

            ring.radius += ring.speed;
            ring.opacity -= 0.008;

            if (ring.opacity <= 0 || ring.radius >= ring.maxRadius) {
                this.pulseRings.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = ring.color;
            this.ctx.lineWidth = ring.lineWidth;
            this.ctx.globalAlpha = ring.opacity;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = ring.color;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
        }
    }

    // ============================================================
    // DRAW: CONNECTIONS
    // ============================================================

    drawConnections() {
        const { connectionDistance, connectionOpacity } = PARTICLE_CONFIG;
        const particles = this.particles;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;

                // Squared distance (Math.sqrt expensive hai)
                const distSq = dx * dx + dy * dy;
                const maxDistSq = connectionDistance * connectionDistance;

                if (distSq < maxDistSq) {
                    const dist = Math.sqrt(distSq);
                    const opacity = (connectionDistance - dist) / connectionDistance * connectionOpacity;

                    // Gradient connection line
                    const gradient = this.ctx.createLinearGradient(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y
                    );
                    gradient.addColorStop(0, this._hexToRgba(particles[i].color, opacity));
                    gradient.addColorStop(1, this._hexToRgba(particles[j].color, opacity));

                    this.ctx.beginPath();
                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = PARTICLE_CONFIG.connectionWidth;
                    this.ctx.moveTo(particles[i].x, particles[i].y);
                    this.ctx.lineTo(particles[j].x, particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    // ============================================================
    // DRAW: PARTICLES
    // ============================================================

    drawParticles() {
        this.particles.forEach(p => {
            p.update(this.pointer);
            p.draw(this.ctx);
        });
    }

    // ============================================================
    // DRAW: CLICK BURSTS
    // ============================================================

    drawClickBursts() {
        for (let i = this.clickBursts.length - 1; i >= 0; i--) {
            const burst = this.clickBursts[i];

            // Physics update
            burst.x += burst.speedX;
            burst.y += burst.speedY;
            burst.speedY += burst.gravity;
            burst.speedX *= 0.98;
            burst.life -= burst.decay;
            burst.opacity = burst.life;
            burst.size *= 0.97;

            if (burst.life <= 0 || burst.size < 0.1) {
                this.clickBursts.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(burst.x, burst.y, burst.size, 0, Math.PI * 2);
            this.ctx.fillStyle = burst.color;
            this.ctx.globalAlpha = burst.opacity;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = burst.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
        }
    }

    // ============================================================
    // PERFORMANCE MANAGEMENT
    // ============================================================

    checkPerformance() {
        if (this.performance.fps < 30 && !this.performance.isLowPerformance) {
            this.performance.isLowPerformance = true;
            this.removeExcessParticles();
            console.log('🎮 NeonArcade: Low performance detected, reducing particles');
        } else if (this.performance.fps > 50 && this.performance.isLowPerformance) {
            this.performance.isLowPerformance = false;
            this.addParticle();
        }
    }

    // ============================================================
    // THEME UPDATE
    // ============================================================

    updateTheme(themeName) {
        this.colors = COLOR_PALETTES[themeName] || COLOR_PALETTES.default;
        this.particles.forEach(p => {
            p.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        });
    }

    // ============================================================
    // PAUSE / RESUME
    // ============================================================

    pause() {
        if (!this.isRunning) return;
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
    }

    resume() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.performance.lastFrameTime = performance.now();
        this.animate();
    }

    // ============================================================
    // DESTROY - Clean up everything
    // ============================================================

    destroy() {
        // Animation stop karo
        this.pause();

        // Timers clear karo
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });

        // Event listeners remove karo
        window.removeEventListener('resize', this._onResize);

        if (this.options.interactive) {
            window.removeEventListener('mousemove', this._onMouseMove);
            window.removeEventListener('mouseout', this._onMouseOut);
            window.removeEventListener('mousedown', this._onMouseDown);
            window.removeEventListener('mouseup', this._onMouseUp);
            window.removeEventListener('touchstart', this._onTouchStart);
            window.removeEventListener('touchmove', this._onTouchMove);
            window.removeEventListener('touchend', this._onTouchEnd);
        }

        document.removeEventListener('visibilitychange', this._onVisibilityChange);

        // Arrays clear karo
        this.particles = [];
        this.shootingStars = [];
        this.pulseRings = [];
        this.clickBursts = [];

        this.isInitialized = false;
        console.log('🎮 NeonArcade: ParticleSystem destroyed');
    }

    // ============================================================
    // UTILITY METHODS
    // ============================================================

    _hexToRgba(hex, alpha) {
        // Hex to rgba convert karo
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return `rgba(179,71,217,${alpha})`;

        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    _debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Public API - statistics
    getStats() {
        return {
            particles: this.particles.length,
            shootingStars: this.shootingStars.length,
            pulseRings: this.pulseRings.length,
            clickBursts: this.clickBursts.length,
            fps: this.performance.fps,
            isLowPerformance: this.performance.isLowPerformance,
            isRunning: this.isRunning
        };
    }
}

// ============================================================
// 4. PARTICLE CLASS - Individual particle
// ============================================================

class Particle {
    constructor(system) {
        this.system = system;
        this._init();
    }

    _init() {
        const canvas = this.system.canvas;

        // Position
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        // Size
        this.baseSize = Math.random() *
            (PARTICLE_CONFIG.maxSize - PARTICLE_CONFIG.minSize) +
            PARTICLE_CONFIG.minSize;
        this.size = this.baseSize;

        // Speed
        const speed = Math.random() *
            (PARTICLE_CONFIG.maxSpeed - PARTICLE_CONFIG.minSpeed) +
            PARTICLE_CONFIG.minSpeed;
        const angle = Math.random() * Math.PI * 2;
        this.speedX = Math.cos(angle) * speed;
        this.speedY = Math.sin(angle) * speed;

        // Visuals
        this.color = this.system.colors[
            Math.floor(Math.random() * this.system.colors.length)
        ];
        this.opacity = Math.random() * 0.5 + 0.15;
        this.baseOpacity = this.opacity;

        // Type
        this.type = PARTICLE_TYPES[
            Math.floor(Math.random() * PARTICLE_TYPES.length)
        ];

        // Animation
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseOffset = Math.random() * Math.PI * 2;

        // Life cycle
        this.age = 0;
        this.maxAge = Math.random() * 600 + 300;
    }

    update(pointer) {
        const canvas = this.system.canvas;
        this.age++;

        // Soft respawn (fade in/out cycle)
        if (this.age > this.maxAge) {
            this._init();
            return;
        }

        // Pulse size effect
        const pulseFactor = Math.sin(this.age * this.pulseSpeed + this.pulseOffset);
        this.size = this.baseSize + pulseFactor * 0.5;

        // Rotation (for non-circle types)
        this.angle += this.rotationSpeed;

        // Mouse/Touch interaction
        if (pointer.x !== null && pointer.y !== null) {
            const dx = pointer.x - this.x;
            const dy = pointer.y - this.y;
            const distSq = dx * dx + dy * dy;
            const maxDistSq = pointer.radius * pointer.radius;

            if (distSq < maxDistSq) {
                const dist = Math.sqrt(distSq);
                const force = (pointer.radius - dist) / pointer.radius;
                const dirX = dx / dist;
                const dirY = dy / dist;

                if (this.system.options.attractMode) {
                    // Attract mode - mouse ke taraf aao
                    this.x += dirX * force * PARTICLE_CONFIG.mouseForce;
                    this.y += dirY * force * PARTICLE_CONFIG.mouseForce;
                } else {
                    // Repel mode - mouse se dur jao
                    this.x -= dirX * force * PARTICLE_CONFIG.mouseForce;
                    this.y -= dirY * force * PARTICLE_CONFIG.mouseForce;
                }

                // Size aur opacity boost
                this.size = this.baseSize + force * PARTICLE_CONFIG.mouseGrowth;
                this.opacity = Math.min(1, this.baseOpacity + force * 0.5);
            } else {
                this.opacity += (this.baseOpacity - this.opacity) * 0.05;
            }
        }

        // Movement
        this.x += this.speedX;
        this.y += this.speedY;

        // Boundary bounce - smooth
        if (this.x < this.size) {
            this.x = this.size;
            this.speedX = Math.abs(this.speedX);
        } else if (this.x > canvas.width - this.size) {
            this.x = canvas.width - this.size;
            this.speedX = -Math.abs(this.speedX);
        }

        if (this.y < this.size) {
            this.y = this.size;
            this.speedY = Math.abs(this.speedY);
        } else if (this.y > canvas.height - this.size) {
            this.y = canvas.height - this.size;
            this.speedY = -Math.abs(this.speedY);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        switch (this.type) {
            case 'circle':
                this._drawCircle(ctx);
                break;
            case 'star':
                this._drawStar(ctx);
                break;
            case 'triangle':
                this._drawTriangle(ctx);
                break;
            case 'diamond':
                this._drawDiamond(ctx);
                break;
            case 'ring':
                this._drawRing(ctx);
                break;
            default:
                this._drawCircle(ctx);
        }

        ctx.restore();
    }

    // ---- Shape Drawers ----

    _drawCircle(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawRing(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    _drawStar(ctx) {
        const spikes = 5;
        const outerR = this.size;
        const innerR = this.size * 0.4;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            if (i === 0) {
                ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            } else {
                ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    _drawTriangle(ctx) {
        const r = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.866, r * 0.5);
        ctx.lineTo(-r * 0.866, r * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    _drawDiamond(ctx) {
        const r = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.6, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.6, 0);
        ctx.closePath();
        ctx.fill();
    }
}

// ============================================================
// 5. INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Theme detect karo from localStorage
    const savedTheme = localStorage.getItem('neonarcade_theme') || 'cyber';

    // Performance mode check karo
    const perfMode = localStorage.getItem('neonarcade_perf') === 'true';

    // Particle system initialize karo
    window.particleSystem = new ParticleSystem('particles-canvas', {
        interactive: true,
        showConnections: true,
        showShootingStars: true,
        showPulseRings: true,
        colorPalette: savedTheme in COLOR_PALETTES ? savedTheme : 'cyber',
        performanceMode: perfMode,
        attractMode: false
    });

    // Theme change pe particle colors update karo
    document.addEventListener('themeChanged', (e) => {
        if (window.particleSystem) {
            window.particleSystem.updateTheme(e.detail.theme);
        }
    });

    // Console mein stats show karo (debug)
    if (localStorage.getItem('neonarcade_debug') === 'true') {
        setInterval(() => {
            if (window.particleSystem) {
                console.table(window.particleSystem.getStats());
            }
        }, 5000);
    }
});