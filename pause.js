(function () {
  'use strict';

  const INITIAL_LEVEL_KEY = 'tetris-initial-level';
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 15;

  // Module-level level applied at the start of the current game. Defaults to
  // 1 in case clearLines() somehow fires before the first init().
  let startLevel = 1;

  let menuOpen = false;
  let controlsVisible = false;

  // ---------------------------------------------------------------------
  // Initial-level persistence
  // ---------------------------------------------------------------------

  function clampLevel(n) {
    n = Math.floor(n);
    if (!Number.isFinite(n)) return MIN_LEVEL;
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n));
  }

  function getInitialLevel() {
    try {
      const raw = localStorage.getItem(INITIAL_LEVEL_KEY);
      const parsed = parseInt(raw, 10);
      if (Number.isNaN(parsed)) return MIN_LEVEL;
      return clampLevel(parsed);
    } catch (err) {
      return MIN_LEVEL;
    }
  }

  function setInitialLevel(n) {
    const clamped = clampLevel(n);
    try {
      localStorage.setItem(INITIAL_LEVEL_KEY, String(clamped));
    } catch (err) {
      // ignore storage errors (e.g. private mode / quota)
    }
    return clamped;
  }

  function applyInitialLevel() {
    startLevel = getInitialLevel();
    if (startLevel > 1) {
      level = startLevel;
      dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
      updateHUD();
    }
  }

  function createLevelSelect() {
    const select = document.createElement('select');
    select.className = 'level-select';
    for (let i = MIN_LEVEL; i <= MAX_LEVEL; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      select.appendChild(opt);
    }
    select.value = String(getInitialLevel());
    select.addEventListener('change', () => {
      setInitialLevel(parseInt(select.value, 10));
    });
    return select;
  }

  // ---------------------------------------------------------------------
  // Menu DOM construction
  // ---------------------------------------------------------------------

  const menuEl = document.createElement('div');
  menuEl.id = 'pause-menu';
  menuEl.style.display = 'none';

  const box = document.createElement('div');
  box.className = 'pause-menu-box';

  const title = document.createElement('p');
  title.className = 'pause-menu-title';
  title.textContent = 'PAUSA';

  const resumeBtn = document.createElement('button');
  resumeBtn.id = 'pause-resume';
  resumeBtn.type = 'button';
  resumeBtn.textContent = 'Reanudar';
  resumeBtn.addEventListener('click', () => {
    resumeGame();
  });

  const restartBtn = document.createElement('button');
  restartBtn.id = 'pause-restart';
  restartBtn.type = 'button';
  restartBtn.textContent = 'Reiniciar';
  restartBtn.addEventListener('click', () => {
    closePauseMenu();
    init();
  });

  const controlsToggleBtn = document.createElement('button');
  controlsToggleBtn.id = 'pause-controls-btn';
  controlsToggleBtn.type = 'button';
  controlsToggleBtn.textContent = 'Ver controles';
  controlsToggleBtn.addEventListener('click', () => {
    controlsVisible = !controlsVisible;
    controlsList.style.display = controlsVisible ? 'flex' : 'none';
  });

  const controlsList = document.createElement('ul');
  controlsList.id = 'pause-controls';
  controlsList.style.display = 'none';
  const bindings = [
    ['← →', 'mover'],
    ['↑ / X', 'rotar'],
    ['↓', 'bajar'],
    ['Space', 'caída'],
    ['P', 'pausa'],
    ['Esc', 'pausa'],
  ];
  bindings.forEach(([key, label]) => {
    const li = document.createElement('li');
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    li.appendChild(kbd);
    li.appendChild(document.createTextNode(' ' + label));
    controlsList.appendChild(li);
  });

  const levelWrap = document.createElement('div');
  levelWrap.className = 'pause-level-wrap';
  const levelLabel = document.createElement('label');
  levelLabel.setAttribute('for', 'pause-level');
  levelLabel.textContent = 'Nivel inicial';
  const levelSelect = createLevelSelect();
  levelSelect.id = 'pause-level';
  const levelNote = document.createElement('p');
  levelNote.className = 'pause-level-note';
  levelNote.textContent = 'Se aplicará en la próxima partida';
  levelWrap.appendChild(levelLabel);
  levelWrap.appendChild(levelSelect);
  levelWrap.appendChild(levelNote);

  box.appendChild(title);
  box.appendChild(resumeBtn);
  box.appendChild(restartBtn);
  box.appendChild(controlsToggleBtn);
  box.appendChild(controlsList);
  box.appendChild(levelWrap);
  menuEl.appendChild(box);
  document.body.appendChild(menuEl);

  // ---------------------------------------------------------------------
  // Open / close / resume
  // ---------------------------------------------------------------------

  function openPauseMenu() {
    if (gameOver) return;
    if (document.body.dataset.modal && document.body.dataset.modal !== 'pause') return;
    if (menuOpen) return;
    paused = true;
    cancelAnimationFrame(animId);
    document.body.dataset.modal = 'pause';
    menuOpen = true;
    menuEl.style.display = 'flex';
  }

  function resumeGame() {
    menuOpen = false;
    menuEl.style.display = 'none';
    delete document.body.dataset.modal;

    cancelAnimationFrame(animId);
    paused = false;
    lastTime = performance.now();
    dropAccum = 0;
    animId = requestAnimationFrame(loop);
  }

  function closePauseMenu() {
    resumeGame();
  }

  // ---------------------------------------------------------------------
  // Input interception (capture-phase on window, fires before game.js's
  // bubble-phase listener on document)
  // ---------------------------------------------------------------------

  function onPauseKey(e) {
    if (e.code !== 'KeyP' && e.code !== 'Escape') return;

    const modal = document.body.dataset.modal;
    if (modal && modal !== 'pause') return;

    if (menuOpen) {
      e.preventDefault();
      e.stopImmediatePropagation();
      resumeGame();
      return;
    }

    if (e.code === 'KeyP') {
      if (gameOver) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openPauseMenu();
    }
    // Escape with no menu open: nothing to do, let it propagate.
  }

  window.addEventListener('keydown', onPauseKey, true);

  // ---------------------------------------------------------------------
  // Wrappers
  // ---------------------------------------------------------------------

  const _prevInit = init;
  window.init = function () {
    _prevInit();
    applyInitialLevel();
  };

  const _prevClearLines = clearLines;
  window.clearLines = function () {
    _prevClearLines();
    const want = startLevel + Math.floor(lines / 10);
    if (level !== want) {
      level = want;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      updateHUD();
    }
  };

  const _prevLoop = loop;
  window.loop = function (ts) {
    if (paused || gameOver) return;
    _prevLoop(ts);
  };

  window.togglePause = function () {
    if (menuOpen) {
      resumeGame();
    } else {
      openPauseMenu();
    }
  };

  // ---------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------

  window.openPauseMenu = openPauseMenu;
  window.closePauseMenu = closePauseMenu;
  window.getInitialLevel = getInitialLevel;
  window.setInitialLevel = setInitialLevel;
  window.createLevelSelect = createLevelSelect;
})();
