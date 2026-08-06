'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (cruz)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_COMBO_MULTIPLIER = 5;
const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const MAX_RECORDS = 5;

function pathRoundedRect(context, x, y, w, h, r) {
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#f06292'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00e5ff', '#ffea00', '#e040fb', '#00e676', '#ff1744', '#2979ff', '#ff9100', '#ff4081'],
    background: '#000000',
    gridColor: 'rgba(0, 229, 255, 0.08)',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = color;
      context.shadowBlur = (alpha ?? 1) < 1 ? 6 : 14;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(x * size + 2.5, y * size + 2.5, size - 5, size - 5);
      context.restore();
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8d8ea', '#fff1a8', '#d9b8f0', '#b8e6c1', '#f5b8c0', '#b8cdf0', '#f5d3a8', '#f0b8d9'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      pathRoundedRect(context, x * size + 2, y * size + 2, size - 4, size - 4, 6);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.3)';
      pathRoundedRect(context, x * size + 2, y * size + 2, size - 4, (size - 4) / 2, 6);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel Art',
    colors: [null, '#00d9ff', '#f7d51d', '#c724b1', '#3fd63f', '#ff3838', '#3a7bd5', '#ff9f1a', '#ff4fa3'],
    drawBlock(context, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const px = x * size, py = y * size;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      const cell = Math.max(3, Math.floor((size - 2) / 4));
      context.fillStyle = 'rgba(255,255,255,0.18)';
      for (let ry = 0; ry < 4; ry++) {
        for (let rx = 0; rx < 4; rx++) {
          if ((rx + ry) % 2 === 0) {
            context.fillRect(px + 1 + rx * cell, py + 1 + ry * cell, cell, cell);
          }
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.4)';
      context.lineWidth = 1;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      context.globalAlpha = 1;
    },
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinButtons = document.querySelectorAll('.skin-btn');
const comboEl = document.getElementById('combo');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenu = document.getElementById('pause-menu');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const startLevelSelect = document.getElementById('start-level-select');
const startLevelSelectHome = document.getElementById('start-level-select-home');

const startScreen = document.getElementById('start-screen');
const startRecordsListEl = document.getElementById('start-records-list');
const startBestComboEl = document.getElementById('start-best-combo');
const startMaxLinesEl = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtnStart = document.getElementById('reset-records-btn-start');

const overlayRecordsPanel = document.getElementById('overlay-records-panel');
const nameEntryEl = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');
const resetRecordsBtnOverlay = document.getElementById('reset-records-btn-overlay');

const THEME_KEY = 'tetris-theme';
const MAX_START_LEVEL = 10;
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let comboCount, comboMultiplier, maxComboThisGame;
let gridLineColor;
let startLevel = 1;
let currentSkin;
let pendingRecordId = null;
let gameStarted = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function updateCombo(cleared) {
  comboCount = cleared > 0 ? comboCount + 1 : 0;
  comboMultiplier = comboCount > 0 ? Math.min(comboCount, MAX_COMBO_MULTIPLIER) : 1;
  if (comboCount > maxComboThisGame) maxComboThisGame = comboCount;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  updateCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level * comboMultiplier;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (comboMultiplier > 1) {
    comboEl.textContent = `COMBO x${comboMultiplier}`;
    comboEl.classList.remove('hidden');
  } else {
    comboEl.classList.add('hidden');
  }
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      bestCombo: parsed?.bestCombo ?? 0,
      maxLines: parsed?.maxLines ?? 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForRecords(candidateScore) {
  const records = loadRecords();
  if (records.length < MAX_RECORDS) return true;
  return candidateScore > records[records.length - 1].score;
}

function addRecord(name, recordScore) {
  const records = loadRecords();
  const id = Date.now() + Math.random();
  records.push({ id, name, score: recordScore });
  records.sort((a, b) => b.score - a.score);
  records.length = Math.min(records.length, MAX_RECORDS);
  saveRecords(records);
  return id;
}

function updateStatsAfterGame(finalLines, finalMaxCombo) {
  const stats = loadStats();
  if (finalMaxCombo > stats.bestCombo) stats.bestCombo = finalMaxCombo;
  if (finalLines > stats.maxLines) stats.maxLines = finalLines;
  saveStats(stats);
  return stats;
}

function renderRecordsList(listEl, highlightId) {
  const records = loadRecords();
  listEl.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin puntuaciones aún';
    listEl.appendChild(li);
    return;
  }
  records.forEach((rec, i) => {
    const li = document.createElement('li');
    if (highlightId != null && rec.id === highlightId) li.classList.add('highlight');
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = rec.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'score';
    scoreSpan.textContent = rec.score.toLocaleString();
    li.append(rank, name, scoreSpan);
    listEl.appendChild(li);
  });
}

function renderStats(comboEl, linesEl) {
  const stats = loadStats();
  comboEl.textContent = stats.bestCombo > 0 ? `x${stats.bestCombo}` : '-';
  linesEl.textContent = stats.maxLines > 0 ? stats.maxLines : '-';
}

function refreshRecordsUI(highlightId) {
  renderRecordsList(startRecordsListEl, null);
  renderStats(startBestComboEl, startMaxLinesEl);
  renderRecordsList(overlayRecordsListEl, highlightId ?? null);
  renderStats(overlayBestComboEl, overlayMaxLinesEl);
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los récords?')) return;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(STATS_KEY);
  pendingRecordId = null;
  nameEntryEl.classList.add('hidden');
  refreshRecordsUI(null);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem(THEME_KEY, theme);
  gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
}

function toggleTheme() {
  const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(activeTheme === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  localStorage.setItem(SKIN_KEY, currentSkin);
  skinButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.skin === currentSkin));
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved || 'retro');
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  SKINS[currentSkin].drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].gridColor || gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = SKINS[currentSkin].background;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayRecordsPanel.classList.remove('hidden');
  resetRecordsBtnOverlay.classList.remove('hidden');
  overlay.classList.remove('hidden');

  updateStatsAfterGame(lines, maxComboThisGame);

  pendingRecordId = null;
  if (qualifiesForRecords(score)) {
    nameEntryEl.classList.remove('hidden');
    playerNameInput.value = '';
    refreshRecordsUI(null);
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    nameEntryEl.classList.add('hidden');
    refreshRecordsUI(null);
  }
}

function submitRecordName() {
  if (nameEntryEl.classList.contains('hidden')) return;
  const name = playerNameInput.value.trim().slice(0, 10) || 'AAA';
  pendingRecordId = addRecord(name, score);
  nameEntryEl.classList.add('hidden');
  refreshRecordsUI(pendingRecordId);
}

function openPauseMenu() {
  pauseControls.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  pauseOverlay.classList.remove('hidden');
}

function closePauseMenu() {
  pauseOverlay.classList.add('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  comboCount = 0;
  comboMultiplier = 1;
  maxComboThisGame = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  nameEntryEl.classList.add('hidden');
  pendingRecordId = null;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function populateStartLevelSelect() {
  [startLevelSelect, startLevelSelectHome].forEach(select => {
    for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
      const option = document.createElement('option');
      option.value = lvl;
      option.textContent = lvl;
      select.appendChild(option);
    }
    select.value = startLevel;
  });
}

function setStartLevel(value) {
  startLevel = Number(value);
  startLevelSelect.value = startLevel;
  startLevelSelectHome.value = startLevel;
}

function startGame() {
  gameStarted = true;
  startScreen.classList.add('hidden');
  init();
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
skinButtons.forEach(btn => btn.addEventListener('click', () => applySkin(btn.dataset.skin)));

playBtn.addEventListener('click', startGame);
saveRecordBtn.addEventListener('click', submitRecordName);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitRecordName();
});
resetRecordsBtnStart.addEventListener('click', resetRecords);
resetRecordsBtnOverlay.addEventListener('click', resetRecords);

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
backToMenuBtn.addEventListener('click', () => {
  pauseControls.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
});
startLevelSelect.addEventListener('change', () => setStartLevel(startLevelSelect.value));
startLevelSelectHome.addEventListener('change', () => setStartLevel(startLevelSelectHome.value));

populateStartLevelSelect();
initTheme();
initSkin();
refreshRecordsUI(null);
