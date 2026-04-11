// ============================================================
// NEONARCADE - PREMIUM MAIN.JS v3.0
// Full Khatarnak Upgrade - Achievement, Profile, Analytics
// ============================================================

'use strict';

// ============================================================
// 1. GAMES DATA - Extended with more metadata
// ============================================================

const gamesData = [
    {
        id: 'bubble-shooter',
        name: 'Bubble Shooter',
        icon: '🫧',
        category: 'puzzle',
        description: 'Pop colorful bubbles by matching 3 or more!',
        rating: 4.8,
        plays: 15420,
        difficulty: 'Easy',
        tags: ['bubble', 'color', 'match'],
        instructions: 'Aim and shoot bubbles to match 3 or more of the same color. Clear the board to win!',
        color: '#00f5ff'
    },
    {
        id: 'liquid-sort',
        name: 'Liquid Sort Puzzle',
        icon: '🧪',
        category: 'puzzle',
        description: 'Sort colored liquids into matching tubes.',
        rating: 4.7,
        plays: 12300,
        difficulty: 'Medium',
        tags: ['sort', 'logic', 'color'],
        instructions: 'Click a tube to select it, then click another to pour. Sort all colors into separate tubes.',
        color: '#bc13fe'
    },
    {
        id: 'knife-hit',
        name: 'Knife Hit',
        icon: '🔪',
        category: 'action',
        description: 'Throw knives at the spinning target!',
        rating: 4.6,
        plays: 18900,
        difficulty: 'Hard',
        tags: ['knife', 'aim', 'reflex'],
        instructions: 'Click or tap to throw knives at the rotating target. Don\'t hit other knives!',
        color: '#ff6b35'
    },
    {
        id: 'color-bump',
        name: 'Color Bump',
        icon: '🔴',
        category: 'action',
        description: 'Bump balls of your color, avoid others!',
        rating: 4.5,
        plays: 9800,
        difficulty: 'Medium',
        tags: ['bump', 'color', 'dodge'],
        instructions: 'Drag your ball to bump same-colored balls off the screen. Avoid different colors!',
        color: '#fe2254'
    },
    {
        id: 'bottle-shooting',
        name: 'Bottle Shooting',
        icon: '🎯',
        category: 'action',
        description: 'Test your aim by shooting bottles!',
        rating: 4.4,
        plays: 7600,
        difficulty: 'Easy',
        tags: ['shoot', 'aim', 'target'],
        instructions: 'Click to shoot and break all the bottles. Aim carefully for bonus points!',
        color: '#39ff14'
    },
    {
        id: 'color-up',
        name: 'Color Up',
        icon: '🎨',
        category: 'puzzle',
        description: 'Match colors to climb higher!',
        rating: 4.5,
        plays: 11200,
        difficulty: 'Medium',
        tags: ['color', 'climb', 'match'],
        instructions: 'Tap to change your color and pass through matching gates. Go as high as possible!',
        color: '#ffff00'
    },
    {
        id: 'flappy-bird',
        name: 'Flappy Bird',
        icon: '🐦',
        category: 'arcade',
        description: 'The classic game - fly through pipes!',
        rating: 4.9,
        plays: 45000,
        difficulty: 'Hard',
        tags: ['fly', 'classic', 'pipe'],
        instructions: 'Click or tap to flap. Navigate through the pipes without hitting them!',
        color: '#00f5ff'
    },
    {
        id: 'space-invaders',
        name: 'Space Invaders',
        icon: '👾',
        category: 'arcade',
        description: 'Defend Earth from alien invasion!',
        rating: 4.7,
        plays: 32000,
        difficulty: 'Medium',
        tags: ['space', 'shoot', 'alien'],
        instructions: 'Use arrow keys to move, spacebar to shoot. Destroy all aliens before they reach you!',
        color: '#bc13fe'
    },
    {
        id: 'snake-neon',
        name: 'Neon Snake',
        icon: '🐍',
        category: 'arcade',
        description: 'Classic snake with a neon twist!',
        rating: 4.6,
        plays: 28000,
        difficulty: 'Easy',
        tags: ['snake', 'classic', 'neon'],
        instructions: 'Use arrow keys or WASD to control the snake. Eat food to grow, avoid walls and yourself!',
        color: '#39ff14'
    },
    {
        id: 'breakout',
        name: 'Neon Breakout',
        icon: '🧱',
        category: 'arcade',
        description: 'Break all the bricks with style!',
        rating: 4.5,
        plays: 21000,
        difficulty: 'Medium',
        tags: ['breakout', 'brick', 'paddle'],
        instructions: 'Move the paddle with mouse or touch. Break all bricks to complete each level!',
        color: '#ff6b35'
    }
];

// ============================================================
// 2. ACHIEVEMENTS SYSTEM
// ============================================================

const achievementsConfig = [
    {
        id: 'first_game',
        name: 'First Step',
        description: 'Play your first game',
        icon: '🎮',
        condition: (stats) => stats.totalGamesPlayed >= 1
    },
    {
        id: 'score_100',
        name: 'Century',
        description: 'Score 100+ in any game',
        icon: '💯',
        condition: (stats) => stats.highestScore >= 100
    },
    {
        id: 'score_1000',
        name: 'High Roller',
        description: 'Score 1000+ in any game',
        icon: '🏆',
        condition: (stats) => stats.highestScore >= 1000
    },
    {
        id: 'play_5_games',
        name: 'Explorer',
        description: 'Play 5 different games',
        icon: '🗺️',
        condition: (stats) => Object.keys(stats.gamesPlayed || {}).length >= 5
    },
    {
        id: 'play_all_games',
        name: 'Master Gamer',
        description: 'Play all 10 games',
        icon: '👑',
        condition: (stats) => Object.keys(stats.gamesPlayed || {}).length >= 10
    },
    {
        id: 'play_10_sessions',
        name: 'Dedicated',
        description: 'Play 10 gaming sessions',
        icon: '⚡',
        condition: (stats) => stats.totalGamesPlayed >= 10
    },
    {
        id: 'play_50_sessions',
        name: 'Addicted',
        description: 'Play 50 gaming sessions',
        icon: '🔥',
        condition: (stats) => stats.totalGamesPlayed >= 50
    },
    {
        id: 'favorite_added',
        name: 'Collector',
        description: 'Add a game to favorites',
        icon: '❤️',
        condition: (stats) => (stats.favorites || []).length >= 1
    },
    {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Play after midnight',
        icon: '🦉',
        condition: (stats) => stats.playedAtNight === true
    },
    {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Start 3 games in under 1 minute',
        icon: '💨',
        condition: (stats) => stats.speedRuns >= 3
    }
];

// ============================================================
// 3. STATE MANAGEMENT - Upgraded
// ============================================================

const state = {
    currentPage: 'home',
    currentGame: null,
    gameInstance: null,
    soundEnabled: true,
    musicEnabled: false,
    currentTheme: localStorage.getItem('neonarcade_theme') || 'cyber',
    scores: JSON.parse(localStorage.getItem('neonarcade_scores') || '{}'),
    favorites: JSON.parse(localStorage.getItem('neonarcade_favorites') || '[]'),
    achievements: JSON.parse(localStorage.getItem('neonarcade_achievements') || '[]'),
    searchQuery: '',
    activeFilter: 'all',
    isLoading: false,
    gameStartTime: null,
    sessionStartTime: Date.now(),
    toastQueue: [],
    isToastShowing: false,
    particleSystem: null,
    performanceMode: false,
    analytics: JSON.parse(localStorage.getItem('neonarcade_analytics') || JSON.stringify({
        totalGamesPlayed: 0,
        totalPlayTime: 0,
        highestScore: 0,
        gamesPlayed: {},
        favorites: [],
        playedAtNight: false,
        speedRuns: 0,
        lastPlayed: null,
        sessions: 0,
        scoreHistory: []
    }))
};

// ============================================================
// 4. LEADERBOARD DATA
// ============================================================

let leaderboardData = {
    all: [
        { name: 'NeonMaster', game: 'Flappy Bird', score: 156, avatar: '🎮' },
        { name: 'ArcadeKing', game: 'Space Invaders', score: 12500, avatar: '👑' },
        { name: 'PuzzleWiz', game: 'Liquid Sort', score: 980, avatar: '🧩' },
        { name: 'BubblePro', game: 'Bubble Shooter', score: 8750, avatar: '🫧' },
        { name: 'SnakeCharmer', game: 'Neon Snake', score: 425, avatar: '🐍' },
        { name: 'BrickBreaker', game: 'Breakout', score: 15600, avatar: '🧱' },
        { name: 'KnifeThrower', game: 'Knife Hit', score: 89, avatar: '🔪' },
        { name: 'ColorMaster', game: 'Color Bump', score: 340, avatar: '🎨' },
        { name: 'SharpShooter', game: 'Bottle Shooting', score: 2800, avatar: '🎯' },
        { name: 'HighFlyer', game: 'Color Up', score: 156, avatar: '✈️' }
    ]
};

// ============================================================
// 5. THEMES CONFIG
// ============================================================

const themes = {
    cyber: {
        name: 'Cyberpunk',
        primary: '#00f5ff',
        secondary: '#bc13fe',
        accent: '#ff6b35',
        bg: '#0a0a0f'
    },
    matrix: {
        name: 'Matrix',
        primary: '#39ff14',
        secondary: '#00ff41',
        accent: '#008f11',
        bg: '#0d0208'
    },
    sunset: {
        name: 'Sunset',
        primary: '#ff6b35',
        secondary: '#fe2254',
        accent: '#ffff00',
        bg: '#0f0a0a'
    },
    ocean: {
        name: 'Ocean',
        primary: '#00b4d8',
        secondary: '#0077b6',
        accent: '#90e0ef',
        bg: '#03045e'
    }
};

// ============================================================
// 6. DOM ELEMENTS CACHE
// ============================================================

const elements = {};

// ============================================================
// 7. INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements
    cacheElements();

    // Boot sequence
    simulateLoading();
    initTheme();
    initNavigation();
    initMobileMenu();
    initSoundToggle();
    initGameControls();
    initSearch();
    initParticleSystem();
    renderGames();
    renderLeaderboard();
    renderAchievements();
    renderProfile();
    animateStats();
    initKeyboardShortcuts();
    initPageTransitions();
    updateAnalytics('session_start');
    checkNightOwl();

    // Performance monitoring
    if (localStorage.getItem('neonarcade_perf') === 'true') {
        state.performanceMode = true;
        initPerformanceMonitor();
    }

    console.log(
        '%c🎮 NeonArcade v3.0 PREMIUM',
        'color: #00f5ff; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #00f5ff;'
    );
    console.log(
        '%cKhatarnak Gaming Experience Loaded!',
        'color: #bc13fe; font-size: 14px;'
    );
});

// ============================================================
// 8. ELEMENT CACHING
// ============================================================

function cacheElements() {
    const ids = [
        'loading-screen', 'app', 'hamburger', 'mobile-menu',
        'sound-toggle', 'featured-games', 'games-grid',
        'leaderboard-content', 'game-canvas', 'game-overlay',
        'game-score', 'current-game-title', 'game-instructions',
        'overlay-title', 'overlay-score', 'back-to-games',
        'pause-btn', 'restart-btn', 'resume-btn', 'overlay-restart-btn'
    ];

    ids.forEach(id => {
        const camelId = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        elements[camelId] = document.getElementById(id);
    });

    // Optional elements (ho sakte hain page mein na ho)
    elements.searchInput = document.getElementById('game-search');
    elements.achievementsGrid = document.getElementById('achievements-grid');
    elements.profileStats = document.getElementById('profile-stats');
    elements.themeSelector = document.getElementById('theme-selector');
    elements.fpsCounter = document.getElementById('fps-counter');
    elements.toastContainer = document.getElementById('toast-container');
    elements.musicToggle = document.getElementById('music-toggle');
    elements.progressBar = document.getElementById('game-progress');
    elements.livesDisplay = document.getElementById('game-lives');
    elements.levelDisplay = document.getElementById('game-level');
    elements.favoriteBtn = document.getElementById('favorite-btn');
}

// ============================================================
// 9. LOADING SCREEN - Premium version
// ============================================================

function simulateLoading() {
    const progressBar = document.querySelector('.loading-bar-fill');
    const loadingText = document.querySelector('.loading-text');
    const tips = [
        'Loading neon lights...',
        'Charging laser cannons...',
        'Warming up the arcade...',
        'Calibrating game physics...',
        'Almost there...'
    ];

    let progress = 0;
    let tipIndex = 0;

    if (loadingText) loadingText.textContent = tips[0];

    const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;

        if (progress > 100) progress = 100;

        if (progressBar) progressBar.style.width = `${progress}%`;

        // Tip update karo
        const newTipIndex = Math.floor((progress / 100) * tips.length);
        if (newTipIndex !== tipIndex && newTipIndex < tips.length) {
            tipIndex = newTipIndex;
            if (loadingText) {
                loadingText.style.opacity = '0';
                setTimeout(() => {
                    if (loadingText) {
                        loadingText.textContent = tips[tipIndex];
                        loadingText.style.opacity = '1';
                    }
                }, 200);
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                elements.loadingScreen.classList.add('fade-out');
                elements.app.classList.remove('hidden');
                setTimeout(() => {
                    elements.app.classList.add('visible');
                    elements.loadingScreen.style.display = 'none';
                    showToast('🎮 Welcome to NeonArcade!', 'success');
                }, 500);
            }, 400);
        }
    }, 120);
}

// ============================================================
// 10. THEME SYSTEM
// ============================================================

function initTheme() {
    applyTheme(state.currentTheme);

    // Theme selector agar DOM mein hai
    if (elements.themeSelector) {
        // Themes populate karo
        elements.themeSelector.innerHTML = Object.entries(themes).map(([key, theme]) =>
            `<button class="theme-btn ${key === state.currentTheme ? 'active' : ''}"
                     data-theme="${key}"
                     style="--theme-color: ${theme.primary}"
                     title="${theme.name}">
                <span class="theme-dot"></span>
                <span class="theme-name">${theme.name}</span>
            </button>`
        ).join('');

        elements.themeSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.theme-btn');
            if (!btn) return;
            const themeName = btn.dataset.theme;
            applyTheme(themeName);
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showToast(`🎨 Theme changed to ${themes[themeName].name}`, 'info');
        });
    }
}

function applyTheme(themeName) {
    const theme = themes[themeName] || themes.cyber;
    state.currentTheme = themeName;
    localStorage.setItem('neonarcade_theme', themeName);

    const root = document.documentElement;
    root.style.setProperty('--neon-blue', theme.primary);
    root.style.setProperty('--neon-purple', theme.secondary);
    root.style.setProperty('--neon-orange', theme.accent);
    root.style.setProperty('--bg-primary', theme.bg);

    document.body.setAttribute('data-theme', themeName);
}

// ============================================================
// 11. NAVIGATION - Premium with transitions
// ============================================================

function initNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
            if (window.audioManager) audioManager.play('click');
        });
    });

    if (elements.backToGames) {
        elements.backToGames.addEventListener('click', () => {
            if (state.gameInstance) {
                state.gameInstance.destroy();
                state.gameInstance = null;
            }
            saveGameSession();
            navigateTo('games');
            if (window.audioManager) audioManager.play('click');
        });
    }

    // Browser back button support
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
            navigateTo(e.state.page, false);
        }
    });
}

function navigateTo(page, pushHistory = true) {
    // Page validation
    const validPages = ['home', 'games', 'leaderboard', 'achievements', 'profile', 'game'];
    if (!validPages.includes(page)) return;

    // Current page se transition
    const currentEl = document.querySelector('.page.active');
    if (currentEl) currentEl.classList.add('page-exit');

    setTimeout(() => {
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active', 'page-exit', 'page-enter');
        });

        const targetEl = document.getElementById(`${page}-page`);
        if (targetEl) {
            targetEl.classList.add('active', 'page-enter');
            setTimeout(() => targetEl.classList.remove('page-enter'), 400);
        }

        // Nav links update karo
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) link.classList.add('active');
        });

        elements.mobileMenu?.classList.remove('active');
        elements.hamburger?.classList.remove('active');

        state.currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Page-specific actions
        if (page === 'leaderboard') updateLeaderboardWithMyScores();
        if (page === 'achievements') checkAllAchievements();
        if (page === 'profile') renderProfile();

        if (pushHistory) {
            history.pushState({ page }, '', `#${page}`);
        }
    }, 150);
}

// ============================================================
// 12. MOBILE MENU
// ============================================================

function initMobileMenu() {
    if (!elements.hamburger || !elements.mobileMenu) return;

    elements.hamburger.addEventListener('click', () => {
        elements.hamburger.classList.toggle('active');
        elements.mobileMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Outside click se close karo
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar') && elements.mobileMenu?.classList.contains('active')) {
            elements.mobileMenu.classList.remove('active');
            elements.hamburger?.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

// ============================================================
// 13. SOUND SYSTEM
// ============================================================

function initSoundToggle() {
    if (!elements.soundToggle) return;

    elements.soundToggle.addEventListener('click', () => {
        state.soundEnabled = window.audioManager ? audioManager.toggle() : !state.soundEnabled;
        localStorage.setItem('neonarcade_sound', state.soundEnabled);

        const onEl = elements.soundToggle.querySelector('.sound-on');
        const offEl = elements.soundToggle.querySelector('.sound-off');
        if (onEl) onEl.classList.toggle('hidden', !state.soundEnabled);
        if (offEl) offEl.classList.toggle('hidden', state.soundEnabled);

        showToast(state.soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF', 'info');
    });

    // Music toggle
    if (elements.musicToggle) {
        elements.musicToggle.addEventListener('click', () => {
            state.musicEnabled = !state.musicEnabled;
            if (window.audioManager) {
                state.musicEnabled ? audioManager.startMusic() : audioManager.stopMusic();
            }
            elements.musicToggle.classList.toggle('active', state.musicEnabled);
            showToast(state.musicEnabled ? '🎵 Music ON' : '🎵 Music OFF', 'info');
        });
    }
}

// ============================================================
// 14. SEARCH FUNCTIONALITY - Premium
// ============================================================

function initSearch() {
    if (!elements.searchInput) return;

    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            filterAndRenderGames();
        }, 300);
    });

    // Search clear button
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            filterAndRenderGames();
        });
    }
}

// ============================================================
// 15. GAME CONTROLS
// ============================================================

function initGameControls() {
    if (elements.pauseBtn) {
        elements.pauseBtn.addEventListener('click', () => {
            if (state.gameInstance?.togglePause) {
                const paused = state.gameInstance.togglePause();
                showOverlay(paused ? 'PAUSED' : null);
                elements.pauseBtn.innerHTML = paused
                    ? '<span>▶️</span>'
                    : '<span>⏸️</span>';
            }
        });
    }

    if (elements.restartBtn) {
        elements.restartBtn.addEventListener('click', () => {
            restartGame();
            if (window.audioManager) audioManager.play('click');
        });
    }

    if (elements.resumeBtn) {
        elements.resumeBtn.addEventListener('click', () => {
            if (state.gameInstance?.togglePause) state.gameInstance.togglePause();
            hideOverlay();
            elements.pauseBtn.innerHTML = '<span>⏸️</span>';
        });
    }

    if (elements.overlayRestartBtn) {
        elements.overlayRestartBtn.addEventListener('click', () => {
            restartGame();
            if (window.audioManager) audioManager.play('click');
        });
    }

    // Favorite button
    if (elements.favoriteBtn) {
        elements.favoriteBtn.addEventListener('click', () => {
            toggleFavorite(state.currentGame);
        });
    }

    // Share score button
    const shareBtn = document.getElementById('share-score-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareScore());
    }
}

// ============================================================
// 16. KEYBOARD SHORTCUTS
// ============================================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Game mein hain toh shortcuts block karo (except Escape)
        if (state.currentPage === 'game' && e.key !== 'Escape') return;

        switch(e.key) {
            case 'Escape':
                if (state.currentPage === 'game') {
                    if (state.gameInstance?.togglePause) state.gameInstance.togglePause();
                    if (elements.gameOverlay?.classList.contains('hidden')) {
                        showOverlay('PAUSED');
                    } else {
                        hideOverlay();
                    }
                }
                break;
            case '1':
                navigateTo('home');
                break;
            case '2':
                navigateTo('games');
                break;
            case '3':
                navigateTo('leaderboard');
                break;
            case '4':
                navigateTo('achievements');
                break;
            case '5':
                navigateTo('profile');
                break;
            case 'm':
            case 'M':
                if (!e.ctrlKey && !e.altKey) {
                    state.soundEnabled = !state.soundEnabled;
                    showToast(state.soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF', 'info');
                }
                break;
            case '/':
                if (e.ctrlKey && elements.searchInput) {
                    e.preventDefault();
                    elements.searchInput.focus();
                    navigateTo('games');
                }
                break;
        }
    });
}

// ============================================================
// 17. PAGE TRANSITIONS
// ============================================================

function initPageTransitions() {
    // CSS se handle hoga mostly, par JS se bhi kuch add karte hain
    document.querySelectorAll('.page').forEach(page => {
        page.addEventListener('animationend', () => {
            page.classList.remove('page-enter', 'page-exit');
        });
    });
}

// ============================================================
// 18. PARTICLE SYSTEM - Background particles
// ============================================================

function initParticleSystem() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const PARTICLE_COUNT = window.innerWidth < 768 ? 30 : 60;

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = -Math.random() * 0.5 - 0.2;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.color = ['#00f5ff', '#bc13fe', '#ff6b35', '#39ff14'][Math.floor(Math.random() * 4)];
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.opacity -= 0.001;

            if (this.y < -10 || this.opacity <= 0) this.reset();
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Particles initialize karo
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        state.particleSystem = requestAnimationFrame(animate);
    }

    // Performance mode mein particles skip karo
    if (!state.performanceMode) animate();

    // Resize handle karo
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// ============================================================
// 19. GAME RENDERING - Premium cards
// ============================================================

function renderGames() {
    renderFeaturedGames();
    renderGamesGrid();
    initFilterButtons();
    initGameCardEvents();
}

function renderFeaturedGames() {
    if (!elements.featuredGames) return;

    const featured = gamesData
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 4);

    elements.featuredGames.innerHTML = featured.map(g => createFeaturedCard(g)).join('');
}

function createFeaturedCard(game) {
    const isFav = state.favorites.includes(game.id);
    const myScore = state.scores[game.id] || 0;

    return `
        <div class="game-card featured-card" data-game-id="${game.id}" data-category="${game.category}"
             style="--game-color: ${game.color}">
            <div class="game-card-badge">🔥 Hot</div>
            <button class="fav-btn ${isFav ? 'active' : ''}"
                    data-game-id="${game.id}"
                    aria-label="Favorite">
                ${isFav ? '❤️' : '🤍'}
            </button>
            <div class="game-card-image"
                 style="text-shadow: 0 0 20px ${game.color}">
                ${game.icon}
            </div>
            <div class="game-card-content">
                <div class="game-card-meta">
                    <span class="game-card-category">${game.category}</span>
                    <span class="game-difficulty difficulty-${game.difficulty.toLowerCase()}">${game.difficulty}</span>
                </div>
                <h3 class="game-card-title">${game.name}</h3>
                <p class="game-card-description">${game.description}</p>
                <div class="game-card-stats">
                    <span class="game-plays">👥 ${formatNumber(game.plays)}</span>
                    ${myScore > 0 ? `<span class="game-my-score">🏆 ${myScore.toLocaleString()}</span>` : ''}
                </div>
                <div class="game-card-footer">
                    <div class="game-card-rating">
                        ${'⭐'.repeat(Math.round(game.rating))}
                        <span>${game.rating}</span>
                    </div>
                    <button class="play-btn" data-game-id="${game.id}">
                        <span>▶</span> Play Now
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createGameCard(game) {
    const isFav = state.favorites.includes(game.id);
    const myScore = state.scores[game.id] || 0;
    const isNew = game.plays < 10000;

    return `
        <div class="game-card" data-game-id="${game.id}" data-category="${game.category}"
             data-tags="${game.tags.join(',')}"
             style="--game-color: ${game.color}">
            ${isNew ? '<div class="game-card-badge new-badge">✨ New</div>' : ''}
            <button class="fav-btn ${isFav ? 'active' : ''}"
                    data-game-id="${game.id}"
                    aria-label="Add to favorites">
                ${isFav ? '❤️' : '🤍'}
            </button>
            <div class="game-card-image"
                 style="text-shadow: 0 0 20px ${game.color}">
                ${game.icon}
            </div>
            <div class="game-card-content">
                <div class="game-card-meta">
                    <span class="game-card-category">${game.category}</span>
                    <span class="game-difficulty difficulty-${game.difficulty.toLowerCase()}">${game.difficulty}</span>
                </div>
                <h3 class="game-card-title">${game.name}</h3>
                <p class="game-card-description">${game.description}</p>
                ${myScore > 0 ? `
                    <div class="game-high-score">
                        <span>Your Best:</span>
                        <strong>${myScore.toLocaleString()}</strong>
                    </div>
                ` : ''}
                <div class="game-card-footer">
                    <div class="game-card-rating">⭐ ${game.rating}</div>
                    <button class="play-btn" data-game-id="${game.id}">
                        ▶ Play
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderGamesGrid() {
    if (!elements.gamesGrid) return;
    elements.gamesGrid.innerHTML = gamesData.map(g => createGameCard(g)).join('');
    initGameCardEvents();
}

function initGameCardEvents() {
    // Play buttons
    document.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameId = btn.dataset.gameId;
            if (gameId) openGame(gameId);
        });
    });

    // Card click
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.fav-btn') && !e.target.closest('.play-btn')) {
                openGame(card.dataset.gameId);
            }
        });

        // Hover sound
        card.addEventListener('mouseenter', () => {
            if (window.audioManager && state.soundEnabled) {
                audioManager.play('hover');
            }
        });
    });

    // Favorite buttons
    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.gameId);
        });
    });
}

function initFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilter = btn.dataset.filter;
            filterAndRenderGames();
        });
    });
}

// ============================================================
// 20. FILTER & SEARCH - Combined
// ============================================================

function filterAndRenderGames() {
    const cards = document.querySelectorAll('#games-grid .game-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const category = card.dataset.category;
        const tags = (card.dataset.tags || '').toLowerCase();
        const title = card.querySelector('.game-card-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.game-card-description')?.textContent.toLowerCase() || '';

        const matchesFilter = state.activeFilter === 'all' ||
            category === state.activeFilter ||
            (state.activeFilter === 'favorites' && state.favorites.includes(card.dataset.gameId));

        const matchesSearch = !state.searchQuery ||
            title.includes(state.searchQuery) ||
            desc.includes(state.searchQuery) ||
            tags.includes(state.searchQuery) ||
            category.includes(state.searchQuery);

        if (matchesFilter && matchesSearch) {
            card.style.display = '';
            card.style.animation = 'none';
            card.offsetHeight; // Reflow trigger karo
            card.style.animation = 'fadeInUp 0.4s ease forwards';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // No results message
    const noResults = document.getElementById('no-results');
    if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

function filterGames(category) {
    state.activeFilter = category;
    filterAndRenderGames();
}

// ============================================================
// 21. FAVORITES SYSTEM
// ============================================================

function toggleFavorite(gameId) {
    if (!gameId) return;

    const index = state.favorites.indexOf(gameId);
    if (index === -1) {
        state.favorites.push(gameId);
        showToast('❤️ Added to favorites!', 'success');
        updateAnalytics('favorite_added', { gameId });
    } else {
        state.favorites.splice(index, 1);
        showToast('💔 Removed from favorites', 'info');
    }

    localStorage.setItem('neonarcade_favorites', JSON.stringify(state.favorites));

    // UI update karo
    document.querySelectorAll(`.fav-btn[data-game-id="${gameId}"]`).forEach(btn => {
        const isFav = state.favorites.includes(gameId);
        btn.classList.toggle('active', isFav);
        btn.textContent = isFav ? '❤️' : '🤍';
        btn.classList.add('fav-animate');
        setTimeout(() => btn.classList.remove('fav-animate'), 300);
    });

    // Current game page ka fav button bhi update karo
    if (elements.favoriteBtn) {
        const isFav = state.favorites.includes(gameId);
        elements.favoriteBtn.textContent = isFav ? '❤️ Favorited' : '🤍 Favorite';
        elements.favoriteBtn.classList.toggle('active', isFav);
    }

    checkAllAchievements();
}

// ============================================================
// 22. GAME OPENING - Premium
// ============================================================

function openGame(gameId) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;

    // Speed run tracking
    const now = Date.now();
    if (state.lastGameOpen && (now - state.lastGameOpen) < 20000) {
        state.analytics.speedRuns = (state.analytics.speedRuns || 0) + 1;
    }
    state.lastGameOpen = now;

    state.currentGame = gameId;

    if (elements.currentGameTitle) {
        elements.currentGameTitle.textContent = game.name;
    }

    if (elements.gameInstructions) {
        elements.gameInstructions.innerHTML = `
            <div class="instructions-card">
                <h3>📋 How to Play ${game.icon}</h3>
                <p>${game.instructions}</p>
                <div class="game-meta-info">
                    <span class="meta-item">
                        <span class="meta-label">Category</span>
                        <span class="meta-value">${game.category}</span>
                    </span>
                    <span class="meta-item">
                        <span class="meta-label">Difficulty</span>
                        <span class="meta-value difficulty-${game.difficulty.toLowerCase()}">${game.difficulty}</span>
                    </span>
                    <span class="meta-item">
                        <span class="meta-label">Your Best</span>
                        <span class="meta-value">${(state.scores[gameId] || 0).toLocaleString()}</span>
                    </span>
                </div>
            </div>
        `;
    }

    if (elements.gameScore) elements.gameScore.textContent = '0';

    // Favorite button state
    if (elements.favoriteBtn) {
        const isFav = state.favorites.includes(gameId);
        elements.favoriteBtn.textContent = isFav ? '❤️ Favorited' : '🤍 Favorite';
        elements.favoriteBtn.classList.toggle('active', isFav);
        elements.favoriteBtn.dataset.gameId = gameId;
    }

    // Level/Lives display reset karo
    if (elements.levelDisplay) elements.levelDisplay.textContent = '1';
    if (elements.livesDisplay) elements.livesDisplay.textContent = '3';

    navigateTo('game');

    state.gameStartTime = Date.now();

    setTimeout(() => {
        startGame(gameId);
        updateAnalytics('game_started', { gameId });
    }, 150);
}

// ============================================================
// 23. GAME ENGINE - Start/Stop
// ============================================================

function startGame(gameId) {
    const canvas = elements.gameCanvas;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    canvas.width = Math.min(800, container.clientWidth - 4);
    canvas.height = Math.min(600, window.innerHeight * 0.65);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const games = {
        'bubble-shooter': typeof BubbleShooter !== 'undefined' ? BubbleShooter : null,
        'liquid-sort': typeof LiquidSort !== 'undefined' ? LiquidSort : null,
        'knife-hit': typeof KnifeHit !== 'undefined' ? KnifeHit : null,
        'color-bump': typeof ColorBump !== 'undefined' ? ColorBump : null,
        'bottle-shooting': typeof BottleShooting !== 'undefined' ? BottleShooting : null,
        'color-up': typeof ColorUp !== 'undefined' ? ColorUp : null,
        'flappy-bird': typeof FlappyBird !== 'undefined' ? FlappyBird : null,
        'space-invaders': typeof SpaceInvaders !== 'undefined' ? SpaceInvaders : null,
        'snake-neon': typeof SnakeNeon !== 'undefined' ? SnakeNeon : null,
        'breakout': typeof Breakout !== 'undefined' ? Breakout : null
    };

    const GameClass = games[gameId];
    if (GameClass) {
        try {
            state.gameInstance = new GameClass(canvas, updateScore, {
                sound: state.soundEnabled,
                theme: themes[state.currentTheme],
                onLevelUp: handleLevelUp,
                onLifeLost: handleLifeLost
            });
        } catch (err) {
            console.error(`Error starting ${gameId}:`, err);
            showToast('❌ Game failed to load', 'error');
        }
    } else {
        // Fallback - Game class nahi mili
        showGamePlaceholder(ctx, canvas, gameId);
    }
}

function showGamePlaceholder(ctx, canvas, gameId) {
    const game = gamesData.find(g => g.id === gameId);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f5ff';
    ctx.font = `80px Arial`;
    ctx.fillText(game?.icon || '🎮', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Orbitron", sans-serif';
    ctx.fillText(game?.name || 'Loading...', canvas.width / 2, canvas.height / 2 + 30);

    ctx.fillStyle = '#888';
    ctx.font = '16px Arial';
    ctx.fillText('Game loading, please wait...', canvas.width / 2, canvas.height / 2 + 65);
}

// ============================================================
// 24. SCORE SYSTEM - Premium
// ============================================================

function updateScore(score, gameOver = false, extras = {}) {
    if (!elements.gameScore) return;

    const prevScore = parseInt(elements.gameScore.textContent) || 0;
    elements.gameScore.textContent = score;

    // Score badha toh pop animation
    if (score > prevScore) {
        elements.gameScore.classList.remove('score-pop');
        elements.gameScore.offsetHeight;
        elements.gameScore.classList.add('score-pop');
        setTimeout(() => elements.gameScore.classList.remove('score-pop'), 300);
    }

    // Level aur lives update karo
    if (extras.level && elements.levelDisplay) {
        elements.levelDisplay.textContent = extras.level;
    }
    if (extras.lives !== undefined && elements.livesDisplay) {
        elements.livesDisplay.textContent = extras.lives;
    }

    // Progress bar update karo
    if (extras.progress !== undefined && elements.progressBar) {
        elements.progressBar.style.width = `${extras.progress}%`;
    }

    if (gameOver) {
        handleGameOver(score, extras);
    }
}

function handleGameOver(score, extras = {}) {
    const gameId = state.currentGame;
    const isNewHighScore = !state.scores[gameId] || score > state.scores[gameId];

    if (isNewHighScore && score > 0) {
        state.scores[gameId] = score;
        localStorage.setItem('neonarcade_scores', JSON.stringify(state.scores));

        updateAnalytics('high_score', { gameId, score });

        if (state.scores[gameId] > 0) {
            setTimeout(() => showToast(`🏆 New High Score: ${score.toLocaleString()}!`, 'success'), 500);
        }

        updateLeaderboardWithMyScores();
    }

    // Play time save karo
    if (state.gameStartTime) {
        const playTime = Date.now() - state.gameStartTime;
        state.analytics.totalPlayTime = (state.analytics.totalPlayTime || 0) + playTime;
    }

    updateAnalytics('game_over', { gameId, score });

    if (window.audioManager) audioManager.play('gameOver');

    // Overlay show karo with new high score indication
    showOverlay('GAME OVER', score, isNewHighScore);
    checkAllAchievements();
}

function handleLevelUp(level) {
    if (elements.levelDisplay) elements.levelDisplay.textContent = level;
    showToast(`⬆️ Level ${level}!`, 'success');
    if (window.audioManager) audioManager.play('levelUp');
}

function handleLifeLost(lives) {
    if (elements.livesDisplay) elements.livesDisplay.textContent = lives;
}

// ============================================================
// 25. GAME OVERLAY - Premium
// ============================================================

function showOverlay(title, score = null, isHighScore = false) {
    if (!elements.gameOverlay) return;

    if (title === null) {
        hideOverlay();
        return;
    }

    if (elements.overlayTitle) elements.overlayTitle.textContent = title;

    if (elements.overlayScore) {
        if (score !== null) {
            elements.overlayScore.innerHTML = `
                <div class="overlay-score-display">
                    <span class="overlay-score-label">Score</span>
                    <span class="overlay-score-value">${score.toLocaleString()}</span>
                    ${isHighScore ? '<span class="high-score-badge">🏆 NEW BEST!</span>' : ''}
                </div>
                ${isHighScore ? '' : state.scores[state.currentGame] ?
                    `<div class="overlay-best-score">Best: ${state.scores[state.currentGame].toLocaleString()}</div>` : ''
                }
            `;
        } else {
            elements.overlayScore.innerHTML = '';
        }
    }

    elements.gameOverlay.classList.remove('hidden');
    elements.gameOverlay.classList.add('overlay-animate');
}

function hideOverlay() {
    if (!elements.gameOverlay) return;
    elements.gameOverlay.classList.add('hidden');
    elements.gameOverlay.classList.remove('overlay-animate');
}

function restartGame() {
    hideOverlay();
    if (state.gameInstance) {
        state.gameInstance.destroy();
        state.gameInstance = null;
    }
    if (elements.gameScore) elements.gameScore.textContent = '0';
    if (elements.pauseBtn) elements.pauseBtn.innerHTML = '<span>⏸️</span>';
    state.gameStartTime = Date.now();
    startGame(state.currentGame);
    if (window.audioManager) audioManager.play('click');
}

function saveGameSession() {
    if (state.gameStartTime) {
        const playTime = Date.now() - state.gameStartTime;
        state.analytics.totalPlayTime = (state.analytics.totalPlayTime || 0) + playTime;
        saveAnalytics();
        state.gameStartTime = null;
    }
}

// ============================================================
// 26. LEADERBOARD - Premium with player scores
// ============================================================

function renderLeaderboard() {
    updateLeaderboardWithMyScores();
}

function updateLeaderboardWithMyScores() {
    if (!elements.leaderboardContent) return;

    // Player ke scores add karo
    const allEntries = [...leaderboardData.all];
    const playerName = localStorage.getItem('neonarcade_username') || 'You';

    Object.entries(state.scores).forEach(([gameId, score]) => {
        if (score <= 0) return;
        const game = gamesData.find(g => g.id === gameId);
        if (!game) return;

        // Existing entry dhundo
        const existingIdx = allEntries.findIndex(e => e.name === playerName && e.game === game.name);
        if (existingIdx !== -1) {
            if (score > allEntries[existingIdx].score) {
                allEntries[existingIdx].score = score;
            }
        } else {
            allEntries.push({
                name: playerName,
                game: game.name,
                score,
                avatar: '🎮',
                isPlayer: true
            });
        }
    });

    // Sort by score (descending)
    allEntries.sort((a, b) => b.score - a.score);

    // Top 15 dikhao
    const topEntries = allEntries.slice(0, 15);

    elements.leaderboardContent.innerHTML = topEntries.map((entry, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
        const isPlayerEntry = entry.isPlayer;

        return `
            <div class="leaderboard-item ${isPlayerEntry ? 'player-entry' : ''}"
                 style="animation-delay: ${i * 0.05}s">
                <div class="leaderboard-rank ${rankClass}">${rankIcon}</div>
                <div class="leaderboard-avatar">${entry.avatar || '🎮'}</div>
                <div class="leaderboard-player">
                    <div class="leaderboard-name">
                        ${entry.name}
                        ${isPlayerEntry ? '<span class="player-tag">YOU</span>' : ''}
                    </div>
                    <div class="leaderboard-game">${entry.game}</div>
                </div>
                <div class="leaderboard-score">${entry.score.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// 27. ACHIEVEMENTS SYSTEM
// ============================================================

function checkAllAchievements() {
    achievementsConfig.forEach(achievement => {
        if (!state.achievements.includes(achievement.id)) {
            if (achievement.condition(state.analytics)) {
                unlockAchievement(achievement);
            }
        }
    });
}

function unlockAchievement(achievement) {
    state.achievements.push(achievement.id);
    localStorage.setItem('neonarcade_achievements', JSON.stringify(state.achievements));

    // Toast notification
    showToast(`🏅 Achievement Unlocked: ${achievement.name}!`, 'achievement');

    // Sound play karo
    if (window.audioManager) audioManager.play('achievement');

    // Grid update karo
    renderAchievements();
}

function renderAchievements() {
    if (!elements.achievementsGrid) return;

    elements.achievementsGrid.innerHTML = achievementsConfig.map((achievement, i) => {
        const isUnlocked = state.achievements.includes(achievement.id);
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}"
                 style="animation-delay: ${i * 0.08}s"
                 title="${achievement.description}">
                <div class="achievement-icon">${isUnlocked ? achievement.icon : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.description}</div>
                </div>
                ${isUnlocked ? '<div class="achievement-badge">✅</div>' : ''}
            </div>
        `;
    }).join('');

    // Progress display karo
    const progressEl = document.getElementById('achievement-progress');
    if (progressEl) {
        const count = state.achievements.length;
        const total = achievementsConfig.length;
        progressEl.innerHTML = `
            <div class="achievement-count">${count}/${total} Unlocked</div>
            <div class="achievement-bar">
                <div class="achievement-bar-fill"
                     style="width: ${(count / total) * 100}%"></div>
            </div>
        `;
    }
}

// ============================================================
// 28. PROFILE SYSTEM
// ============================================================

function renderProfile() {
    if (!elements.profileStats) return;

    const totalGames = Object.values(state.scores).filter(s => s > 0).length;
    const totalScore = Object.values(state.scores).reduce((a, b) => a + b, 0);
    const highestScore = Math.max(0, ...Object.values(state.scores));
    const favoriteCount = state.favorites.length;
    const achievementCount = state.achievements.length;
    const playTimeMin = Math.round((state.analytics.totalPlayTime || 0) / 60000);

    const playerName = localStorage.getItem('neonarcade_username') || 'NeonPlayer';

    elements.profileStats.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">🎮</div>
            <div class="profile-info">
                <h2 class="profile-name">${playerName}</h2>
                <p class="profile-level">Level ${calculatePlayerLevel(totalScore)}</p>
                <div class="profile-xp-bar">
                    <div class="profile-xp-fill"
                         style="width: ${(totalScore % 10000) / 100}%"></div>
                </div>
                <button class="edit-name-btn" id="edit-name-btn">✏️ Edit Name</button>
            </div>
        </div>
        <div class="profile-stats-grid">
            <div class="profile-stat-card">
                <div class="stat-icon">🎮</div>
                <div class="stat-value">${totalGames}</div>
                <div class="stat-label">Games Played</div>
            </div>
            <div class="profile-stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-value">${highestScore.toLocaleString()}</div>
                <div class="stat-label">Highest Score</div>
            </div>
            <div class="profile-stat-card">
                <div class="stat-icon">💯</div>
                <div class="stat-value">${totalScore.toLocaleString()}</div>
                <div class="stat-label">Total Score</div>
            </div>
            <div class="profile-stat-card">
                <div class="stat-icon">❤️</div>
                <div class="stat-value">${favoriteCount}</div>
                <div class="stat-label">Favorites</div>
            </div>
            <div class="profile-stat-card">
                <div class="stat-icon">🏅</div>
                <div class="stat-value">${achievementCount}/${achievementsConfig.length}</div>
                <div class="stat-label">Achievements</div>
            </div>
            <div class="profile-stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-value">${playTimeMin}</div>
                <div class="stat-label">Minutes Played</div>
            </div>
        </div>
        <div class="profile-best-scores">
            <h3>🏆 Best Scores</h3>
            <div class="best-scores-list">
                ${gamesData.map(game => {
                    const score = state.scores[game.id] || 0;
                    return `
                        <div class="best-score-item ${score > 0 ? 'has-score' : ''}">
                            <span class="best-score-game">${game.icon} ${game.name}</span>
                            <span class="best-score-value">${score > 0 ? score.toLocaleString() : '—'}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Edit name button
    const editBtn = document.getElementById('edit-name-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const newName = prompt('Enter your gaming name:', playerName);
            if (newName && newName.trim()) {
                localStorage.setItem('neonarcade_username', newName.trim().slice(0, 20));
                renderProfile();
                showToast(`✅ Name changed to ${newName.trim()}!`, 'success');
            }
        });
    }
}

function calculatePlayerLevel(totalScore) {
    return Math.max(1, Math.floor(Math.sqrt(totalScore / 100)) + 1);
}

// ============================================================
// 29. ANALYTICS - Track everything
// ============================================================

function updateAnalytics(event, data = {}) {
    const analytics = state.analytics;

    switch(event) {
        case 'session_start':
            analytics.sessions = (analytics.sessions || 0) + 1;
            analytics.lastPlayed = Date.now();
            break;

        case 'game_started':
            analytics.totalGamesPlayed = (analytics.totalGamesPlayed || 0) + 1;
            analytics.gamesPlayed = analytics.gamesPlayed || {};
            analytics.gamesPlayed[data.gameId] = (analytics.gamesPlayed[data.gameId] || 0) + 1;
            break;

        case 'game_over':
            if (data.score) {
                analytics.scoreHistory = analytics.scoreHistory || [];
                analytics.scoreHistory.push({ gameId: data.gameId, score: data.score, date: Date.now() });
                if (analytics.scoreHistory.length > 50) analytics.scoreHistory.shift();
            }
            break;

        case 'high_score':
            if (data.score > (analytics.highestScore || 0)) {
                analytics.highestScore = data.score;
            }
            break;

        case 'favorite_added':
            analytics.favorites = state.favorites;
            break;
    }

    // Night owl check
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
        analytics.playedAtNight = true;
    }

    saveAnalytics();
}

function saveAnalytics() {
    localStorage.setItem('neonarcade_analytics', JSON.stringify(state.analytics));
}

// ============================================================
// 30. TOAST NOTIFICATION SYSTEM
// ============================================================

function showToast(message, type = 'info', duration = 3000) {
    // Toast container dhundo ya banao
    let container = elements.toastContainer;
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        elements.toastContainer = container;
    }

    const toast = document.createElement('div');
    const colors = {
        success: '#39ff14',
        error: '#fe2254',
        info: '#00f5ff',
        warning: '#ffff00',
        achievement: '#bc13fe'
    };

    toast.style.cssText = `
        background: rgba(10, 10, 15, 0.95);
        border: 1px solid ${colors[type] || colors.info};
        border-left: 4px solid ${colors[type] || colors.info};
        border-radius: 8px;
        padding: 12px 20px;
        color: #ffffff;
        font-family: 'Rajdhani', sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 20px ${colors[type]}44, 0 0 40px ${colors[type]}22;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
        max-width: 320px;
        cursor: pointer;
        backdrop-filter: blur(10px);
    `;

    toast.textContent = message;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Click to dismiss
    toast.addEventListener('click', () => dismissToast(toast));

    // Auto dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;
}

function dismissToast(toast) {
    clearTimeout(toast._timer);
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 300);
}

// ============================================================
// 31. SHARE SCORE
// ============================================================

function shareScore() {
    const game = gamesData.find(g => g.id === state.currentGame);
    const score = state.scores[state.currentGame] || 0;

    if (!game || score === 0) {
        showToast('Play a game first to share your score!', 'info');
        return;
    }

    const text = `🎮 I scored ${score.toLocaleString()} in ${game.name} on NeonArcade! Can you beat me? 🔥`;

    if (navigator.share) {
        navigator.share({
            title: 'NeonArcade Score',
            text,
            url: window.location.href
        }).catch(console.error);
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Score copied to clipboard!', 'success');
        });
    } else {
        showToast('Share: ' + text, 'info', 5000);
    }
}

// ============================================================
// 32. PERFORMANCE MONITOR
// ============================================================

function initPerformanceMonitor() {
    if (!elements.fpsCounter) return;

    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    function updateFPS() {
        frames++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
            fps = Math.round(frames * 1000 / (now - lastTime));
            frames = 0;
            lastTime = now;

            if (elements.fpsCounter) {
                elements.fpsCounter.textContent = `${fps} FPS`;
                elements.fpsCounter.style.color = fps >= 50 ? '#39ff14' : fps >= 30 ? '#ffff00' : '#fe2254';
            }
        }
        requestAnimationFrame(updateFPS);
    }

    elements.fpsCounter.style.display = 'block';
    requestAnimationFrame(updateFPS);
}

// ============================================================
// 33. STATS ANIMATION
// ============================================================

function animateStats() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateSingleStat(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat-number').forEach(stat => {
        observer.observe(stat);
    });
}

function animateSingleStat(stat) {
    const target = parseInt(stat.dataset.count);
    if (isNaN(target)) return;

    const duration = 2000;
    const start = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(easeOut(progress) * target);
        stat.textContent = current.toLocaleString();

        if (progress < 1) requestAnimationFrame(update);
        else stat.textContent = target.toLocaleString();
    }

    requestAnimationFrame(update);
}

// ============================================================
// 34. UTILITY FUNCTIONS
// ============================================================

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

function checkNightOwl() {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
        state.analytics.playedAtNight = true;
        saveAnalytics();
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================
// 35. WINDOW EVENT HANDLERS
// ============================================================

// Scroll handler - throttled for performance
window.addEventListener('scroll', throttle(() => {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }

    // Parallax effect on home page
    if (state.currentPage === 'home') {
        const scrolled = window.scrollY;
        const hero = document.querySelector('.hero-content');
        if (hero) {
            hero.style.transform = `translateY(${scrolled * 0.2}px)`;
            hero.style.opacity = 1 - scrolled / 600;
        }
    }
}, 16));

// Resize handler - debounced
window.addEventListener('resize', debounce(() => {
    if (state.currentPage === 'game' && state.gameInstance) {
        const canvas = elements.gameCanvas;
        if (!canvas) return;

        const container = canvas.parentElement;
        if (!container) return;

        canvas.width = Math.min(800, container.clientWidth - 4);
        canvas.height = Math.min(600, window.innerHeight * 0.65);

        if (state.gameInstance.resize) state.gameInstance.resize();
    }
}, 250));

// Visibility change - game pause karo
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentPage === 'game' && state.gameInstance) {
        if (state.gameInstance.togglePause && !state.gameInstance.isPaused) {
            state.gameInstance.togglePause();
            showOverlay('PAUSED - Tab Changed');
        }
    }
});

// Before unload - data save karo
window.addEventListener('beforeunload', () => {
    saveGameSession();
    saveAnalytics();
});

// ============================================================
// 36. INITIAL URL HASH HANDLING
// ============================================================

(function handleInitialHash() {
    const hash = window.location.hash.slice(1);
    const validPages = ['home', 'games', 'leaderboard', 'achievements', 'profile'];
    if (validPages.includes(hash)) {
        // Loading ke baad navigate karo
        setTimeout(() => navigateTo(hash, false), 1500);
    }
})();