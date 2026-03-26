# Contributing to codeweave

Thank you for your interest in contributing to codeweave! This guide will help you get started.

## Table of Contents

- [Fork and Clone](#fork-and-clone)
- [Setting Up Your Dev Environment](#setting-up-your-dev-environment)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Opening Issues](#opening-issues)

---

## Fork and Clone

1. Fork the repository by clicking the **Fork** button on GitHub.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/codeweave.git
   cd codeweave
   ```

3. Add the upstream remote so you can keep your fork in sync:

   ```bash
   git remote add upstream https://github.com/abdullahoriginal/codeweave.git
   ```

4. To sync your fork with upstream later:

   ```bash
   git fetch upstream
   git merge upstream/main
   ```

---

## Setting Up Your Dev Environment

Ensure you have **Node.js 18+** and **npm** installed.

```bash
npm install
npm run dev
```

`npm run dev` starts the development server with hot-reloading enabled.

---

## Running Tests

```bash
npm test
```

Run a specific test file:

```bash
npm test -- <path/to/test-file>
```

All tests must pass before a PR can be merged.

---

## Code Style

This project uses **ESLint** and **Prettier** for consistent formatting.

- **Lint your code:**

  ```bash
  npm run lint
  ```

- **Auto-fix lint issues:**

  ```bash
  npm run lint:fix
  ```

- **Format with Prettier:**

  ```bash
  npm run format
  ```

- **Type check:**

  ```bash
  npm run typecheck
  ```

Please ensure there are no lint or type errors before submitting a PR. Your editor will ideally pick up the ESLint and Prettier configs automatically — check `.eslintrc` and `.prettierrc` at the root.

---

## Submitting Pull Requests

### Branch Naming

Create a branch from `main` using one of these prefixes:

| Prefix | Use case |
|--------|----------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `chore/` | Maintenance, tooling, dependencies |
| `refactor/` | Code change that neither fixes a bug nor adds a feature |
| `test/` | Adding or updating tests |

Example: `feat/add-symbol-search-tool`, `fix/cache-invalidation-on-rename`

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`

Examples:

```
feat(mcp): add get_symbol_references tool
fix(cache): invalidate FTS index on file rename
docs(readme): update installation instructions
chore(deps): bump better-sqlite3 to 9.4.3
```

### PR Checklist

Before opening a PR, make sure:

- [ ] Your branch is up to date with `main`
- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes with no errors
- [ ] All existing tests pass (`npm test`)
- [ ] You have added or updated tests for your changes
- [ ] You have updated documentation where applicable
- [ ] You have added an entry to `CHANGELOG.md` under `[Unreleased]`

### Opening the PR

- Use the PR template provided — fill in every section.
- Keep PRs focused: one feature or fix per PR.
- Link any related issues using `Closes #<issue-number>` in the PR description.
- Request a review once you're confident the checklist is complete.

---

## Opening Issues

Before opening an issue, please search existing issues to avoid duplicates.

Use the appropriate issue template:

- **Bug report** — for unexpected behavior or errors.
- **Feature request** — for proposing new functionality.

When reporting a bug, include:
- Your OS, Node.js version, and codeweave version.
- Clear steps to reproduce the issue.
- What you expected vs. what actually happened.
- Any relevant logs or error messages.

---

Thank you for helping make codeweave better!
