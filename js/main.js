// ============================================================
// NEONARCADE - PREMIUM MAIN.JS v3.0 - FIXED GAME DESTROY
// ============================================================

'use strict';

// ============================================================
// 1. GAMES DATA
// ============================================================

const gamesData = [
    { id: 'bubble-shooter', name: 'Bubble Shooter', icon: '🫧', category: 'puzzle', description: 'Pop colorful bubbles by matching 3 or more!', rating: 4.8, plays: 15420, difficulty: 'Easy', tags: ['bubble', 'color', 'match'], instructions: 'Aim and shoot bubbles to match 3 or more of the same color. Clear the board to win!', color: '#00f5ff' },
    { id: 'liquid-sort', name: 'Liquid Sort Puzzle', icon: '🧪', category: 'puzzle', description: 'Sort colored liquids into matching tubes.', rating: 4.7, plays: 12300, difficulty: 'Medium', tags: ['sort', 'logic', 'color'], instructions: 'Click a tube to select it, then click another to pour. Sort all colors into separate tubes.', color: '#bc13fe' },
    { id: 'knife-hit', name: 'Knife Hit', icon: '🔪', category: 'action', description: 'Throw knives at the spinning target!', rating: 4.6, plays: 18900, difficulty: 'Hard', tags: ['knife', 'aim', 'reflex'], instructions: 'Click or tap to throw knives at the rotating target. Don\'t hit other knives!', color: '#ff6b35' },
    { id: 'color-bump', name: 'Color Bump', icon: '🔴', category: 'action', description: 'Bump balls of your color, avoid others!', rating: 4.5, plays: 9800, difficulty: 'Medium', tags: ['bump', 'color', 'dodge'], instructions: 'Drag your ball to bump same-colored balls off the screen. Avoid different colors!', color: '#fe2254' },
    { id: 'bottle-shooting', name: 'Bottle Shooting', icon: '🎯', category: 'action', description: 'Test your aim by shooting bottles!', rating: 4.4, plays: 7600, difficulty: 'Easy', tags: ['shoot', 'aim', 'target'], instructions: 'Click to shoot and break all the bottles. Aim carefully for bonus points!', color: '#39ff14' },
    { id: 'color-up', name: 'Color Up', icon: '🎨', category: 'puzzle', description: 'Match colors to climb higher!', rating: 4.5, plays: 11200, difficulty: 'Medium', tags: ['color', 'climb', 'match'], instructions: 'Tap to change your color and pass through matching gates. Go as high as possible!', color: '#ffff00' },
    { id: 'flappy-bird', name: 'Flappy Bird', icon: '🐦', category: 'arcade', description: 'The classic game - fly through pipes!', rating: 4.9, plays: 45000, difficulty: 'Hard', tags: ['fly', 'classic', 'pipe'], instructions: 'Click or tap to flap. Navigate through the pipes without hitting them!', color: '#00f5ff' },
    { id: 'space-invaders', name: 'Space Invaders', icon: '👾', category: 'arcade', description: 'Defend Earth from alien invasion!', rating: 4.7, plays: 32000, difficulty: 'Medium', tags: ['space', 'shoot', 'alien'], instructions: 'Use arrow keys to move, spacebar to shoot. Destroy all aliens before they reach you!', color: '#bc13fe' },
    { id: 'snake-neon', name: 'Neon Snake', icon: '🐍', category: 'arcade', description: 'Classic snake with a neon twist!', rating: 4.6, plays: 28000, difficulty: 'Easy', tags: ['snake', 'classic', 'neon'], instructions: 'Use arrow keys or WASD to control the snake. Eat food to grow, avoid walls and yourself!', color: '#39ff14' },
    { id: 'breakout', name: 'Neon Breakout', icon: '🧱', category: 'arcade', description: 'Break all the bricks with style!', rating: 4.5, plays: 21000, difficulty: 'Medium', tags: ['breakout', 'brick', 'paddle'], instructions: 'Move the paddle with mouse or touch. Break all bricks to complete each level!', color: '#ff6b35' }
];

// ============================================================
// 2. LEADERBOARD DATA
// ============================================================

let leaderboardData = {
    all: [
        { name: 'NeonMaster',   game: 'Flappy Bird',     score: 156,   avatar: '🎮' },
        { name: 'ArcadeKing',   game: 'Space Invaders',  score: 12500, avatar: '👑' },
        { name: 'PuzzleWiz',    game: 'Liquid Sort',     score: 980,   avatar: '🧩' },
        { name: 'BubblePro',    game: 'Bubble Shooter',  score: 8750,  avatar: '🫧' },
        { name: 'SnakeCharmer', game: 'Neon Snake',      score: 425,   avatar: '🐍' },
        { name: 'BrickBreaker', game: 'Breakout',        score: 15600, avatar: '🧱' },
        { name: 'KnifeThrower', game: 'Knife Hit',       score: 89,    avatar: '🔪' },
        { name: 'ColorMaster',  game: 'Color Bump',      score: 340,   avatar: '🎨' },
        { name: 'SharpShooter', game: 'Bottle Shooting', score: 2800,  avatar: '🎯' },
        { name: 'HighFlyer',    game: 'Color Up',        score: 156,   avatar: '✈️' }
    ]
};

// ============================================================
// 3. STATE
// ============================================================

const state = {
    currentPage:  'home',
    currentGame:  null,
    gameInstance: null,
    soundEnabled: true,
    activeFilter: 'all',
    searchQuery:  '',
    favorites:    JSON.parse(localStorage.getItem('neonarcade_favorites') || '[]'),
    scores:       JSON.parse(localStorage.getItem('neonarcade_scores')    || '{}'),
    gameStartTime: null
};

const elements = {};

// ============================================================
// 4. INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    simulateLoading();
    initNavigation();
    initMobileMenu();
    initSoundToggle();
    initGameControls();
    initSearch();
    renderGames();
    renderLeaderboard();
    animateStats();
    initScrollReveal();

    console.log('%c🎮 NeonArcade Loaded!', 'color:#b347d9;font-size:16px;font-weight:bold;');
});

// ============================================================
// 5. CACHE ELEMENTS
// ============================================================

function cacheElements() {
    const ids = [
        'loading-screen', 'app', 'hamburger', 'mobile-menu',
        'sound-toggle', 'featured-games', 'games-grid',
        'leaderboard-content', 'game-canvas', 'game-overlay',
        'game-score', 'current-game-title', 'game-instructions',
        'overlay-title', 'overlay-score', 'back-to-games',
        'pause-btn', 'restart-btn', 'resume-btn',
        'overlay-restart-btn', 'game-search', 'search-clear',
        'favorite-btn', 'game-wrapper'
    ];
    ids.forEach(id => {
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        elements[key] = document.getElementById(id);
    });
}

// ============================================================
// 6. LOADING
// ============================================================

function simulateLoading() {
    const fill = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    const tips = [
        'Loading neon lights...',
        'Charging laser cannons...',
        'Warming up the arcade...',
        'Calibrating game physics...',
        'Almost there...'
    ];
    let progress = 0;
    let tipIdx   = 0;

    const interval = setInterval(() => {
        progress += Math.random() * 18 + 4;
        if (progress > 100) progress = 100;
        if (fill) fill.style.width = `${progress}%`;

        const newTip = Math.floor((progress / 100) * tips.length);
        if (newTip !== tipIdx && newTip < tips.length) {
            tipIdx = newTip;
            if (text) {
                text.style.opacity = '0';
                setTimeout(() => {
                    if (text) { text.textContent = tips[tipIdx]; text.style.opacity = '1'; }
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
                }, 500);
            }, 300);
        }
    }, 120);
}

// ============================================================
// 7. NAVIGATION
// ============================================================

function initNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Back button
    if (elements.backToGames) {
        elements.backToGames.addEventListener('click', () => {
            // ✅ PROPER GAME DESTROY
            destroyCurrentGame();
            navigateTo('games');
        });
    }
}

function navigateTo(page) {
    const validPages = ['home', 'games', 'leaderboard', 'about', 'game'];
    if (!validPages.includes(page)) return;

    // ✅ Agar game page se dur ja rahe hain toh game destroy karo
    if (state.currentPage === 'game' && page !== 'game') {
        destroyCurrentGame();
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetEl = document.getElementById(`${page}-page`);
    if (targetEl) targetEl.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) link.classList.add('active');
    });

    elements.mobileMenu?.classList.remove('active');
    elements.hamburger?.classList.remove('active');
    document.body.classList.remove('menu-open');

    state.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'leaderboard') updateLeaderboardWithScores();
}

// ============================================================
// 8. ✅ GAME DESTROY - YEH HAI MAIN FIX
// ============================================================

function destroyCurrentGame() {
    if (state.gameInstance) {
        try {
            // Game destroy karo - animation loop band karo
            state.gameInstance.destroy();
        } catch(e) {
            console.warn('Game destroy error:', e);
        }
        state.gameInstance = null;
    }

    // ✅ Canvas clear karo
    const canvas = elements.gameCanvas;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ✅ Saare event listeners remove karne ke liye canvas clone trick
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        elements.gameCanvas = newCanvas;
    }

    // ✅ Audio band karo
    if (window.audioManager) {
        try {
            audioManager.stopAll?.();
            audioManager.stopMusic?.();
        } catch(e) {}
    }

    // ✅ Game overlay hide karo
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');

    // ✅ Score reset karo display
    if (elements.gameScore) elements.gameScore.textContent = '0';

    // ✅ Pause button reset
    if (elements.pauseBtn) elements.pauseBtn.innerHTML = '⏸️';

    // Play time save
    if (state.gameStartTime) {
        state.gameStartTime = null;
    }

    state.currentGame = null;
    console.log('✅ Game properly destroyed');
}

// ============================================================
// 9. MOBILE MENU
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

    // Outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar') &&
            elements.mobileMenu?.classList.contains('active')) {
            elements.mobileMenu.classList.remove('active');
            elements.hamburger?.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

// ============================================================
// 10. SOUND
// ============================================================

function initSoundToggle() {
    if (!elements.soundToggle) return;
    elements.soundToggle.addEventListener('click', () => {
        state.soundEnabled = window.audioManager
            ? audioManager.toggle()
            : !state.soundEnabled;
        localStorage.setItem('neonarcade_sound', state.soundEnabled);
        const onEl  = elements.soundToggle.querySelector('.sound-on');
        const offEl = elements.soundToggle.querySelector('.sound-off');
        if (onEl)  onEl.classList.toggle('hidden', !state.soundEnabled);
        if (offEl) offEl.classList.toggle('hidden', state.soundEnabled);
    });
}

// ============================================================
// 11. SEARCH
// ============================================================

function initSearch() {
    if (!elements.gameSearch) return;
    let searchTimeout;
    elements.gameSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            filterAndRenderGames();
        }, 300);
    });
    if (elements.searchClear) {
        elements.searchClear.addEventListener('click', () => {
            elements.gameSearch.value = '';
            state.searchQuery = '';
            filterAndRenderGames();
        });
    }
}

// ============================================================
// 12. GAME CONTROLS
// ============================================================

function initGameControls() {
    // Pause
    if (elements.pauseBtn) {
        elements.pauseBtn.addEventListener('click', () => {
            if (state.gameInstance?.togglePause) {
                const paused = state.gameInstance.togglePause();
                if (paused) {
                    showOverlay('PAUSED');
                    elements.pauseBtn.innerHTML = '▶️';
                } else {
                    hideOverlay();
                    elements.pauseBtn.innerHTML = '⏸️';
                }
            }
        });
    }

    // Restart
    if (elements.restartBtn) {
        elements.restartBtn.addEventListener('click', () => restartGame());
    }

    // Resume
    if (elements.resumeBtn) {
        elements.resumeBtn.addEventListener('click', () => {
            if (state.gameInstance?.togglePause) {
                state.gameInstance.togglePause();
            }
            hideOverlay();
            if (elements.pauseBtn) elements.pauseBtn.innerHTML = '⏸️';
        });
    }

    // Overlay Restart
    if (elements.overlayRestartBtn) {
        elements.overlayRestartBtn.addEventListener('click', () => restartGame());
    }

    // Favorite
    if (elements.favoriteBtn) {
        elements.favoriteBtn.addEventListener('click', () => {
            if (state.currentGame) toggleFavorite(state.currentGame);
        });
    }

    // ✅ Keyboard shortcut - Escape to go back
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.currentPage === 'game') {
            if (state.gameInstance?.togglePause) {
                const paused = state.gameInstance.togglePause();
                if (paused) {
                    showOverlay('PAUSED');
                    if (elements.pauseBtn) elements.pauseBtn.innerHTML = '▶️';
                } else {
                    hideOverlay();
                    if (elements.pauseBtn) elements.pauseBtn.innerHTML = '⏸️';
                }
            }
        }
    });
}

// ============================================================
// 13. OVERLAY
// ============================================================

function showOverlay(title, score = null, isHighScore = false) {
    const overlay = document.getElementById('game-overlay');
    if (!overlay) return;

    const titleEl = document.getElementById('overlay-title');
    const scoreEl = document.getElementById('overlay-score');

    if (titleEl) titleEl.textContent = title;

    if (scoreEl) {
        if (score !== null) {
            scoreEl.innerHTML = `
                <div class="overlay-score-display">
                    <span class="overlay-score-label">Score</span>
                    <span class="overlay-score-value">${score.toLocaleString()}</span>
                    ${isHighScore ? '<span class="high-score-badge">🏆 NEW BEST!</span>' : ''}
                </div>
                ${state.scores[state.currentGame] && !isHighScore
                    ? `<div class="overlay-best-score">Best: ${state.scores[state.currentGame].toLocaleString()}</div>`
                    : ''}
            `;
        } else {
            scoreEl.innerHTML = '';
        }
    }

    overlay.classList.remove('hidden');
}

function hideOverlay() {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// ============================================================
// 14. RESTART GAME
// ============================================================

function restartGame() {
    hideOverlay();
    if (elements.pauseBtn) elements.pauseBtn.innerHTML = '⏸️';

    // ✅ Pehle destroy karo properly
    if (state.gameInstance) {
        try {
            state.gameInstance.destroy();
        } catch(e) {
            console.warn('Restart destroy error:', e);
        }
        state.gameInstance = null;
    }

    // ✅ Canvas refresh karo
    const canvas = elements.gameCanvas;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (elements.gameScore) elements.gameScore.textContent = '0';

    state.gameStartTime = Date.now();
    startGame(state.currentGame);
}

// ============================================================
// 15. GAME CARDS & RENDER
// ============================================================

function renderGames() {
    renderFeaturedGames();
    renderGamesGrid();
    initFilterButtons();
}

function renderFeaturedGames() {
    if (!elements.featuredGames) return;
    const featured = [...gamesData].sort((a, b) => b.plays - a.plays).slice(0, 4);
    elements.featuredGames.innerHTML = featured.map(g => createGameCard(g, true)).join('');
    attachCardEvents(elements.featuredGames);
}

function renderGamesGrid() {
    if (!elements.gamesGrid) return;
    elements.gamesGrid.innerHTML = gamesData.map(g => createGameCard(g, false)).join('');
    attachCardEvents(elements.gamesGrid);
}

function createGameCard(game, isFeatured = false) {
    const isFav    = state.favorites.includes(game.id);
    const myScore  = state.scores[game.id] || 0;

    return `
        <div class="game-card${isFeatured ? ' featured-card' : ''}"
             data-game-id="${game.id}"
             data-category="${game.category}"
             data-tags="${game.tags.join(',')}"
             style="--game-color: ${game.color}">

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
                    <span class="game-difficulty difficulty-${game.difficulty.toLowerCase()}">
                        ${game.difficulty}
                    </span>
                </div>
                <h3 class="game-card-title">${game.name}</h3>
                <p class="game-card-description">${game.description}</p>
                ${myScore > 0 ? `
                    <div class="game-high-score">
                        <span>Your Best:</span>
                        <strong>${myScore.toLocaleString()}</strong>
                    </div>` : ''}
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

function attachCardEvents(container) {
    if (!container) return;

    container.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openGame(btn.dataset.gameId);
        });
    });

    container.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.fav-btn') && !e.target.closest('.play-btn')) {
                openGame(card.dataset.gameId);
            }
        });
    });

    container.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.gameId);
        });
    });
}

// ============================================================
// 16. FILTER & SEARCH
// ============================================================

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

function filterAndRenderGames() {
    const cards = document.querySelectorAll('#games-grid .game-card');
    let visible = 0;

    cards.forEach(card => {
        const category = card.dataset.category;
        const tags     = (card.dataset.tags || '').toLowerCase();
        const title    = card.querySelector('.game-card-title')?.textContent.toLowerCase() || '';
        const desc     = card.querySelector('.game-card-description')?.textContent.toLowerCase() || '';

        const matchFilter = state.activeFilter === 'all'
            || category === state.activeFilter
            || (state.activeFilter === 'favorites' && state.favorites.includes(card.dataset.gameId));

        const matchSearch = !state.searchQuery
            || title.includes(state.searchQuery)
            || desc.includes(state.searchQuery)
            || tags.includes(state.searchQuery)
            || category.includes(state.searchQuery);

        if (matchFilter && matchSearch) {
            card.style.display = '';
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = 'fadeInUp 0.4s ease forwards';
            visible++;
        } else {
            card.style.display = 'none';
        }
    });

    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
}

// ============================================================
// 17. FAVORITES
// ============================================================

function toggleFavorite(gameId) {
    if (!gameId) return;
    const idx = state.favorites.indexOf(gameId);
    if (idx === -1) {
        state.favorites.push(gameId);
        showToast('❤️ Added to favorites!', 'success');
    } else {
        state.favorites.splice(idx, 1);
        showToast('💔 Removed from favorites', 'info');
    }
    localStorage.setItem('neonarcade_favorites', JSON.stringify(state.favorites));

    document.querySelectorAll(`.fav-btn[data-game-id="${gameId}"]`).forEach(btn => {
        const isFav = state.favorites.includes(gameId);
        btn.classList.toggle('active', isFav);
        btn.textContent = isFav ? '❤️' : '🤍';
    });

    if (elements.favoriteBtn && gameId === state.currentGame) {
        const isFav = state.favorites.includes(gameId);
        elements.favoriteBtn.textContent = isFav ? '❤️' : '🤍';
    }
}

// ============================================================
// 18. OPEN GAME
// ============================================================

function openGame(gameId) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;

    // ✅ Pehle purana game destroy karo
    destroyCurrentGame();

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
    if (elements.pauseBtn)  elements.pauseBtn.innerHTML   = '⏸️';

    // Favorite button
    if (elements.favoriteBtn) {
        const isFav = state.favorites.includes(gameId);
        elements.favoriteBtn.textContent = isFav ? '❤️' : '🤍';
        elements.favoriteBtn.dataset.gameId = gameId;
    }

    navigateTo('game');

    state.gameStartTime = Date.now();
    setTimeout(() => startGame(gameId), 150);
}

// ============================================================
// 19. START GAME
// ============================================================

function startGame(gameId) {
    // ✅ Canvas fresh lo (replace ke baad)
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    elements.gameCanvas = canvas;

    const container = canvas.parentElement;
    if (!container) return;

    canvas.width  = Math.min(800, container.clientWidth - 4);
    canvas.height = Math.min(600, window.innerHeight * 0.65);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const games = {
        'bubble-shooter': typeof BubbleShooter   !== 'undefined' ? BubbleShooter   : null,
        'liquid-sort':    typeof LiquidSort       !== 'undefined' ? LiquidSort       : null,
        'knife-hit':      typeof KnifeHit         !== 'undefined' ? KnifeHit         : null,
        'color-bump':     typeof ColorBump        !== 'undefined' ? ColorBump        : null,
        'bottle-shooting':typeof BottleShooting   !== 'undefined' ? BottleShooting   : null,
        'color-up':       typeof ColorUp          !== 'undefined' ? ColorUp          : null,
        'flappy-bird':    typeof FlappyBird       !== 'undefined' ? FlappyBird       : null,
        'space-invaders': typeof SpaceInvaders    !== 'undefined' ? SpaceInvaders    : null,
        'snake-neon':     typeof SnakeNeon        !== 'undefined' ? SnakeNeon        : null,
        'breakout':       typeof Breakout         !== 'undefined' ? Breakout         : null
    };

    const GameClass = games[gameId];
    if (GameClass) {
        try {
            state.gameInstance = new GameClass(canvas, updateScore);
            console.log(`✅ Game started: ${gameId}`);
        } catch(err) {
            console.error(`❌ Error starting ${gameId}:`, err);
            showToast('Game failed to load', 'error');
        }
    } else {
        // Placeholder
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#b347d9';
        ctx.font = '60px Arial';
        ctx.fillText(gamesData.find(g => g.id === gameId)?.icon || '🎮', canvas.width/2, canvas.height/2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Orbitron';
        ctx.fillText('Coming Soon!', canvas.width/2, canvas.height/2 + 40);
        ctx.textAlign = 'left';
    }
}

// ============================================================
// 20. UPDATE SCORE
// ============================================================

function updateScore(score, gameOver = false) {
    if (elements.gameScore) {
        elements.gameScore.textContent = score;
        elements.gameScore.classList.remove('score-pop');
        elements.gameScore.offsetHeight;
        elements.gameScore.classList.add('score-pop');
        setTimeout(() => elements.gameScore?.classList.remove('score-pop'), 300);
    }

    if (gameOver) {
        const gid = state.currentGame;
        const isNewHigh = !state.scores[gid] || score > state.scores[gid];

        if (isNewHigh && score > 0) {
            state.scores[gid] = score;
            localStorage.setItem('neonarcade_scores', JSON.stringify(state.scores));
            setTimeout(() => showToast(`🏆 New High Score: ${score.toLocaleString()}!`, 'success'), 500);
            updateLeaderboardWithScores();
        }

        if (window.audioManager) {
            try { audioManager.play('gameOver'); } catch(e) {}
        }

        showOverlay('GAME OVER', score, isNewHigh);
    }
}

// ============================================================
// 21. LEADERBOARD
// ============================================================

function renderLeaderboard() {
    updateLeaderboardWithScores();
}

function updateLeaderboardWithScores() {
    if (!elements.leaderboardContent) return;

    const allEntries = [...leaderboardData.all];
    const playerName = localStorage.getItem('neonarcade_username') || 'You';

    Object.entries(state.scores).forEach(([gameId, score]) => {
        if (!score || score <= 0) return;
        const game = gamesData.find(g => g.id === gameId);
        if (!game) return;
        const existIdx = allEntries.findIndex(e => e.name === playerName && e.game === game.name);
        if (existIdx !== -1) {
            if (score > allEntries[existIdx].score) allEntries[existIdx].score = score;
        } else {
            allEntries.push({ name: playerName, game: game.name, score, avatar: '🎮', isPlayer: true });
        }
    });

    allEntries.sort((a, b) => b.score - a.score);

    elements.leaderboardContent.innerHTML = allEntries.slice(0, 15).map((entry, i) => {
        const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
        const rankCls  = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
            <div class="leaderboard-item ${entry.isPlayer ? 'player-entry' : ''}"
                 style="animation-delay:${i * 0.05}s">
                <div class="leaderboard-rank ${rankCls}">${rankIcon}</div>
                <div class="leaderboard-avatar">${entry.avatar || '🎮'}</div>
                <div class="leaderboard-player">
                    <div class="leaderboard-name">
                        ${entry.name}
                        ${entry.isPlayer ? '<span class="player-tag">YOU</span>' : ''}
                    </div>
                    <div class="leaderboard-game">${entry.game}</div>
                </div>
                <div class="leaderboard-score">${entry.score.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// 22. TOAST
// ============================================================

function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position:fixed; top:80px; right:20px; z-index:10000;
            display:flex; flex-direction:column; gap:10px;
            pointer-events:none; max-width:320px;
        `;
        document.body.appendChild(container);
    }

    const colors = { success:'#39ff14', error:'#fe2254', info:'#00f5ff', warning:'#ffff00' };
    const color  = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: rgba(10,10,15,0.95);
        border: 1px solid ${color};
        border-left: 4px solid ${color};
        border-radius: 8px;
        padding: 12px 18px;
        color: #fff;
        font-family: 'Rajdhani', sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 20px ${color}44;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
        pointer-events: auto;
        cursor: pointer;
        backdrop-filter: blur(10px);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });

    const dismiss = () => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    };
    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

// ============================================================
// 23. STATS ANIMATION
// ============================================================

function animateStats() {
    document.querySelectorAll('.stat-number').forEach(stat => {
        const target = parseInt(stat.dataset.count);
        if (isNaN(target)) return;
        const duration = 2000;
        const start    = performance.now();
        const easeOut  = t => 1 - Math.pow(1 - t, 3);
        const update   = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            stat.textContent = Math.floor(easeOut(progress) * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    });
}

// ============================================================
// 24. SCROLL REVEAL
// ============================================================

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-fade-in').forEach(el => observer.observe(el));
}

// ============================================================
// 25. WINDOW EVENTS
// ============================================================

// Scroll - navbar
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// Resize - game canvas
window.addEventListener('resize', debounce(() => {
    if (state.currentPage === 'game' && state.gameInstance) {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        const container = canvas.parentElement;
        if (!container) return;
        canvas.width  = Math.min(800, container.clientWidth - 4);
        canvas.height = Math.min(600, window.innerHeight * 0.65);
        if (state.gameInstance.resize) state.gameInstance.resize();
    }
}, 250));

// ✅ Tab switch - game pause karo
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentPage === 'game' && state.gameInstance) {
        if (state.gameInstance.togglePause && !state.gameInstance.isPaused) {
            state.gameInstance.togglePause();
            showOverlay('PAUSED - Tab Changed');
            if (elements.pauseBtn) elements.pauseBtn.innerHTML = '▶️';
        }
    }
});

// ✅ Page close/refresh - game destroy karo
window.addEventListener('beforeunload', () => {
    destroyCurrentGame();
});

// ============================================================
// 26. UTILS
// ============================================================

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num/1000000).toFixed(1)}M`;
    if (num >= 1000)    return `${(num/1000).toFixed(1)}K`;
    return num.toString();
}