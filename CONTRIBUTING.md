# Contributing to My NewTab

Thank you for considering contributing to My NewTab! We welcome contributions of all kinds: bug reports, feature requests, documentation improvements, and code changes.

## Commit Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Each commit message must be structured as:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Usage                                              |
|------------|----------------------------------------------------|
| `feat`     | A new feature                                      |
| `fix`      | A bug fix                                          |
| `docs`     | Documentation only changes                         |
| `style`    | Code style changes (formatting, missing semicolons)|
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Code change that improves performance              |
| `test`     | Adding or updating tests                           |
| `chore`    | Changes to build process, tooling, or dependencies |
| `ci`       | Changes to CI configuration                        |

### Examples

```
feat(clock): add analog clock face
fix(weather): handle API timeout gracefully
docs: update README with new feature list
chore(deps): bump framer-motion to 12.2.0
refactor(search): extract engine selector into shared component
```

## Development Workflow

1. Fork the repository and create your branch from `main`.
2. Run `pnpm install` to install dependencies.
3. Make your changes.
4. Run `pnpm compile` to verify TypeScript types.
5. Run `pnpm lint`.
6. Run `pnpm build` -- some failures only surface at bundle time, so this is not
   optional before opening a PR.
7. Commit your changes using a conventional commit message.
8. Push to your fork and open a pull request.

### Pre-commit Checks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to run TypeScript type checking on staged files before each commit. If type checking fails, the commit will be blocked.

## Project Structure

```
src/
  entrypoints/       # One per browser surface (newtab, popup, site, embed, background)
  app/               # The shell of each surface (layout, modals, router)
  features/          # One folder per surface, then per feature -- self-registering
  core/              # Surface-independent services (registries, storage, theme, i18n)
  shared/            # UI kit, icons, pure utils used everywhere
  styles/            # Design tokens and global styles
docs/                # Architecture and feature documentation
```

Dependencies run **one way only**: `entrypoints -> app -> features -> core / shared`.
`core` and `shared` never import back up. See [docs/architecture.md](docs/architecture.md).

## Adding a New Feature or Tool

1. Create the folder -- `src/features/newtab/<name>/` for a New Tab feature, or
   `src/features/site/<name>/` for a Custom Site app -- with an `index.tsx` that
   calls `registerFeature()` / `registerSiteApp()`.
2. Add one `import "./<name>"` line to that surface barrel.
3. Do not modify core code -- settings, sidebar, home grid and onboarding all read
   the registry, so nothing hardcodes a list.
4. Use components from `src/shared/ui` and tokens from `src/styles/tokens.css`. Do
   not hardcode colors or spacing.
5. Every user-visible string goes through `t()`, and `en.json` / `vi.json` must stay
   key-for-key identical.

### One tool = one folder

Inside `features/site`, `features/embed` and `features/popup`, a tool must be a
folder you can delete without breaking anything else. ESLint enforces it: an
`@/features/**` import **inside** those folders is a build error, because within
your own tool you would use a relative path -- so such an import is by definition
a reach into somebody else's tool.

Need to share something? Copy it, or promote it to `@/core` / `@/shared`.

### Algorithms live in `engine/`

There is no unit-test runner. Anything algorithmic belongs in a tool's `engine/`
folder as pure functions -- no React, no DOM -- so it can be bundled with esbuild
and run under Node. See [AGENTS.md](AGENTS.md) §5.

## Code Style

- TypeScript with strict mode enabled.
- React functional components with hooks.
- CSS modules or co-located CSS files. Do not use inline styles for layout.
- Prefer `const` over `let` for immutable bindings.
- Use named exports for components and utilities.
