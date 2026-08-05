(function () {
  'use strict';

  const HISCORES_KEY = 'tetris-highscores';
  const NAME_KEY = 'tetris-player-name';

  function defaultScores() {
    return { v: 1, entries: [], bestCombo: 0, maxLines: 0 };
  }

  function loadScores() {
    try {
      const raw = localStorage.getItem(HISCORES_KEY);
      if (!raw) return defaultScores();
      const data = JSON.parse(raw);
      if (
        !data ||
        typeof data !== 'object' ||
        data.v !== 1 ||
        !Array.isArray(data.entries)
      ) {
        return defaultScores();
      }
      return {
        v: 1,
        entries: data.entries.filter(e => e && typeof e === 'object'),
        bestCombo: typeof data.bestCombo === 'number' ? data.bestCombo : 0,
        maxLines: typeof data.maxLines === 'number' ? data.maxLines : 0,
      };
    } catch (err) {
      return defaultScores();
    }
  }

  function saveScores(data) {
    try {
      localStorage.setItem(HISCORES_KEY, JSON.stringify(data));
    } catch (err) {
      // ignore quota / privacy-mode errors so the game never crashes on save
    }
  }

  function loadPlayerName() {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function savePlayerName(name) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (err) {
      // ignore
    }
  }

  function sanitizeName(raw) {
    const trimmed = String(raw || '').trim().slice(0, 12);
    return trimmed || 'AAA';
  }

  // ---- small DOM helper ----

  function el(tag, opts) {
    const node = document.createElement(tag);
    if (opts) {
      if (opts.className) node.className = opts.className;
      if (opts.id) node.id = opts.id;
      if (opts.text !== undefined) node.textContent = opts.text;
      if (opts.type) node.type = opts.type;
    }
    return node;
  }

  function buildScoreList(entries, currentEntry) {
    const ol = el('ol', { className: 'hs-list' });
    if (!entries.length) {
      ol.appendChild(el('li', { className: 'hs-empty', text: 'Sin récords todavía' }));
      return ol;
    }
    entries.forEach(entry => {
      const li = el('li', { className: 'hs-entry' });
      if (currentEntry && entry === currentEntry) li.classList.add('hs-current');

      const nameSpan = el('span', { className: 'hs-name', text: entry.name });
      const scoreSpan = el('span', {
        className: 'hs-score',
        text: Number(entry.score || 0).toLocaleString(),
      });
      const levelSpan = el('span', { className: 'hs-level', text: 'Nv ' + (entry.level || 1) });

      li.append(nameSpan, scoreSpan, levelSpan);
      ol.appendChild(li);
    });
    return ol;
  }

  function insertSorted(entries, entry) {
    const copy = entries.slice();
    copy.push(entry);
    copy.sort((a, b) => (b.score || 0) - (a.score || 0));
    return copy.slice(0, 5);
  }

  // ---- Start screen ----

  let startScreenEl = null;
  let startTableEl = null;
  let startBestComboEl = null;
  let startMaxLinesEl = null;

  function renderStartStats() {
    if (!startScreenEl) return;
    const data = loadScores();
    startTableEl.innerHTML = '';
    startTableEl.appendChild(buildScoreList(data.entries));
    startBestComboEl.textContent = data.bestCombo;
    startMaxLinesEl.textContent = data.maxLines;
  }

  function buildStartScreen() {
    const overlayEl = el('div', { id: 'start-screen' });
    const box = el('div', { className: 'hs-box' });

    const title = el('h1', { className: 'hs-title', text: 'TETRIS' });

    const tableWrap = el('div', { id: 'hs-table', className: 'hs-table-wrap' });

    const bestComboEl = el('span', { className: 'value', id: 'hs-best-combo', text: '0' });
    const maxLinesEl = el('span', { className: 'value', id: 'hs-max-lines', text: '0' });

    const stats = el('div', { className: 'hs-stats' });
    const comboStat = el('div', { className: 'hs-stat' });
    comboStat.append(el('span', { className: 'label', text: 'MEJOR COMBO' }), bestComboEl);
    const linesStat = el('div', { className: 'hs-stat' });
    linesStat.append(el('span', { className: 'label', text: 'LÍNEAS MÁX' }), maxLinesEl);
    stats.append(comboStat, linesStat);

    const startBtn = el('button', { id: 'start-btn', text: 'JUGAR', type: 'button' });
    startBtn.addEventListener('click', () => {
      hideStartScreen();
      init();
    });

    const resetBtn = el('button', { id: 'hs-reset', text: 'Borrar récords', type: 'button' });
    resetBtn.addEventListener('click', () => {
      if (!confirm('¿Borrar todos los récords guardados?')) return;
      saveScores(defaultScores());
      renderStartStats();
    });

    box.append(title, tableWrap, stats, startBtn, resetBtn);
    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);

    startScreenEl = overlayEl;
    startTableEl = tableWrap;
    startBestComboEl = bestComboEl;
    startMaxLinesEl = maxLinesEl;
    renderStartStats();
  }

  window.showStartScreen = function () {
    if (!startScreenEl) {
      buildStartScreen(); // renders stats internally on first build
    } else {
      renderStartStats();
    }
    startScreenEl.classList.remove('hs-hidden');
  };

  window.hideStartScreen = function () {
    if (startScreenEl) startScreenEl.classList.add('hs-hidden');
  };

  window.getHighScores = function () {
    return loadScores().entries;
  };

  // ---- Game over UI ----

  let runMaxCombo = 0;

  function hideGameOverUI() {
    const box = document.querySelector('.overlay-box');
    if (!box) return;
    const existing = box.querySelector('#hs-gameover');
    if (existing) existing.remove();
  }

  function newGameOverWrap() {
    return el('div', { id: 'hs-gameover', className: 'hs-gameover' });
  }

  function onGameOver() {
    cancelAnimationFrame(animId);
    paused = true;

    const data = loadScores();
    data.bestCombo = Math.max(data.bestCombo, runMaxCombo);
    data.maxLines = Math.max(data.maxLines, lines);
    saveScores(data);

    const qualifies =
      data.entries.length < 5 || score > data.entries[data.entries.length - 1].score;

    const box = document.querySelector('.overlay-box');
    if (!box) return;
    hideGameOverUI();

    if (qualifies) {
      const wrap = newGameOverWrap();
      const form = el('div', { id: 'hs-name-form', className: 'hs-name-form' });
      const label = el('p', {
        className: 'hs-form-label',
        text: '¡Nuevo récord! Introduce tu nombre:',
      });
      const input = el('input', { id: 'hs-name-input', type: 'text' });
      input.maxLength = 12;
      input.value = loadPlayerName();
      const saveBtn = el('button', { id: 'hs-name-save', text: 'Guardar', type: 'button' });

      const doSave = () => {
        const name = sanitizeName(input.value);
        savePlayerName(name);
        const entry = {
          name,
          score,
          lines,
          level,
          combo: runMaxCombo,
          date: new Date().toISOString(),
        };
        // Reuse the `data` object already loaded/updated above instead of
        // re-reading and re-merging from localStorage.
        data.entries = insertSorted(data.entries, entry);
        saveScores(data);

        hideGameOverUI();
        const doneWrap = newGameOverWrap();
        doneWrap.appendChild(buildScoreList(data.entries, entry));
        box.appendChild(doneWrap);
      };

      saveBtn.addEventListener('click', doSave);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSave();
      });

      form.append(label, input, saveBtn);
      wrap.appendChild(form);
      box.appendChild(wrap);
      setTimeout(() => input.focus(), 0);
    } else {
      const wrap = newGameOverWrap();
      wrap.appendChild(buildScoreList(data.entries));
      box.appendChild(wrap);
    }
  }

  // ---- Wrappers over game.js globals (see CLAUDE.md rules W1-W7) ----

  const _prevEndGame = endGame;
  window.endGame = function (...args) {
    const wasOver = gameOver;
    const ret = _prevEndGame.apply(this, args);
    if (!wasOver) onGameOver();
    return ret;
  };

  const _prevUpdateCombo = updateCombo;
  window.updateCombo = function (...args) {
    const ret = _prevUpdateCombo.apply(this, args);
    if (comboCount > runMaxCombo) runMaxCombo = comboCount;
    return ret;
  };

  const _prevInit = init;
  window.init = function (...args) {
    const ret = _prevInit.apply(this, args);
    runMaxCombo = 0;
    hideGameOverUI();
    hideStartScreen();
    return ret;
  };

  // ---- Fix stale restart button (game.js bound the ORIGINAL init) ----

  const oldBtn = document.getElementById('restart-btn');
  if (oldBtn) {
    const btn = oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.addEventListener('click', () => {
      hideGameOverUI();
      init();
    });
  }

  // ---- Freeze the auto-started game behind the start screen ----

  cancelAnimationFrame(animId);
  paused = true;
  showStartScreen();
})();
