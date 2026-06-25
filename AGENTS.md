# AGENTS.md - AI Assistant Guide for OpenCloud Web Extensions

## Project Overview

This repository is a collection of [OpenCloud Web](https://github.com/opencloud-eu/web) extensions ("apps") that, for various reasons, are not part of the main `web` repository. Each extension is a self-contained TypeScript/Vue 3 app built with Vite and loaded into OpenCloud Web at runtime via module federation. It is structured as a **pnpm monorepo**.

## Repository Structure

```
/
├── packages/              # All extensions (monorepo workspaces)
│   └── web-app-*/         # Standalone apps/extensions (unzip, importer, maps, …)
├── tests/                 # Shared test setup / workspace
├── dev/                   # Local development helpers
├── docker/                # Docker config
├── docker-compose.yml
├── playwright.config.ts   # Root Playwright (e2e) config
├── eslint.config.js       # Root ESLint config
└── package.json           # Root scripts and dev dependencies
```

Each extension under `packages/web-app-*/` typically contains:

- `src/` – source code
- `tests/unit/` – unit tests (mirroring the `src/` folder structure)
- `tests/e2e/` – end-to-end tests for the extension
- `l10n/` – translations
- `CHANGELOG.md` – per-app changelog (see [Versioning & Changelogs](#versioning--changelogs))
- `package.json` – package-specific metadata, version and dependencies

Extensions are versioned and released **independently** of one another.

---

## Running Scripts

Scripts are defined in the root `package.json` and run with `pnpm`. Most fan out across all packages via `pnpm -r`:

```
pnpm build             # Production build (all packages)
pnpm build:w           # Build with watch/hot-reload
pnpm lint              # Run ESLint
pnpm format:check      # Check formatting with Prettier
pnpm format:write      # Auto-fix formatting with Prettier
pnpm check:types       # TypeScript type checking via vue-tsc
pnpm test:unit         # Run all unit tests with Vitest
pnpm test:e2e          # Run e2e tests with Playwright
```

To work on a single extension, run its package scripts directly, e.g. `pnpm --filter web-app-unzip test:unit`.

---

## Coding Style

### Formatting

Enforced via Prettier (`@opencloud-eu/prettier-config`). Run `pnpm format:write` to auto-fix.

### Linting

Enforced via ESLint (`@opencloud-eu/eslint-config`). Run `pnpm lint` to check.

### Best practices

#### General

- **TypeScript everywhere** – use types to catch bugs at compile time and support IDE tooling.
- **Composables over services** – encapsulate reusable logic in composables. Avoid services.
- **Early returns** – prefer early returns to keep code readable and performant.
- **Translations** – use `$gettext` (or its variants) for all user-facing strings. Don't manually edit the generated `l10n/translations.json` files inside a package.
- **Minimal dependencies** – avoid adding new dependencies unless necessary, to keep bundle size small and reduce security surface.
- **Vue unref() vs .value** – prefer `unref()` for accessing Ref values for better readability. Use `.value` only when setting values (e.g. `foo.value = 'bar'` or `foo.value.push('bar')`).
- **Functions vs arrow functions** – prefer named `function` declarations over arrow functions. Use arrow functions only for callbacks or when the `this` context requires it.
- **Tailwind CSS** – use Tailwind utility classes for styling. Avoid custom CSS unless necessary.
- **Cross-package imports** – shared functionality comes from the published OpenCloud packages (`@opencloud-eu/web-pkg`, `@opencloud-eu/web-client`, `@opencloud-eu/extension-sdk`, `@opencloud-eu/web-test-helpers`). Always import via their package names, never relative paths.

#### Vue components

- **Composition API + `<script setup>`** – prefer Vue's Composition API with `<script setup>` over the Options API.
- **Component size** – keep components under ~300 lines. Split larger ones into smaller sub-components.
- **Props** – define props with explicit types and default values. Avoid using `any` or `unknown`.
- **Emits** – define emitted events with explicit types.

---

## Versioning & Changelogs

Every extension is versioned **independently** following [Semantic Versioning](https://semver.org/) and ships its own `CHANGELOG.md`. A release happens by pushing a git tag of the form `<app>-v<version>` (e.g. `unzip-v2.0.1`); Woodpecker (`.woodpecker/release.yaml`) then builds the app and publishes a GitHub release whose notes link to that package's `CHANGELOG.md`.

When bumping an extension's version:

1. **Update `version`** in the extension's `package.json`.
2. **Add a matching section** to the top of the extension's `CHANGELOG.md`, dated with the release date in `YYYY-MM-DD` format and titled with the new version, e.g.:

   ```markdown
   ## [2.0.1](https://github.com/opencloud-eu/web-extensions/releases/tag/unzip-v2.0.1) - 2026-06-25

   ### 🐛 Bug Fixes

   - Preserve subfolder structure when extracting archives [[#443](https://github.com/opencloud-eu/web-extensions/pull/443)]
   ```

### Choosing the version bump (semver)

- **patch** (`x.y.Z`) – bug fixes or runtime dependency updates.
- **minor** (`x.Y.0`) – new or backwards-compatible features.
- **major** (`X.0.0`) – breaking changes.

### What belongs in a changelog

- Only include **user-facing / runtime-relevant** changes. Group them under headings such as `### ✨ Features`, `### 🐛 Bug Fixes`, `### 📦️ Dependencies`, and `### Breaking changes`.
- Reference the relevant pull request at the end of each entry: `[[#NNN](https://github.com/opencloud-eu/web-extensions/pull/NNN)]`.
- **Dev-dependency-only updates do not warrant a changelog entry and do not justify a version bump on their own.** Only updates to runtime `dependencies` count as a `📦️ Dependencies` change; bumps under `devDependencies` (build tooling, test libraries, types, `@opencloud-eu/web-*` dev deps, etc.) are omitted. For example, if the only changes since the last release are dev-dependency bumps plus one bug fix, the release is a **patch** containing just that bug fix.
- Internal-only changes (test infrastructure, CI tweaks, refactors with no observable effect) are likewise left out.

---

## Testing

### Unit Tests

- **Framework:** [Vitest](https://vitest.dev/)
- **Location:** `tests/unit/` inside each package, mirroring the `src/` folder structure.
- **File naming:** `{originalFileName}.spec.ts` (e.g. `src/composables/foo.ts` → `tests/unit/composables/foo.spec.ts`).
- **Helpers:** Use `@opencloud-eu/web-test-helpers` for mounting components, mocking stores, etc. instead of rolling your own helpers.
- **Snapshots:** Avoid snapshot tests, as they can be brittle and hard to maintain. Prefer explicit assertions that check specific behavior or output.
- **Run:** `pnpm test:unit` (or `pnpm --filter web-app-<name> test:unit` for a single extension).

### End-to-End Tests

- **Framework:** [Playwright](https://playwright.dev/)
- **Location:** `tests/e2e/` inside each extension; configured by the root `playwright.config.ts`.
- **Prerequisites:** Run `pnpm build` first, and start a local OpenCloud backend with `docker-compose up -d`.
- **Run:** `pnpm test:e2e`

## Documentation

Full developer documentation is available at https://docs.opencloud.eu/docs/dev/web/.
