// ============================================================
// NEONARCADE - PREMIUM MAIN.JS v5.0
// Updated: angry-birds, jewel-legend, block-vs-ball added
// Removed: snake-neon, space-invaders, breakout
// ============================================================

'use strict';

// ============================================================
// 1. GAMES DATA (UPDATED)
// ============================================================

const gamesData = [
    { id: 'bubble-shooter', name: 'Bubble Shooter', icon: '🫧', category: 'puzzle', description: 'Pop colorful bubbles by matching 3 or more!', rating: 4.8, plays: 15420, difficulty: 'Easy', tags: ['bubble','color','match'], instructions: 'Aim and shoot bubbles to match 3 or more of the same color.', color: '#00f5ff' },
    { id: 'liquid-sort', name: 'Liquid Sort Puzzle', icon: '🧪', category: 'puzzle', description: 'Sort colored liquids into matching tubes.', rating: 4.7, plays: 12300, difficulty: 'Medium', tags: ['sort','logic','color'], instructions: 'Tap a tube to select, tap another to pour. Sort all colors!', color: '#bc13fe' },
    { id: 'knife-hit', name: 'Knife Hit', icon: '🔪', category: 'action', description: 'Throw knives at the spinning target!', rating: 4.6, plays: 18900, difficulty: 'Hard', tags: ['knife','aim','reflex'], instructions: 'Tap to throw knives at the target. Don\'t hit other knives!', color: '#ff6b35' },
    { id: 'color-bump', name: 'Color Bump', icon: '🔴', category: 'action', description: 'Bump balls of your color, avoid others!', rating: 4.5, plays: 9800, difficulty: 'Medium', tags: ['bump','color','dodge'], instructions: 'Drag to move. Tap to change color. Bump same-color balls!', color: '#fe2254' },
    { id: 'bottle-shooting', name: 'Bottle Shooting', icon: '🎯', category: 'action', description: 'Test your aim by shooting bottles!', rating: 4.4, plays: 7600, difficulty: 'Easy', tags: ['shoot','aim','target'], instructions: 'Tap to shoot and break all the bottles!', color: '#39ff14' },
    { id: 'color-up', name: 'Color Up', icon: '🎨', category: 'puzzle', description: 'Match colors to climb higher!', rating: 4.5, plays: 11200, difficulty: 'Medium', tags: ['color','climb','match'], instructions: 'Tap to change color and pass through matching gates!', color: '#ffff00' },
    { id: 'flappy-bird', name: 'Flappy Bird', icon: '🐦', category: 'arcade', description: 'The classic - fly through pipes!', rating: 4.9, plays: 45000, difficulty: 'Hard', tags: ['fly','classic','pipe'], instructions: 'Tap to flap. Navigate through the pipes!', color: '#00f5ff' },
    { id: 'angry-birds', name: 'Angry Birds', icon: '🐦‍🔥', category: 'action', description: 'Slingshot birds to destroy pig fortresses!', rating: 4.9, plays: 55000, difficulty: 'Medium', tags: ['physics','slingshot','birds','pigs'], instructions: 'Pull back to aim, release to launch! Tap mid-flight for special!', color: '#FF8C00' },
    { id: 'jewel-legend', name: 'Jewel Legend', icon: '💎', category: 'puzzle', description: 'Match 3 or more gems to score big!', rating: 4.8, plays: 38000, difficulty: 'Medium', tags: ['match3','gems','puzzle','jewel'], instructions: 'Tap a gem then tap adjacent gem to swap. Match 3+ to score!', color: '#FFD700' },
    { id: 'block-vs-ball', name: 'Block vs Ball', icon: '🧱', category: 'arcade', description: 'Break numbered blocks with bouncing balls!', rating: 4.7, plays: 29000, difficulty: 'Easy', tags: ['blocks','ball','bounce','breakout'], instructions: 'Swipe to aim, release to shoot balls. Break all blocks!', color: '#00D4FF' }
];

// ============================================================
// 2. LEADERBOARD DATA
// ============================================================

let leaderboardData = {
    all: [
        { name: 'NeonMaster',   game: 'Flappy Bird',      score: 156,   avatar: '🎮' },
        { name: 'BirdSlinger',  game: 'Angry Birds',      score: 28500, avatar: '🐦' },
        { name: 'GemCrusher',   game: 'Jewel Legend',     score: 18200, avatar: '💎' },
        { name: 'BlockBuster',  game: 'Block vs Ball',    score: 15800, avatar: '🧱' },
        { name: 'PuzzleWiz',    game: 'Liquid Sort',      score: 980,   avatar: '🧩' },
        { name: 'BubblePro',    game: 'Bubble Shooter',   score: 8750,  avatar: '🫧' },
        { name: 'KnifeThrower', game: 'Knife Hit',        score: 89,    avatar: '🔪' },
        { name: 'ColorMaster',  game: 'Color Bump',       score: 4340,  avatar: '🔴' },
        { name: 'SharpShooter', game: 'Bottle Shooting',  score: 2800,  avatar: '🎯' },
        { name: 'HighFlyer',    game: 'Color Up',         score: 1560,  avatar: '🎨' }
    ]
};

// ============================================================
// 3. STATE
// ============================================================

const state = {
    currentPage: 'home',
    currentGame: null,
    gameInstance: null,
    soundEnabled: true,
    activeFilter: 'all',
    searchQuery: '',
    favorites: JSON.parse(localStorage.getItem('neonarcade_favorites') || '[]'),
    scores: JSON.parse(localStorage.getItem('neonarcade_scores') || '{}'),
    gameStartTime: null,
    isFullscreen: false
};

const elements = {};

// ============================================================
// 4. INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    simulateLoading();
    initNavigation();
    initBottomNav();
    initMobileMenu();
    initSoundToggle();
    initGameControls();
    initFullscreenBtn();
    initSearch();
    renderGames();
    renderLeaderboard();
    initScrollReveal();
    console.log('%c🎮 NeonArcade v5.0 Loaded!', 'color:#b347d9;font-size:16px;font-weight:bold;');
});

// ============================================================
// 5. CACHE ELEMENTS
// ============================================================

function cacheElements() {
    [
        'loading-screen','app','hamburger','mobile-menu',
        'sound-toggle','featured-games','games-grid',
        'leaderboard-content','game-canvas','game-overlay',
        'game-score','current-game-title','game-instructions',
        'overlay-title','overlay-score','back-to-games',
        'resume-btn','overlay-restart-btn','game-search',
        'search-clear','game-wrapper','fullscreen-btn',
        'instruction-toast','game-header','bottom-nav'
    ].forEach(id => {
        elements[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
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
        'Generating game thumbnails...',
        'Warming up the arcade...',
        'Calibrating audio engine...',
        'Almost there...'
    ];
    let progress = 0, tipIdx = 0;

    const interval = setInterval(() => {
        progress += Math.random() * 18 + 4;
        if (progress > 100) progress = 100;
        if (fill) fill.style.width = `${progress}%`;

        const newTip = Math.floor((progress / 100) * tips.length);
        if (newTip !== tipIdx && newTip < tips.length) {
            tipIdx = newTip;
            if (text) {
                text.style.opacity = '0';
                setTimeout(() => { if (text) { text.textContent = tips[tipIdx]; text.style.opacity = '1'; } }, 200);
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                elements.loadingScreen?.classList.add('fade-out');
                elements.app?.classList.remove('hidden');
                setTimeout(() => {
                    elements.app?.classList.add('visible');
                    if (elements.loadingScreen) elements.loadingScreen.style.display = 'none';
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
        link.addEventListener('click', e => {
            e.preventDefault();
            if (window.audioManager) audioManager.play('navigate');
            navigateTo(link.dataset.page);
        });
    });
    if (elements.backToGames) {
        elements.backToGames.addEventListener('click', () => {
            if (window.audioManager) audioManager.play('click');
            exitFullscreen();
            destroyCurrentGame();
            navigateTo('games');
        });
    }
}

function initBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            if (window.audioManager) audioManager.play('click');
            navigateTo(item.dataset.page);
        });
    });
}

function navigateTo(page) {
    if (!['home','games','leaderboard','about','game'].includes(page)) return;

    if (state.currentPage === 'game' && page !== 'game') {
        exitFullscreen();
        destroyCurrentGame();
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`${page}-page`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));

    elements.mobileMenu?.classList.remove('active');
    elements.hamburger?.classList.remove('active');
    document.body.classList.remove('menu-open');

    if (elements.bottomNav) elements.bottomNav.style.display = page === 'game' ? 'none' : '';

    state.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'leaderboard') updateLeaderboardWithScores();
}

// ============================================================
// 8. GAME DESTROY
// ============================================================

function destroyCurrentGame() {
    if (state.gameInstance) {
        try { state.gameInstance.destroy(); } catch (e) { console.warn('Game destroy error:', e); }
        state.gameInstance = null;
    }

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fresh = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(fresh, canvas);
        elements.gameCanvas = fresh;
    }

    if (window.audioManager) { try { audioManager.stopAll(); } catch (e) {} }

    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (elements.gameScore) elements.gameScore.textContent = '0';

    state.currentGame = null;
    state.gameStartTime = null;
}

// ============================================================
// 9. FULLSCREEN
// ============================================================

function initFullscreenBtn() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;
    btn.addEventListener('click', e => {
        e.stopPropagation();
        if (window.audioManager) audioManager.play('click');
        toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', updateFullscreenUI);
    document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
}

function toggleFullscreen() {
    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFS) {
        (wrapper.requestFullscreen || wrapper.webkitRequestFullscreen || function () {}).call(wrapper);
        try { screen.orientation?.lock?.('portrait'); } catch (e) {}
    } else { exitFullscreen(); }
}

function exitFullscreen() {
    try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    } catch (e) {}
    state.isFullscreen = false;
    document.body.classList.remove('fs-active');
}

function updateFullscreenUI() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    state.isFullscreen = isFS;

    const ex = document.getElementById('fs-expand-icon');
    const co = document.getElementById('fs-compress-icon');
    if (ex) ex.style.display = isFS ? 'none' : '';
    if (co) co.style.display = isFS ? '' : 'none';

    document.body.classList.toggle('fs-active', isFS);

    setTimeout(() => {
        const canvas = document.getElementById('game-canvas');
        const wrapper = document.getElementById('game-wrapper');
        if (canvas && wrapper) {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            if (state.gameInstance?.resize) state.gameInstance.resize();
        }
    }, 120);
}

// ============================================================
// 10. MOBILE MENU
// ============================================================

function initMobileMenu() {
    if (!elements.hamburger || !elements.mobileMenu) return;
    elements.hamburger.addEventListener('click', () => {
        elements.hamburger.classList.toggle('active');
        elements.mobileMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
        if (window.audioManager) audioManager.play('click');
    });
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); navigateTo(link.dataset.page); });
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.navbar') && elements.mobileMenu?.classList.contains('active')) {
            elements.mobileMenu.classList.remove('active');
            elements.hamburger?.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

// ============================================================
// 11. SOUND TOGGLE
// ============================================================

function initSoundToggle() {
    if (!elements.soundToggle) return;
    elements.soundToggle.addEventListener('click', () => {
        state.soundEnabled = window.audioManager ? audioManager.toggle() : !state.soundEnabled;
        localStorage.setItem('neonarcade_sound', state.soundEnabled);
        const on = elements.soundToggle.querySelector('.sound-on');
        const off = elements.soundToggle.querySelector('.sound-off');
        if (on) on.classList.toggle('hidden', !state.soundEnabled);
        if (off) off.classList.toggle('hidden', state.soundEnabled);
    });
}

// ============================================================
// 12. SEARCH
// ============================================================

function initSearch() {
    if (!elements.gameSearch) return;
    let t;
    elements.gameSearch.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { state.searchQuery = e.target.value.toLowerCase().trim(); filterAndRenderGames(); }, 300);
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
// 13. GAME CONTROLS
// ============================================================

function initGameControls() {
    if (elements.resumeBtn) {
        elements.resumeBtn.addEventListener('click', () => {
            if (state.gameInstance?.togglePause) state.gameInstance.togglePause();
            hideOverlay();
            if (window.audioManager) audioManager.play('click');
        });
    }
    if (elements.overlayRestartBtn) {
        elements.overlayRestartBtn.addEventListener('click', () => {
            if (window.audioManager) audioManager.play('click');
            restartGame();
        });
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && state.currentPage === 'game') {
            if (state.isFullscreen) exitFullscreen();
            else if (state.gameInstance?.togglePause) {
                const p = state.gameInstance.togglePause();
                p ? showOverlay('PAUSED') : hideOverlay();
            }
        }
    });
}

// ============================================================
// 14. OVERLAY
// ============================================================

function showOverlay(title, score = null, isHighScore = false) {
    const overlay = document.getElementById('game-overlay');
    if (!overlay) return;

    const titleEl = document.getElementById('overlay-title');
    const scoreEl = document.getElementById('overlay-score');
    if (titleEl) titleEl.textContent = title;

    if (scoreEl) {
        if (score !== null) {
            let html = `<div style="margin:6px 0">
                <span style="color:#8080a8;font-size:.9rem">Score</span><br>
                <span style="color:#d470ff;font-family:Orbitron;font-size:1.8rem;font-weight:900">${score.toLocaleString()}</span>`;
            if (isHighScore) html += '<br><span style="color:#39ff14;font-size:.85rem">🏆 NEW BEST!</span>';
            html += '</div>';
            if (state.scores[state.currentGame] && !isHighScore) {
                html += `<div style="color:#6a6a9a;font-size:.8rem">Best: ${state.scores[state.currentGame].toLocaleString()}</div>`;
            }
            scoreEl.innerHTML = html;
        } else { scoreEl.innerHTML = ''; }
    }

    if (elements.resumeBtn) elements.resumeBtn.style.display = title === 'GAME OVER' ? 'none' : '';
    overlay.classList.remove('hidden');
}

function hideOverlay() {
    const o = document.getElementById('game-overlay');
    if (o) o.classList.add('hidden');
}

// ============================================================
// 15. RESTART
// ============================================================

function restartGame() {
    hideOverlay();
    if (state.gameInstance) { try { state.gameInstance.destroy(); } catch (e) {} state.gameInstance = null; }
    const c = document.getElementById('game-canvas');
    if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); }
    if (elements.gameScore) elements.gameScore.textContent = '0';
    state.gameStartTime = Date.now();
    startGame(state.currentGame);
}

// ============================================================
// 16. GAME CARD RENDERING
// ============================================================

function renderGames() {
    renderFeaturedGames();
    renderGamesGrid();
    initFilterButtons();
}

function renderFeaturedGames() {
    if (!elements.featuredGames) return;
    const featured = [...gamesData].sort((a, b) => b.plays - a.plays).slice(0, 6);
    elements.featuredGames.innerHTML = featured.map(g => createGameCard(g)).join('');
    attachCardEvents(elements.featuredGames);
    setTimeout(() => genThumbs(elements.featuredGames), 50);
}

function renderGamesGrid() {
    if (!elements.gamesGrid) return;
    elements.gamesGrid.innerHTML = gamesData.map(g => createGameCard(g)).join('');
    attachCardEvents(elements.gamesGrid);
    setTimeout(() => genThumbs(elements.gamesGrid), 100);
}

function createGameCard(game) {
    const isFav = state.favorites.includes(game.id);
    return `
        <div class="game-card" data-game-id="${game.id}" data-category="${game.category}"
             data-tags="${game.tags.join(',')}" style="--game-color:${game.color}">
            <div class="game-card-thumb">
                <canvas class="game-thumb-canvas" data-game="${game.id}" width="480" height="300"></canvas>
                <span class="game-card-badge badge-${game.category}">${game.category}</span>
                <button class="game-card-fav" data-game-id="${game.id}">${isFav ? '❤️' : '🤍'}</button>
            </div>
            <div class="game-card-info">
                <div class="game-card-name">${game.name}</div>
                <div class="game-card-desc">${game.description}</div>
                <div class="game-card-rating">
                    ⭐ ${game.rating}
                    <span style="margin-left:auto;color:#6a6a9a;font-size:.65rem">${fmtNum(game.plays)} plays</span>
                </div>
            </div>
        </div>`;
}

function genThumbs(container) {
    if (!container) return;
    container.querySelectorAll('.game-thumb-canvas').forEach(cv => {
        const gid = cv.dataset.game;
        if (gid && typeof GameThumbnails !== 'undefined') {
            const url = GameThumbnails.generate(gid, 480, 300);
            const img = document.createElement('img');
            img.src = url;
            img.alt = gid;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:12px 12px 0 0;';
            img.loading = 'lazy';
            cv.replaceWith(img);
        }
    });
}

function attachCardEvents(container) {
    if (!container) return;
    container.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('.game-card-fav')) return;
            if (window.audioManager) audioManager.play('click');
            openGame(card.dataset.gameId);
        });
    });
    container.querySelectorAll('.game-card-fav').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(btn.dataset.gameId); });
    });
}

// ============================================================
// 17. FILTER
// ============================================================

function initFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeFilter = btn.dataset.filter;
            if (window.audioManager) audioManager.play('click');
            filterAndRenderGames();
        });
    });
}

function filterAndRenderGames() {
    const cards = document.querySelectorAll('#games-grid .game-card');
    let vis = 0;
    cards.forEach(card => {
        const cat = card.dataset.category;
        const tags = (card.dataset.tags || '').toLowerCase();
        const title = card.querySelector('.game-card-name')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.game-card-desc')?.textContent.toLowerCase() || '';
        const mf = state.activeFilter === 'all' || cat === state.activeFilter || (state.activeFilter === 'favorites' && state.favorites.includes(card.dataset.gameId));
        const ms = !state.searchQuery || title.includes(state.searchQuery) || desc.includes(state.searchQuery) || tags.includes(state.searchQuery) || cat.includes(state.searchQuery);
        card.style.display = mf && ms ? '' : 'none';
        if (mf && ms) vis++;
    });
    const nr = document.getElementById('no-results');
    if (nr) nr.style.display = vis === 0 ? 'block' : 'none';
}

// ============================================================
// 18. FAVORITES
// ============================================================

function toggleFavorite(gameId) {
    if (!gameId) return;
    const idx = state.favorites.indexOf(gameId);
    if (idx === -1) {
        state.favorites.push(gameId);
        showToast('❤️ Added to favorites!', 'success');
        if (window.audioManager) audioManager.play('collect');
    } else {
        state.favorites.splice(idx, 1);
        showToast('💔 Removed from favorites', 'info');
        if (window.audioManager) audioManager.play('click');
    }
    localStorage.setItem('neonarcade_favorites', JSON.stringify(state.favorites));
    document.querySelectorAll(`.game-card-fav[data-game-id="${gameId}"]`).forEach(btn => {
        btn.textContent = state.favorites.includes(gameId) ? '❤️' : '🤍';
    });
}

// ============================================================
// 19. OPEN GAME
// ============================================================

function openGame(gameId) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;

    destroyCurrentGame();
    state.currentGame = gameId;

    if (elements.currentGameTitle) elements.currentGameTitle.textContent = game.name;
    if (elements.gameScore) elements.gameScore.textContent = '0';

    if (window.audioManager) {
        audioManager.stopMusic();
        setTimeout(() => audioManager.startMusic('game'), 200);
    }

    navigateTo('game');
    showInstructionToast(game.instructions);
    state.gameStartTime = Date.now();

    // ─── FIX: Wait for game-page to be fully visible & laid out ───
    // requestAnimationFrame ensures the DOM has painted after navigateTo(),
    // then a second rAF confirms the layout is stable, THEN we start.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            startGame(gameId);
        });
    });
}

function showInstructionToast(text) {
    const toast = document.getElementById('instruction-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hide');
    setTimeout(() => toast.classList.add('hide'), 4000);
}

// ============================================================
// 20. START GAME
// ============================================================

function startGame(gameId) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    elements.gameCanvas = canvas;

    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;

    // ─── FIX: Force accurate dimensions before game boots ─────────
    // wrapper might have 0 size if page just became visible.
    // Use offsetWidth/offsetHeight which force a layout reflow,
    // falling back to window dimensions as a safe default.
    const wrapW = wrapper.offsetWidth  || window.innerWidth;
    const wrapH = wrapper.offsetHeight || (window.innerHeight - 48);

    canvas.width  = wrapW;
    canvas.height = wrapH;

    // Ensure the canvas CSS also matches so DPR scaling inside
    // LiquidSort's setupHDCanvas() reads correct getBoundingClientRect()
    canvas.style.width  = wrapW + 'px';
    canvas.style.height = wrapH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gameClasses = {
        'bubble-shooter':  typeof BubbleShooter  !== 'undefined' ? BubbleShooter  : null,
        'liquid-sort':     typeof LiquidSort      !== 'undefined' ? LiquidSort      : null,
        'knife-hit':       typeof KnifeHit        !== 'undefined' ? KnifeHit        : null,
        'color-bump':      typeof ColorBump       !== 'undefined' ? ColorBump       : null,
        'bottle-shooting': typeof BottleShooting  !== 'undefined' ? BottleShooting  : null,
        'color-up':        typeof ColorUp         !== 'undefined' ? ColorUp         : null,
        'flappy-bird':     typeof FlappyBird      !== 'undefined' ? FlappyBird      : null,
        'angry-birds':     typeof AngryBirds      !== 'undefined' ? AngryBirds      : null,
        'jewel-legend':    typeof JewelLegend     !== 'undefined' ? JewelLegend     : null,
        'block-vs-ball':   typeof BlockVsBall     !== 'undefined' ? BlockVsBall     : null
    };

    const GameClass = gameClasses[gameId];
    if (GameClass) {
        try {
            state.gameInstance = new GameClass(canvas, updateScore);
            console.log(`✅ Game started: ${gameId} (${wrapW}x${wrapH})`);
        } catch (err) {
            console.error(`❌ Error starting ${gameId}:`, err);
            showPlaceholder(ctx, canvas, gameId);
        }
    } else {
        showPlaceholder(ctx, canvas, gameId);
    }
}

function showPlaceholder(ctx, canvas, gameId) {
    const game = gamesData.find(g => g.id === gameId);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (typeof GameThumbnails !== 'undefined') {
        const img = new Image();
        img.onload = () => {
            ctx.globalAlpha = 0.25;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(10,10,26,0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawPlaceholderText(ctx, canvas, game);
        };
        img.src = GameThumbnails.generate(gameId);
    } else {
        drawPlaceholderText(ctx, canvas, game);
    }
}

function drawPlaceholderText(ctx, canvas, game) {
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(canvas.width * 0.06, 28)}px Orbitron, sans-serif`;
    ctx.fillStyle = '#d470ff';
    ctx.fillText(game ? game.name : 'Game', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = `${Math.min(canvas.width * 0.04, 16)}px Rajdhani, sans-serif`;
    ctx.fillStyle = '#8080a8';
    ctx.fillText('Coming Soon! 🎮', canvas.width / 2, canvas.height / 2 + 25);
    ctx.textAlign = 'left';
}

// ============================================================
// 21. UPDATE SCORE
// ============================================================

function updateScore(score, gameOver = false) {
    if (elements.gameScore) {
        elements.gameScore.textContent = score.toLocaleString();
        elements.gameScore.style.transform = 'scale(1.3)';
        setTimeout(() => { if (elements.gameScore) elements.gameScore.style.transform = 'scale(1)'; }, 200);
    }

    if (gameOver) {
        const gid = state.currentGame;
        const isNew = !state.scores[gid] || score > state.scores[gid];

        if (isNew && score > 0) {
            state.scores[gid] = score;
            localStorage.setItem('neonarcade_scores', JSON.stringify(state.scores));
            setTimeout(() => showToast(`🏆 New High Score: ${score.toLocaleString()}!`, 'success'), 500);
            updateLeaderboardWithScores();
        }

        if (window.audioManager) { try { audioManager.play('gameOver'); } catch (e) {} }
        if (window.audioManager) {
            audioManager.stopMusic();
            setTimeout(() => audioManager.startMusic('menu'), 1000);
        }

        showOverlay('GAME OVER', score, isNew);
    }
}

// ============================================================
// 22. LEADERBOARD
// ============================================================

function renderLeaderboard() { updateLeaderboardWithScores(); }

function updateLeaderboardWithScores() {
    if (!elements.leaderboardContent) return;

    const entries = [...leaderboardData.all];
    const pName = localStorage.getItem('neonarcade_username') || 'You';

    Object.entries(state.scores).forEach(([gid, score]) => {
        if (!score || score <= 0) return;
        const game = gamesData.find(g => g.id === gid);
        if (!game) return;
        const existing = entries.findIndex(e => e.name === pName && e.game === game.name);
        if (existing !== -1) {
            if (score > entries[existing].score) entries[existing].score = score;
        } else {
            entries.push({ name: pName, game: game.name, score, avatar: '🎮', isPlayer: true });
        }
    });

    entries.sort((a, b) => b.score - a.score);

    elements.leaderboardContent.innerHTML = entries.slice(0, 15).map((entry, i) => {
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const playerTag = entry.isPlayer ? ' <small style="color:#39ff14;font-weight:700">YOU</small>' : '';

        return `
            <div class="leaderboard-entry${entry.isPlayer ? ' player-entry' : ''}" style="animation-delay:${i * 0.05}s">
                <span class="lb-rank ${rankClass}">${rank}</span>
                <span class="lb-avatar">${entry.avatar || '🎮'}</span>
                <div class="lb-info">
                    <div class="lb-name">${entry.name}${playerTag}</div>
                    <div class="lb-game">${entry.game}</div>
                </div>
                <span class="lb-score">${entry.score.toLocaleString()}</span>
            </div>`;
    }).join('');
}

// ============================================================
// 23. TOAST
// ============================================================

function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:70px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px;';
        document.body.appendChild(container);
    }
    const colors = { success: '#39ff14', error: '#fe2254', info: '#00f5ff', warning: '#ffff00' };
    const color = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = `background:rgba(10,10,20,.92);border:1px solid ${color};border-left:4px solid ${color};border-radius:8px;padding:10px 16px;color:#fff;font-family:Rajdhani,sans-serif;font-size:13px;font-weight:600;box-shadow:0 4px 20px ${color}33;transform:translateX(120%);transition:transform .3s cubic-bezier(.175,.885,.32,1.275);pointer-events:auto;cursor:pointer;backdrop-filter:blur(8px);`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
    const dismiss = () => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); };
    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

// ============================================================
// 24. SCROLL REVEAL
// ============================================================

function initScrollReveal() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.scroll-fade-in').forEach(el => obs.observe(el));
}

// ============================================================
// 25. WINDOW EVENTS
// ============================================================

window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

window.addEventListener('resize', debounce(() => {
    if (state.currentPage === 'game' && state.gameInstance) {
        const c = document.getElementById('game-canvas');
        const w = document.getElementById('game-wrapper');
        if (c && w) {
            c.width  = w.offsetWidth  || window.innerWidth;
            c.height = w.offsetHeight || (window.innerHeight - 48);
            c.style.width  = c.width  + 'px';
            c.style.height = c.height + 'px';
            if (state.gameInstance.resize) state.gameInstance.resize();
        }
    }
}, 250));

document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentPage === 'game' && state.gameInstance) {
        if (state.gameInstance.togglePause && !state.gameInstance.isPaused) {
            state.gameInstance.togglePause();
            showOverlay('PAUSED');
        }
    }
});

window.addEventListener('beforeunload', () => destroyCurrentGame());

// ============================================================
// 26. UTILS
// ============================================================

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}

const formatNumber = fmtNum;