# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a clean scaffold. Keep the root minimal and organize new code with a predictable layout:

- `src/`: application source code, grouped by feature or domain
- `tests/`: automated tests mirroring `src/` paths
- `assets/`: static files (images, sample data, fixtures)
- `scripts/`: repeatable developer scripts (setup, checks, release helpers)
- `docs/`: design notes, architecture decisions, and onboarding docs

Example: `src/auth/login.ts` should have related tests at `tests/auth/login.test.ts`.

## Build, Test, and Development Commands
No build tooling is committed yet. When adding tooling, expose a consistent command surface (prefer `Makefile` or `package.json` scripts):

- `npm install` or `pnpm install`: install dependencies
- `npm run dev`: start local development server/watch mode
- `npm test`: run test suite
- `npm run lint`: run static analysis
- `npm run build`: produce production build artifacts

If you introduce different tooling, update this file in the same PR.

## Coding Style & Naming Conventions
- Use 2 spaces for YAML/JSON and 4 spaces for Python; follow language defaults elsewhere.
- Use formatters/linters appropriate to the stack (for example, Prettier + ESLint for JS/TS).
- File naming:
  - modules/utilities: `kebab-case`
  - classes/components: `PascalCase`
  - variables/functions: `camelCase`
- Keep functions small and side effects explicit.

## Testing Guidelines
- Place tests under `tests/` with names ending in `.test.<ext>` or `.spec.<ext>`.
- Add unit tests for new logic and regression tests for bug fixes.
- Target meaningful coverage on changed code; include edge cases and failure paths.
- Ensure tests pass locally before opening a PR.

## Commit & Pull Request Guidelines
Git history is not established yet; use Conventional Commits going forward:

- `feat: add user profile endpoint`
- `fix: handle empty API response`
- `docs: update setup instructions`

PRs should include:
- clear summary of what changed and why
- linked issue/ticket (if available)
- test evidence (command output or CI link)
- screenshots/video for UI changes
