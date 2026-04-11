/* ============================================
   NEONARCADE - KHATARNAK AUDIO ENGINE
   Full Web Audio API Sound System
   ============================================ */

class AudioManager {
    constructor() {
        this.enabled = true;
        this.audioContext = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.masterVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicVolume = 0.3;

        // Music
        this.currentMusic = null;
        this.musicNodes = {};
        this.musicPlaying = false;
        this.musicFadeTimer = null;

        // Sound queue (prevent spam)
        this.soundCooldowns = {};
        this.soundCooldownTime = {
            hover: 50,
            click: 80,
            bounce: 60,
            score: 100,
            shoot: 80,
            hit: 60,
            pop: 50,
            collect: 80
        };

        // Reverb
        this.reverbNode = null;
        this.reverbEnabled = true;

        // Compressor (prevent clipping)
        this.compressor = null;

        // Sound history (for debug)
        this.soundHistory = [];
        this.maxHistory = 20;

        // Preloaded buffers cache
        this.bufferCache = {};

        this.init();
    }

    // ==================== INIT ====================

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.setupAudioChain();
            this.createReverb();
            console.log('🔊 NeonArcade Audio Engine initialized!');
        } catch (e) {
            console.warn('❌ Web Audio API not supported:', e);
            this.enabled = false;
        }
    }

    setupAudioChain() {
        const ctx = this.audioContext;

        // Master compressor (prevent clipping)
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 8;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;

        // Master gain
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;

        // SFX gain
        this.sfxGain = ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;

        // Music gain
        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = this.musicVolume;

        // Chain: sfx/music -> master -> compressor -> output
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(ctx.destination);
    }

    async createReverb() {
        if (!this.audioContext) return;
        try {
            const ctx = this.audioContext;
            const convolver = ctx.createConvolver();
            const length = ctx.sampleRate * 1.5;
            const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

            for (let channel = 0; channel < 2; channel++) {
                const data = buffer.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
                }
            }
            convolver.buffer = buffer;

            this.reverbNode = ctx.createGain();
            this.reverbNode.gain.value = 0.15;
            convolver.connect(this.reverbNode);
            this.reverbNode.connect(this.masterGain);

            this.convolver = convolver;
        } catch (e) {
            console.warn('Reverb creation failed:', e);
        }
    }

    // ==================== RESUME ====================

    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // ==================== PLAY ====================

    play(soundName, options = {}) {
        if (!this.enabled || !this.audioContext) return;

        // Check cooldown
        const now = performance.now();
        const cooldown = this.soundCooldownTime[soundName] || 0;
        if (cooldown > 0) {
            if (this.soundCooldowns[soundName] && now - this.soundCooldowns[soundName] < cooldown) return;
            this.soundCooldowns[soundName] = now;
        }

        this.resume();

        // Log sound
        this.soundHistory.push({ sound: soundName, time: now });
        if (this.soundHistory.length > this.maxHistory) this.soundHistory.shift();

        // Play sound
        try {
            switch (soundName) {
                // UI Sounds
                case 'hover':       this.playHover(options); break;
                case 'click':       this.playClick(options); break;
                case 'navigate':    this.playNavigate(options); break;

                // Game Feedback
                case 'pop':         this.playPop(options); break;
                case 'score':       this.playScore(options); break;
                case 'bounce':      this.playBounce(options); break;
                case 'hit':         this.playHit(options); break;
                case 'collect':     this.playCollect(options); break;
                case 'fail':        this.playFail(options); break;

                // Action Sounds
                case 'shoot':       this.playShoot(options); break;
                case 'knife':       this.playKnife(options); break;
                case 'jump':        this.playJump(options); break;
                case 'splash':      this.playSplash(options); break;
                case 'explosion':   this.playExplosion(options); break;

                // Achievement Sounds
                case 'success':     this.playSuccess(options); break;
                case 'levelUp':     this.playLevelUp(options); break;
                case 'powerup':     this.playPowerup(options); break;
                case 'combo':       this.playCombo(options); break;
                case 'gameOver':    this.playGameOver(options); break;
                case 'win':         this.playWin(options); break;

                // Special
                case 'coinCollect': this.playCoinCollect(options); break;
                case 'glitch':      this.playGlitch(options); break;
                case 'laser':       this.playLaser(options); break;
                case 'shield':      this.playShield(options); break;
                case 'recharge':    this.playRecharge(options); break;
                case 'bell':        this.playBell(options); break;

                default:
                    console.warn(`Unknown sound: ${soundName}`);
            }
        } catch (e) {
            console.warn(`Sound play error (${soundName}):`, e);
        }
    }

    // ==================== UI SOUNDS ====================

    playHover(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playClick(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Click body
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'square';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.05);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.1);

        // Click tick
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.type = 'square';
        osc2.frequency.value = 1600;
        gain2.gain.setValueAtTime(0.06, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc2.start(t + 0.02);
        osc2.stop(t + 0.06);
    }

    playNavigate(options = {}) {
        const freqs = [600, 800, 1000];
        freqs.forEach((f, i) => {
            setTimeout(() => {
                const ctx = this.audioContext;
                const t = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.type = 'sine';
                osc.frequency.value = f;
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.12);
            }, i * 60);
        });
    }

    // ==================== GAME FEEDBACK ====================

    playPop(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const pitch = options.pitch || 1;

        // Main pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        filter.type = 'bandpass';
        filter.frequency.value = 800 * pitch;
        filter.Q.value = 1.5;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(200 * pitch, t + 0.12);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.18);

        // Pop burst noise
        this.playNoiseShort(0.06, 0.08, 'highpass', 2000);
    }

    playScore(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1100, t + 0.05);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.setValueAtTime(0.08, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.18);
    }

    playBounce(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const pitch = options.pitch || 1;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.08);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.start(t);
        osc.stop(t + 0.12);
    }

    playHit(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Impact thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const distortion = ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(150);

        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.start(t);
        osc.stop(t + 0.15);

        // Noise component
        this.playNoiseShort(0.06, 0.1, 'lowpass', 800);
    }

    playCollect(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const freqs = [660, 880, 1100, 1320];

        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'sine';
            osc.frequency.value = f;
            const st = t + i * 0.04;
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.1, st + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
            osc.start(st);
            osc.stop(st + 0.12);
        });
    }

    playFail(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Descending fail sound
        const freqs = [400, 300, 220, 180];
        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'sawtooth';
            osc.frequency.value = f;
            const st = t + i * 0.08;
            gain.gain.setValueAtTime(0.12, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
            osc.start(st);
            osc.stop(st + 0.12);
        });
    }

    // ==================== ACTION SOUNDS ====================

    playShoot(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Main shot
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        filter.type = 'highpass';
        filter.frequency.value = 500;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.start(t);
        osc.stop(t + 0.15);

        // Noise burst
        this.playNoiseShort(0.08, 0.12, 'bandpass', 1500, 0.18);
    }

    playKnife(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(500, t + 0.12);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.12);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.setValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.18);

        // Metal ting
        this.playMetalTing(t + 0.05);
    }

    playJump(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'square';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    playSplash(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Water splash filtered noise
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.8;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        gain.gain.setValueAtTime(0.25, t);
        gain.gain.setValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(400, t + 0.3);

        noise.start(t);
        noise.stop(t + 0.35);
    }

    playExplosion(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const intensity = options.intensity || 1;

        // Deep boom
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dist = ctx.createWaveShaper();
        dist.curve = this.makeDistortionCurve(300);

        osc.connect(dist);
        dist.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120 * intensity, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

        gain.gain.setValueAtTime(0.4 * intensity, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.start(t);
        osc.stop(t + 0.45);

        // Noise explosion
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        const nFilter = ctx.createBiquadFilter();
        const nGain = ctx.createGain();

        noise.buffer = buffer;
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(3000, t);
        nFilter.frequency.exponentialRampToValueAtTime(200, t + 0.4);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.sfxGain);

        nGain.gain.setValueAtTime(0.35 * intensity, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        noise.start(t);
        noise.stop(t + 0.5);
    }

    // ==================== ACHIEVEMENT SOUNDS ====================

    playSuccess(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Happy ascending arpeggio
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'square';
            osc.frequency.value = f;
            const st = t + i * 0.08;
            gain.gain.setValueAtTime(0.12, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.15);
            osc.start(st);
            osc.stop(st + 0.18);
        });

        // Shimmer
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (!this.audioContext) return;
                    const ct = this.audioContext.currentTime;
                    const o = this.audioContext.createOscillator();
                    const g = this.audioContext.createGain();
                    o.connect(g);
                    g.connect(this.sfxGain);
                    o.type = 'sine';
                    o.frequency.value = 2000 + i * 400;
                    g.gain.setValueAtTime(0.04, ct);
                    g.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
                    o.start(ct);
                    o.stop(ct + 0.12);
                }, i * 40);
            }
        }, 250);
    }

    playLevelUp(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Epic level up fanfare
        const melody = [
            { f: 523.25, t: 0, d: 0.12 },
            { f: 659.25, t: 0.1, d: 0.12 },
            { f: 783.99, t: 0.2, d: 0.12 },
            { f: 1046.5, t: 0.3, d: 0.25 }
        ];

        melody.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'square';
            osc.frequency.value = note.f;
            const st = t + note.t;
            gain.gain.setValueAtTime(0.15, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + note.d);
            osc.start(st);
            osc.stop(st + note.d + 0.05);
        });

        // Bass hit
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.connect(bassGain);
        bassGain.connect(this.sfxGain);
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(130, t);
        bass.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        bassGain.gain.setValueAtTime(0.2, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        bass.start(t);
        bass.stop(t + 0.4);

        // Shimmer tail
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.audioContext) return;
                const ct = this.audioContext.currentTime;
                const o = this.audioContext.createOscillator();
                const g = this.audioContext.createGain();
                o.connect(g);
                g.connect(this.sfxGain);
                o.type = 'sine';
                o.frequency.value = 1500 + i * 300 + Math.random() * 200;
                g.gain.setValueAtTime(0.05, ct);
                g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
                o.start(ct);
                o.stop(ct + 0.18);
            }, 400 + i * 50);
        }
    }

    playPowerup(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Sparkle sweep
        const notes = [440, 554, 659, 880, 1109];
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t + i * 0.05);
            osc.frequency.exponentialRampToValueAtTime(f * 1.05, t + i * 0.05 + 0.08);
            gain.gain.setValueAtTime(0.1, t + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.12);
            osc.start(t + i * 0.05);
            osc.stop(t + i * 0.05 + 0.15);
        });

        // Magic noise
        this.playNoiseShort(0.2, 0.3, 'highpass', 3000, 0.08);
    }

    playCombo(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const comboLevel = options.level || 1;

        const basePitch = 1 + comboLevel * 0.15;
        const notes = [523, 659, 784, 1047].map(f => f * basePitch);

        notes.slice(0, Math.min(comboLevel + 1, 4)).forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'square';
            osc.frequency.value = f;
            const st = t + i * 0.06;
            gain.gain.setValueAtTime(0.13, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
            osc.start(st);
            osc.stop(st + 0.15);
        });
    }

    playGameOver(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Sad descending melody
        const notes = [
            { f: 523.25, t: 0, d: 0.2 },
            { f: 466.16, t: 0.2, d: 0.2 },
            { f: 415.30, t: 0.4, d: 0.2 },
            { f: 349.23, t: 0.6, d: 0.4 }
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'sawtooth';
            osc.frequency.value = note.f;
            const st = t + note.t;
            gain.gain.setValueAtTime(0.18, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + note.d + 0.05);
            osc.start(st);
            osc.stop(st + note.d + 0.08);
        });

        // Doom bass
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        const bassDist = ctx.createWaveShaper();
        bassDist.curve = this.makeDistortionCurve(100);
        bass.connect(bassDist);
        bassDist.connect(bassGain);
        bassGain.connect(this.sfxGain);
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(100, t);
        bass.frequency.exponentialRampToValueAtTime(55, t + 0.8);
        bassGain.gain.setValueAtTime(0.22, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        bass.start(t);
        bass.stop(t + 1.05);
    }

    playWin(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Victory fanfare
        const melody = [
            { f: 523.25, t: 0, type: 'square' },
            { f: 523.25, t: 0.12, type: 'square' },
            { f: 523.25, t: 0.24, type: 'square' },
            { f: 415.30, t: 0.36, type: 'square' },
            { f: 466.16, t: 0.48, type: 'square' },
            { f: 523.25, t: 0.68, type: 'square' },
            { f: 466.16, t: 0.8, type: 'square' },
            { f: 523.25, t: 0.92, type: 'square' }
        ];

        melody.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = note.type;
            osc.frequency.value = note.f;
            const st = t + note.t;
            gain.gain.setValueAtTime(0.15, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
            osc.start(st);
            osc.stop(st + 0.22);
        });

        // Sparkle cascade
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                if (!this.audioContext) return;
                const ct = this.audioContext.currentTime;
                for (let j = 0; j < 3; j++) {
                    const o = this.audioContext.createOscillator();
                    const g = this.audioContext.createGain();
                    o.connect(g);
                    g.connect(this.sfxGain);
                    o.type = 'sine';
                    o.frequency.value = 1000 + Math.random() * 2000;
                    g.gain.setValueAtTime(0.04, ct);
                    g.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
                    o.start(ct);
                    o.stop(ct + 0.12);
                }
            }, i * 120);
        }
    }

    // ==================== SPECIAL SOUNDS ====================

    playCoinCollect(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(988, t);
        osc.frequency.setValueAtTime(1319, t + 0.06);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.setValueAtTime(0.18, t + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.start(t);
        osc.stop(t + 0.22);

        // Sparkle
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.type = 'sine';
        osc2.frequency.value = 2637;
        gain2.gain.setValueAtTime(0.06, t + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc2.start(t + 0.08);
        osc2.stop(t + 0.2);
    }

    playGlitch(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const dist = ctx.createWaveShaper();
            dist.curve = this.makeDistortionCurve(200);

            osc.connect(dist);
            dist.connect(gain);
            gain.connect(this.sfxGain);

            osc.type = 'sawtooth';
            osc.frequency.value = 100 + Math.random() * 2000;

            const st = t + i * 0.04 + Math.random() * 0.02;
            gain.gain.setValueAtTime(0.08, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.05);
            osc.start(st);
            osc.stop(st + 0.07);
        }

        this.playNoiseShort(0.1, 0.15, 'bandpass', 1500, 0.1);
    }

    playLaser(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        filter.type = 'highpass';
        filter.frequency.value = 1000;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.15);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    playShield(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Energy hum
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(400, t + 0.2);
        osc.frequency.linearRampToValueAtTime(300, t + 0.4);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.55);

        // Shield ping
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.type = 'sine';
        osc2.frequency.value = 1200;
        gain2.gain.setValueAtTime(0.15, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc2.start(t);
        osc2.stop(t + 0.45);
    }

    playRecharge(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        // Energy charging sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.5);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t);
        osc.stop(t + 0.6);

        // Final ping
        setTimeout(() => {
            if (!this.audioContext) return;
            const ct = this.audioContext.currentTime;
            const o = this.audioContext.createOscillator();
            const g = this.audioContext.createGain();
            o.connect(g);
            g.connect(this.sfxGain);
            o.type = 'sine';
            o.frequency.value = 1760;
            g.gain.setValueAtTime(0.15, ct);
            g.gain.exponentialRampToValueAtTime(0.001, ct + 0.3);
            o.start(ct);
            o.stop(ct + 0.35);
        }, 500);
    }

    playBell(options = {}) {
        const ctx = this.audioContext;
        const t = ctx.currentTime;
        const freq = options.freq || 880;

        // Bell fundamental
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        osc.start(t);
        osc.stop(t + 1.6);

        // Bell harmonics
        [2, 3, 4.2, 5.4].forEach((mult, i) => {
            const harmOsc = ctx.createOscillator();
            const harmGain = ctx.createGain();
            harmOsc.connect(harmGain);
            harmGain.connect(this.sfxGain);
            harmOsc.type = 'sine';
            harmOsc.frequency.value = freq * mult;
            harmGain.gain.setValueAtTime(0.08 / (i + 1), t);
            harmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 / (i + 1));
            harmOsc.start(t);
            harmOsc.stop(t + 1.0);
        });
    }

    // ==================== BACKGROUND MUSIC ====================

    startMusic(type = 'menu') {
        if (!this.enabled || !this.audioContext || this.musicPlaying) return;
        this.resume();

        switch (type) {
            case 'menu': this.playMenuMusic(); break;
            case 'game': this.playGameMusic(); break;
            case 'intense': this.playIntenseMusic(); break;
        }

        this.musicPlaying = true;
    }

    playMenuMusic() {
        const ctx = this.audioContext;
        if (!ctx) return;

        const startTime = ctx.currentTime;
        const tempo = 0.5; // seconds per beat
        const notes = [
            261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25
        ];

        let beatTime = startTime;
        const scheduledOscillators = [];

        const schedule = () => {
            if (!this.musicPlaying || this.destroyed) return;

            // Ambient pad
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 800;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);

                osc.type = 'sine';
                osc.frequency.value = notes[i % notes.length] * 0.5;

                const t = beatTime + i * tempo * 0.5;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.04, t + 0.2);
                gain.gain.linearRampToValueAtTime(0.02, t + 0.6);
                gain.gain.linearRampToValueAtTime(0, t + tempo * 0.5);

                osc.start(t);
                osc.stop(t + tempo * 0.6);
                scheduledOscillators.push(osc);
            }

            beatTime += tempo * 4;

            // Schedule next loop
            this.musicLoop = setTimeout(schedule, tempo * 4 * 1000 - 100);
        };

        schedule();
        this.stopMusicFn = () => {
            clearTimeout(this.musicLoop);
            scheduledOscillators.forEach(osc => {
                try { osc.stop(ctx.currentTime + 0.5); } catch (e) {}
            });
        };
    }

    playGameMusic() {
        const ctx = this.audioContext;
        if (!ctx) return;

        const tempo = 0.25; // Faster for gameplay
        let beat = 0;
        let beatTime = ctx.currentTime;

        // Drum pattern
        const pattern = [1, 0, 0, 1, 0, 1, 0, 0];

        const scheduledNodes = [];

        const schedule = () => {
            if (!this.musicPlaying) return;

            for (let i = 0; i < 8; i++) {
                const t = beatTime + i * tempo;

                // Kick
                if (pattern[i]) {
                    const kick = this.createKickDrum(t);
                    scheduledNodes.push(kick);
                }

                // Hi-hat
                if (i % 2 === 1) {
                    this.createHiHat(t);
                }

                // Bass line
                const bassNotes = [55, 55, 65.41, 55];
                const bassOsc = ctx.createOscillator();
                const bassGain = ctx.createGain();
                bassOsc.connect(bassGain);
                bassGain.connect(this.musicGain);
                bassOsc.type = 'sawtooth';
                bassOsc.frequency.value = bassNotes[i % 4];
                bassGain.gain.setValueAtTime(0, t);
                bassGain.gain.linearRampToValueAtTime(0.05, t + 0.02);
                bassGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.8);
                bassOsc.start(t);
                bassOsc.stop(t + tempo);
                scheduledNodes.push(bassOsc);
            }

            beatTime += tempo * 8;
            this.musicLoop = setTimeout(schedule, tempo * 8 * 1000 - 50);
        };

        schedule();

        this.stopMusicFn = () => {
            clearTimeout(this.musicLoop);
            scheduledNodes.forEach(n => {
                try { n.stop(ctx.currentTime + 0.3); } catch (e) {}
            });
        };
    }

    playIntenseMusic() {
        const ctx = this.audioContext;
        if (!ctx) return;

        const tempo = 0.18;
        let beatTime = ctx.currentTime;
        const scheduledNodes = [];

        const schedule = () => {
            if (!this.musicPlaying) return;

            for (let i = 0; i < 16; i++) {
                const t = beatTime + i * tempo;

                // Fast kick
                if (i % 4 === 0 || i % 4 === 2) {
                    const kick = this.createKickDrum(t);
                    scheduledNodes.push(kick);
                }

                // Snare
                if (i % 8 === 4) {
                    this.createSnare(t);
                }

                // Hi-hat
                if (i % 2 === 1) this.createHiHat(t, 0.5);

                // Lead synth
                const leadFreqs = [220, 246.94, 261.63, 246.94, 220, 196, 174.61, 196];
                const leadOsc = ctx.createOscillator();
                const leadGain = ctx.createGain();
                const leadFilter = ctx.createBiquadFilter();
                leadFilter.type = 'lowpass';
                leadFilter.frequency.value = 1200;
                leadOsc.connect(leadFilter);
                leadFilter.connect(leadGain);
                leadGain.connect(this.musicGain);
                leadOsc.type = 'square';
                leadOsc.frequency.value = leadFreqs[i % 8] * 2;
                leadGain.gain.setValueAtTime(0, t);
                leadGain.gain.linearRampToValueAtTime(0.04, t + 0.01);
                leadGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.9);
                leadOsc.start(t);
                leadOsc.stop(t + tempo);
                scheduledNodes.push(leadOsc);
            }

            beatTime += tempo * 16;
            this.musicLoop = setTimeout(schedule, tempo * 16 * 1000 - 50);
        };

        schedule();
        this.stopMusicFn = () => {
            clearTimeout(this.musicLoop);
            scheduledNodes.forEach(n => {
                try { n.stop(ctx.currentTime + 0.3); } catch (e) {}
            });
        };
    }

    stopMusic(fadeOut = true) {
        if (!this.musicPlaying) return;
        this.musicPlaying = false;
        clearTimeout(this.musicLoop);

        if (fadeOut && this.musicGain) {
            const ctx = this.audioContext;
            const t = ctx.currentTime;
            this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
            this.musicGain.gain.linearRampToValueAtTime(0, t + 0.5);
            setTimeout(() => {
                if (this.stopMusicFn) this.stopMusicFn();
                if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
            }, 600);
        } else {
            if (this.stopMusicFn) this.stopMusicFn();
        }
    }

    // ==================== DRUM MACHINES ====================

    createKickDrum(t) {
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dist = ctx.createWaveShaper();
        dist.curve = this.makeDistortionCurve(80);

        osc.connect(dist);
        dist.connect(gain);
        gain.connect(this.musicGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.18);
        return osc;
    }

    createHiHat(t, volume = 1) {
        const ctx = this.audioContext;
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        gain.gain.setValueAtTime(0.04 * volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        noise.start(t);
        noise.stop(t + 0.06);
        return noise;
    }

    createSnare(t) {
        const ctx = this.audioContext;

        // Tone component
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.musicGain);
        osc.type = 'triangle';
        osc.frequency.value = 200;
        oscGain.gain.setValueAtTime(0.08, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.12);

        // Noise component
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 3000;
        filter.Q.value = 0.5;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        noise.start(t);
        noise.stop(t + 0.15);
    }

    // ==================== HELPER METHODS ====================

    playNoiseShort(duration, decayTime, filterType, filterFreq, volume = 0.15) {
        if (!this.audioContext) return;
        const ctx = this.audioContext;
        const t = ctx.currentTime;

        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = buffer;
        filter.type = filterType;
        filter.frequency.value = filterFreq;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decayTime);

        noise.start(t);
        noise.stop(t + decayTime + 0.02);
    }

    playMetalTing(t) {
        if (!this.audioContext) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'sine';
        osc.frequency.value = 2500;
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.35);
    }

    makeDistortionCurve(amount) {
        const samples = 256;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    // ==================== CONTROLS ====================

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            if (this.masterGain) this.masterGain.gain.value = 0;
            this.stopMusic(false);
        } else {
            if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
        }
        return this.enabled;
    }

    setMasterVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && this.enabled) {
            this.masterGain.gain.value = this.masterVolume;
        }
    }

    setSFXVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    }

    toggleReverb() {
        this.reverbEnabled = !this.reverbEnabled;
        if (this.reverbNode) {
            this.reverbNode.gain.value = this.reverbEnabled ? 0.15 : 0;
        }
        return this.reverbEnabled;
    }

    destroy() {
        this.enabled = false;
        this.stopMusic(false);
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// ==================== INIT ====================
window.audioManager = new AudioManager();

// Auto-start menu music on first interaction
let musicStarted = false;
const startMenuMusic = () => {
    if (!musicStarted && window.audioManager) {
        musicStarted = true;
        window.audioManager.startMusic('menu');
    }
};

document.addEventListener('click', startMenuMusic, { once: true });
document.addEventListener('touchstart', startMenuMusic, { once: true });