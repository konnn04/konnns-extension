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
5. Run `pnpm build` to verify the extension builds successfully.
6. Commit your changes using a conventional commit message.
7. Push to your fork and open a pull request.

### Pre-commit Checks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to run TypeScript type checking on staged files before each commit. If type checking fails, the commit will be blocked.

## Project Structure

```
src/
  entrypoints/       # Extension entry points (newtab, background)
  core/              # Shared core modules (feature registry, settings, theme, etc.)
  features/          # Each feature in its own folder, self-registering
  shared/            # Shared UI components and icons
  app/               # App shell (layout, modals, onboarding)
  styles/            # Design tokens and global styles
docs/                # Architecture and feature documentation
```

## Adding a New Feature

1. Create `src/features/<feature-name>/` with `index.tsx` (component + registerFeature), `settings.schema.ts`, and CSS.
2. Add an import line to `src/features/index.ts`.
3. Do not modify core code -- settings, sidebar, and onboarding auto-discover new features from the registry.
4. Use components from `src/shared/ui` and design tokens from `src/styles/tokens.css`. Do not hardcode colors or spacing.
5. Use `AsyncState` pattern for async data and provide skeleton loaders sized to the final layout.

## Code Style

- TypeScript with strict mode enabled.
- React functional components with hooks.
- CSS modules or co-located CSS files. Do not use inline styles for layout.
- Prefer `const` over `let` for immutable bindings.
- Use named exports for components and utilities.
