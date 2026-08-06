# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris implemented in vanilla JavaScript (ES6+) with HTML5 Canvas and CSS. No dependencies, no build step, no package.json.

## Running / testing

There is no build, lint, or test tooling. To run the game, serve or open `index.html` directly:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or simply open index.html in a browser
```

There are no automated tests. Verify changes manually by playing the game in a browser (see Controls in README.md: arrows to move, ↑/X to rotate, Space to hard drop, P/Esc to pause).

## Architecture

The whole project is three files with no module system — everything in `game.js` lives in one global scope. It no longer auto-starts: the file ends by wiring up listeners and calling `populateStartLevelSelect()` / `initTheme()` / `initSkin()` / `refreshRecordsUI(null)`, and the game loop only begins once the player clicks "Jugar" on `#start-screen`, which calls `startGame()` → `init()`.

- **`index.html`** — DOM shell: the `#board` canvas (300×600, i.e. `COLS×BLOCK` by `ROWS×BLOCK`), the `#next-canvas` preview, HUD spans (`#score`, `#lines`, `#level`), a skin-selector panel, and three separate overlays — `#start-screen` (records + start-level picker + "Jugar"), `#overlay` (game-over only: score, records panel, name entry), and `#pause-overlay` (its own resume/restart/controls/level-select menu, independent of `#overlay`).
- **`style.css`** — dark/retro arcade visual theme, plus the pause-menu, records-panel, and skin-button styles layered on top.
- **`game.js`** — all game logic, roughly in these layers:
  - **State**: module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `startLevel`, `currentSkin`, `gameStarted`, `pendingRecordId`, ...) — no state container/class, just globals mutated by functions.
  - **Board model**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–8` identifying which piece locked there.
  - **Pieces**: the 7 tetrominoes plus one pentomino (a 5-block cross/plus shape) as square matrices in `PIECES`; rotation is `rotateCW` (transpose + reverse), and `tryRotate` applies wall-kick offsets `[0, -1, 1, -2, 2]` on the x-axis until a non-colliding position is found.
  - **Collision**: `collide(shape, ox, oy)` is the single source of truth, used for movement, rotation, ghost-piece projection, and spawn checks alike.
  - **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece one row (or locks it) once `dropAccum >= dropInterval`.
  - **Locking/scoring**: `lockPiece()` → `merge()` writes the piece into `board`, then `clearLines()` sweeps bottom-up, removing full rows and unshifting empty ones, scoring via `LINE_SCORES` (`[0,100,300,500,800]`) × `level` × the combo multiplier (`updateCombo`, capped at `MAX_COMBO_MULTIPLIER`). Level is `startLevel + Math.floor(lines / 10)` and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`. `startLevel` (1–`MAX_START_LEVEL`) is chosen via the `<select>` on the start screen or the pause menu (`populateStartLevelSelect` fills both; `setStartLevel` keeps them in sync).
  - **Rendering**: `draw()` clears the canvas, fills the active skin's `background` if it has one, and redraws the grid, locked board, ghost piece (`ghostY()` projected downward, drawn at `globalAlpha 0.2`), and the current piece each frame via `drawBlock`, which just delegates to `SKINS[currentSkin].drawBlock(...)`; `drawNext()` renders the preview canvas the same way. There is no standalone `COLORS` array anymore — each entry in the `SKINS` registry (`retro`/`neon`/`pastel`/`pixel`) carries its own `colors` palette and `drawBlock` renderer, selected via `applySkin()`/`initSkin()` and persisted in `localStorage` (`tetris-skin`).
  - **Pause**: `togglePause()` shows/hides `#pause-overlay` via `openPauseMenu()`/`closePauseMenu()` — it no longer touches `#overlay`, which is reserved for game-over.
  - **Records**: `endGame()` sets `gameOver`, shows `#overlay`, updates the best-combo/max-lines stats (`updateStatsAfterGame`), and if the score qualifies for the top `MAX_RECORDS` (`qualifiesForRecords`) reveals the name-entry form; `submitRecordName()` → `addRecord()` persists to `localStorage` (`tetris-records`, `tetris-stats`) and `refreshRecordsUI()` re-renders both the start-screen and game-over records lists.
  - **Input**: a single `keydown` listener first checks `gameStarted` (ignored before "Jugar" is clicked), then switches on `e.code` (ArrowLeft/Right/Down/Up, KeyX, Space, KeyP/Escape) and is gated by `paused`/`gameOver`.

When changing board dimensions or block size (`COLS`, `ROWS`, `BLOCK` at the top of `game.js`), the `width`/`height` attributes of `#board` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`) or rendering will be misaligned/clipped.

README.md (in Spanish) has additional detail, including a full parameter-tuning table and control scheme — consult it for anything not covered above.
