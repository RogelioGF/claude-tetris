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

There are no automated tests. Verify changes manually by playing the game in a browser (see Controls in README.md: arrows to move, ↑/X to rotate, Space to hard drop, P to pause).

## Architecture

The whole project is three files with no module system — everything in `game.js` lives in one global scope and executes top-to-bottom, ending with a call to `init()` that starts the game loop.

- **`index.html`** — DOM shell: the `#board` canvas (300×600, i.e. `COLS×BLOCK` by `ROWS×BLOCK`), the `#next-canvas` preview, HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- **`style.css`** — dark/retro arcade visual theme only.
- **`game.js`** — all game logic, roughly in these layers:
  - **State**: module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) — no state container/class, just globals mutated by functions.
  - **Board model**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece locked there.
  - **Pieces**: the 7 tetrominoes as square matrices in `PIECES`; rotation is `rotateCW` (transpose + reverse), and `tryRotate` applies wall-kick offsets `[0, -1, 1, -2, 2]` on the x-axis until a non-colliding position is found.
  - **Collision**: `collide(shape, ox, oy)` is the single source of truth, used for movement, rotation, ghost-piece projection, and spawn checks alike.
  - **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece one row (or locks it) once `dropAccum >= dropInterval`.
  - **Locking/scoring**: `lockPiece()` → `merge()` writes the piece into `board`, then `clearLines()` sweeps bottom-up, removing full rows and unshifting empty ones, scoring via `LINE_SCORES` (`[0,100,300,500,800]`) × `level`. Level increases every 10 lines and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.
  - **Rendering**: `draw()` clears and redraws the grid, locked board, ghost piece (`ghostY()` projected downward, drawn at `globalAlpha 0.2`), and the current piece each frame; `drawNext()` renders the preview canvas separately.
  - **Input**: a single `keydown` listener switches on `e.code` (ArrowLeft/Right/Down/Up, KeyX, Space, KeyP) and is gated by `paused`/`gameOver`.

When changing board dimensions or block size (`COLS`, `ROWS`, `BLOCK` at the top of `game.js`), the `width`/`height` attributes of `#board` in `index.html` must be updated to match (`COLS × BLOCK`, `ROWS × BLOCK`) or rendering will be misaligned/clipped.

README.md (in Spanish) has additional detail, including a full parameter-tuning table and control scheme — consult it for anything not covered above.
