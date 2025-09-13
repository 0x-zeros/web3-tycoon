# Repository Guidelines

## Project Structure & Module Organization
- `client/tycoon_cocos/` — Cocos Creator 3.8+ project. Game code lives in `assets/scripts/` (TypeScript). Do not edit `library/` or `temp/`.
- `tools/asset-generator/` — Asset generation utilities (Node.js).
- `server/` — Placeholder for backend experiments.
- `assets/` and `docs/` — Shared resources and design/tech notes.
- Note: Some docs mention `contracts/` or `move/` as planned; create them when needed using standard Sui/Move layout.

## Build, Test, and Development Commands
- Cocos project: open `client/tycoon_cocos/` in Cocos Creator and use Preview/Build from the editor.
- Install deps used by scripts (inside Cocos project):
  - `cd client/tycoon_cocos && npm install`
  - If Cocos can’t resolve new packages, close the editor and delete `library/` and `temp/`, then reopen.
- Type check (optional, CLI): `npx tsc -p client/tycoon_cocos/tsconfig.json --noEmit`
- Asset generator:
  - `cd tools/asset-generator && npm install`
  - Examples: `npm run generate:tiles`, `npm run generate:ui`, `npm run print:prompts`

## Coding Style & Naming Conventions
- TypeScript: 2-space indent; `camelCase` for variables/functions; `PascalCase` for classes and Cocos script filenames (e.g., `RoleManager.ts`).
- Prefer small, focused modules under `assets/scripts/<domain>/` with `index.ts` barrels where helpful.
- Avoid manual edits to `*.meta`; use the Cocos editor to move/rename assets so references stay intact.

## Testing Guidelines
- No centralized test runner yet. Validate gameplay via Cocos Preview and TypeScript checks.
- When adding logic-heavy modules, include lightweight assertions or debug scenes. Aim to keep scene warnings at 0.
- For future Move work, add `contracts/` with `sources/` and `tests/` and use Sui CLI tests.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...` (matches existing history).
- PRs should include: clear description, scope (files/areas touched), linked issue (if any), and a short screen capture or screenshots for UI/gameplay changes.
- Keep changes atomic; avoid mixing refactors with features.

## Security & Configuration Tips
- Never commit secrets: `.env`, private keys, `*.pem` (already ignored). Use environment files locally.
- Large/binary sources belong under `assets/` or external storage; keep Git history lean.

## Agent-Specific Instructions
- Respect Cocos project structure; do not move or rename assets outside the editor.
- Place new gameplay code under `client/tycoon_cocos/assets/scripts/` and import via relative paths.
- Before changing build or scripts, search repo/docs for related notes to stay consistent.

