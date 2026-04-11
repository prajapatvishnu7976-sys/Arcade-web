class ColorUp {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.paused = false;
        this.destroyed = false;
        this.colors = ['#ff006e', '#00d4ff', '#00ff88', '#fff700', '#b347d9'];
        this.playerColorIdx = 0;
        this.player = { x: canvas.width / 2, y: canvas.height - 60, r: 18 };
        this.gates = [];
        this.speed = 2;
        this.gateTimer = 0;
        this.particles = [];

        this.spawnInitialGates();

        this.handleClick = this.handleClick.bind(this);
        canvas.addEventListener('click', this.handleClick);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleClick(e); });

        this.loop();
    }

    spawnInitialGates() {
        for (let i = 0; i < 5; i++) {
            this.addGate(this.canvas.height - 200 - i * 120);
        }
    }

    addGate(y) {
        const leftColor = Math.floor(Math.random() * this.colors.length);
        let rightColor;
        do { rightColor = Math.floor(Math.random() * this.colors.length); } while (rightColor === leftColor);
        this.gates.push({
            y,
            leftColor,
            rightColor,
            midX: this.canvas.width / 2
        });
    }

    handleClick() {
        if (this.paused) return;
        this.playerColorIdx = (this.playerColorIdx + 1) % this.colors.length;
        if (window.audioManager) audioManager.play('click');
    }

    update() {
        if (this.paused) return;

        // Move gates down
        for (let i = this.gates.length - 1; i >= 0; i--) {
            this.gates[i].y += this.speed;
            if (this.gates[i].y > this.canvas.height + 30) {
                this.gates.splice(i, 1);
            }
        }

        // Spawn new gates
        this.gateTimer++;
        if (this.gateTimer > 60 / (this.speed * 0.5)) {
            this.gateTimer = 0;
            const topGate = this.gates.length > 0 ? Math.min(...this.gates.map(g => g.y)) : 0;
            if (topGate > 40) this.addGate(-20);
        }

        // Check gate collisions
        for (let i = this.gates.length - 1; i >= 0; i--) {
            const g = this.gates[i];
            if (Math.abs(g.y - this.player.y) < 15) {
                const isLeft = this.player.x < g.midX;
                const gateColor = isLeft ? g.leftColor : g.rightColor;
                if (gateColor === this.playerColorIdx) {
                    this.score += 10;
                    this.onScore(this.score);
                    this.addParticles(this.player.x, this.player.y, this.colors[this.playerColorIdx]);
                    this.gates.splice(i, 1);
                    if (window.audioManager) audioManager.play('score');
                    this.speed = Math.min(5, 2 + this.score / 100);
                } else {
                    this.addParticles(this.player.x, this.player.y, '#ff0055');
                    if (window.audioManager) audioManager.play('fail');
                    this.onScore(this.score, true);
                    return;
                }
            }
        }

        // Move player left/right with mouse position (auto-dodge)
        this.particles = this.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.life--; return p.life > 0; });
    }

    addParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                life: 20, color, size: Math.random() * 3 + 1
            });
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // BG
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Lane divider
        ctx.strokeStyle = 'rgba(179,71,217,0.1)';
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(this.canvas.width / 2, 0);
        ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Gates
        this.gates.forEach(g => {
            // Left
            ctx.fillStyle = this.colors[g.leftColor];
            ctx.globalAlpha = 0.5;
            ctx.fillRect(0, g.y - 12, g.midX - 5, 24);
            ctx.globalAlpha = 1;
            ctx.fillStyle = this.colors[g.leftColor];
            ctx.strokeStyle = this.colors[g.leftColor];
            ctx.lineWidth = 2;
            ctx.strokeRect(0, g.y - 12, g.midX - 5, 24);

            // Right
            ctx.fillStyle = this.colors[g.rightColor];
            ctx.globalAlpha = 0.5;
            ctx.fillRect(g.midX + 5, g.y - 12, this.canvas.width - g.midX - 5, 24);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = this.colors[g.rightColor];
            ctx.strokeRect(g.midX + 5, g.y - 12, this.canvas.width - g.midX - 5, 24);
        });

        // Player
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI * 2);
        ctx.fillStyle = this.colors[this.playerColorIdx];
        ctx.fill();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.colors[this.playerColorIdx];
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Hint
        ctx.fillStyle = '#555';
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('Click to change color • Match the gate!', this.canvas.width / 2, 25);

        // Particles
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life / 20;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        });
        ctx.textAlign = 'left';
    }

    loop() {
        if (this.destroyed) return;
        this.update();
        this.draw();
        this.animId = requestAnimationFrame(() => this.loop());
    }

    togglePause() { this.paused = !this.paused; }
    resize() {}
    destroy() { this.destroyed = true; cancelAnimationFrame(this.animId); this.canvas.removeEventListener('click', this.handleClick); }
}