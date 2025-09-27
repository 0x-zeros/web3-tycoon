# Repository Guidelines

## Project Structure & Module Organization
- `client/tycoon_cocos/` — Cocos Creator 3.8+ project. Game code in `assets/scripts/` (TypeScript). Do not edit `library/` or `temp/`.
- `tools/asset-generator/` — Node.js utilities for generating tiles/UI.
- `server/` — Placeholder for backend experiments.
- `assets/` and `docs/` — Shared resources and design/tech notes.
- Future Move work: create `contracts/` with `sources/` and `tests/` using standard Sui layout.

## Build, Test, and Development Commands
- Open Cocos project: open `client/tycoon_cocos/` in Cocos Creator; use Preview/Build from the editor.
- Install Cocos deps: `cd client/tycoon_cocos && npm install`.
- Type check (optional): `npx tsc -p client/tycoon_cocos/tsconfig.json --noEmit`.
- Asset generator setup: `cd tools/asset-generator && npm install`.
- Asset generator examples: `npm run generate:tiles`, `npm run generate:ui`, `npm run print:prompts`.
- Tip: If Cocos can’t resolve new packages, close the editor and delete `library/` and `temp/`, then reopen.

## Coding Style & Naming Conventions
- TypeScript: 2-space indent; `camelCase` for variables/functions; `PascalCase` for classes and Cocos script filenames (e.g., `RoleManager.ts`).
- Prefer small, focused modules under `assets/scripts/<domain>/` with `index.ts` barrels where useful.
- Avoid manual edits to `*.meta`; move/rename assets only via the Cocos editor.

## Testing Guidelines
- No centralized test runner yet. Validate gameplay via Cocos Preview and TypeScript checks.
- For logic-heavy modules, add lightweight assertions or a debug scene; aim for 0 scene warnings.
- When adding Move contracts, use `contracts/` with `sources/` and `tests/`, and run Sui CLI tests.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...` (match existing history).
- PRs should include: clear description, scope (files/areas touched), linked issue (if any), and a short screen capture or screenshots for UI/gameplay changes.
- Keep changes atomic; avoid mixing refactors with features.

## Security & Configuration Tips
- Never commit secrets (`.env`, private keys, `*.pem` are ignored). Use local env files.
- Store large/binary sources under `assets/` or external storage to keep history lean.
- Before changing build or scripts, search repo/docs for related notes to stay consistent.

## Agent-Specific Instructions
- Respect the Cocos project structure; do not move or rename assets outside the editor.
- Place new gameplay code under `client/tycoon_cocos/assets/scripts/` and import via relative paths.
- Follow these guidelines for any assisted or automated changes.

