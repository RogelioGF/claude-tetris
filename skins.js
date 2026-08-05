(function () {
  'use strict';

  const SKIN_KEY = 'tetris-skin';
  const SKIN_IDS = ['retro', 'neon', 'pastel', 'pixel'];

  // ---- small shared helpers ----

  function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  // hex color -> lighter/darker hex (percent in [-100, 100])
  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const delta = (percent / 100) * 255;
    const r = clampByte(((num >> 16) & 0xff) + delta);
    const g = clampByte(((num >> 8) & 0xff) + delta);
    const b = clampByte((num & 0xff) + delta);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // shared inset-rect math used by every draw implementation
  function cellRect(x, y, size) {
    const px = x * size + 1;
    const py = y * size + 1;
    const w = size - 2;
    const h = size - 2;
    return { px, py, w, h };
  }

  const CAN_ROUND_RECT = typeof CanvasRenderingContext2D !== 'undefined'
    && typeof CanvasRenderingContext2D.prototype.roundRect === 'function';

  let storageOK = true;
  function storageGet(key) {
    if (!storageOK) return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      storageOK = false;
      return null;
    }
  }
  function storageSet(key, value) {
    if (!storageOK) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      storageOK = false;
    }
  }

  // ---- draw implementations: signature (context, x, y, color, size, alpha) ----

  function drawRetro(context, x, y, color, size, alpha) {
    const { px, py, w, h } = cellRect(x, y, size);
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, w, 4);
    context.globalAlpha = 1;
  }

  function drawNeon(context, x, y, color, size, alpha) {
    const { px, py, w, h } = cellRect(x, y, size);
    context.globalAlpha = alpha;
    if (alpha >= 1) {
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
    }
    context.fillStyle = '#0a0a12';
    context.fillRect(px, py, w, h);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(px + 1, py + 1, Math.max(0, w - 2), Math.max(0, h - 2));
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  function drawPastel(context, x, y, color, size, alpha) {
    const { px, py, w, h } = cellRect(x, y, size);
    const radius = size * 0.25;
    context.globalAlpha = alpha;
    context.fillStyle = color;
    if (CAN_ROUND_RECT) {
      context.beginPath();
      context.roundRect(px, py, w, h, radius);
      context.fill();
    } else {
      context.fillRect(px, py, w, h);
    }
    context.fillStyle = 'rgba(255,255,255,0.35)';
    if (CAN_ROUND_RECT) {
      context.beginPath();
      context.roundRect(px + w * 0.15, py + h * 0.12, w * 0.5, h * 0.3, radius * 0.5);
      context.fill();
    } else {
      context.fillRect(px + 2, py + 2, w * 0.5, h * 0.25);
    }
    context.globalAlpha = 1;
  }

  // Cache both the repeating CanvasPattern and the derived bevel-shade color
  // per source color, keyed by `${color}@${tileSize}` (pattern tiles are
  // built at a fixed on-screen size, so the key must include it too).
  const pixelStyleCache = new Map();
  function getPixelStyle(context, color, size) {
    const key = color + '@' + size;
    let entry = pixelStyleCache.get(key);
    if (entry) return entry;

    const tile = 8;
    const off = document.createElement('canvas');
    off.width = tile;
    off.height = tile;
    const octx = off.getContext('2d');
    const light = shadeColor(color, 18);
    const dark = shadeColor(color, -25);
    octx.fillStyle = color;
    octx.fillRect(0, 0, tile, tile);
    octx.fillStyle = light;
    octx.fillRect(0, 0, tile / 2, tile / 2);
    octx.fillRect(tile / 2, tile / 2, tile / 2, tile / 2);
    octx.fillStyle = dark;
    octx.fillRect(tile / 2, 0, tile / 2, tile / 2);
    octx.fillRect(0, tile / 2, tile / 2, tile / 2);

    entry = { pattern: context.createPattern(off, 'repeat'), bevel: shadeColor(color, -40) };
    pixelStyleCache.set(key, entry);
    return entry;
  }

  function drawPixel(context, x, y, color, size, alpha) {
    const { px, py, w, h } = cellRect(x, y, size);
    const style = getPixelStyle(context, color, size);
    context.globalAlpha = alpha;
    context.fillStyle = style.pattern;
    context.fillRect(px, py, w, h);
    context.fillStyle = style.bevel;
    context.fillRect(px, py + h - 2, w, 2);
    context.fillRect(px + w - 2, py, 2, h);
    context.globalAlpha = 1;
  }

  // Retro and Pixel Art intentionally share the same base palette (Pixel Art
  // differs only in how each block is rendered, not its colors).
  const BASE_COLORS = [
    null,
    '#4dd0e1',
    '#ffd54f',
    '#ba68c8',
    '#81c784',
    '#e57373',
    '#90caf9',
    '#ffb74d',
    '#f06292',
  ];

  const SKINS = {
    retro: {
      label: 'Retro',
      colors: BASE_COLORS,
      draw: drawRetro,
      themeToggle: true,
    },
    neon: {
      label: 'Neon',
      colors: [
        null,
        '#00fff2',
        '#faff00',
        '#ff00e6',
        '#00ff66',
        '#ff2b4d',
        '#00aaff',
        '#ff9100',
        '#ff2bd6',
      ],
      draw: drawNeon,
      themeToggle: false,
    },
    pastel: {
      label: 'Pastel',
      colors: [
        null,
        '#a8dadc',
        '#ffe8a3',
        '#d8bfd8',
        '#b5e8b5',
        '#f4a9a8',
        '#a9c9f4',
        '#f4c9a9',
        '#f4a9c9',
      ],
      draw: drawPastel,
      themeToggle: false,
    },
    pixel: {
      label: 'Pixel Art',
      colors: BASE_COLORS,
      draw: drawPixel,
      themeToggle: false,
    },
  };

  // Fallback for any future colorIndex beyond what a skin's palette defines
  // (e.g. a new piece type added to game.js later), so drawBlock never hands
  // a draw fn `undefined` as a color.
  const FALLBACK_COLOR = '#999999';

  let activeSkin = 'retro';

  // Full override (not wrap-and-call-through): drawRetro reproduces the
  // previous drawBlock behavior exactly, so no reference to the old
  // implementation is needed here.
  window.drawBlock = function (context, x, y, colorIndex, size, alpha) {
    if (!colorIndex) return;
    const skin = SKINS[activeSkin];
    const color = skin.colors[colorIndex] || FALLBACK_COLOR;
    skin.draw(context, x, y, color, size, alpha ?? 1);
  };

  function refreshCanvas() {
    gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
    if (typeof board !== 'undefined' && board && current && next) {
      draw();
      drawNext();
    }
  }

  function applySkin(id) {
    if (!SKIN_IDS.includes(id)) id = 'retro';
    document.documentElement.dataset.skin = id;
    activeSkin = id;
    storageSet(SKIN_KEY, id);
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) toggleBtn.hidden = !SKINS[id].themeToggle;
    refreshCanvas();
  }

  const _prevApplyTheme = applyTheme;
  window.applyTheme = function (theme) {
    _prevApplyTheme(theme);
    refreshCanvas();
  };

  function createSkinSelect() {
    const select = document.createElement('select');
    select.className = 'sk-select';
    SKIN_IDS.forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = SKINS[id].label;
      select.appendChild(option);
    });
    select.value = activeSkin;
    select.addEventListener('change', function () {
      applySkin(this.value);
    });
    return select;
  }

  function initSkin() {
    // applySkin() already validates and falls back to 'retro' for any
    // missing/invalid id, so a stored `null` (nothing saved yet) is handled
    // for free.
    applySkin(storageGet(SKIN_KEY));
  }

  window.getSkin = function () {
    return activeSkin;
  };
  window.setSkin = applySkin;
  window.SKIN_IDS = SKIN_IDS;
  window.createSkinSelect = createSkinSelect;

  initSkin();

  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'SKIN';
    const select = createSkinSelect();
    themeToggleBtn.insertAdjacentElement('beforebegin', label);
    themeToggleBtn.insertAdjacentElement('beforebegin', select);
  }
})();
