# SST Operations Action

A unified, standalone GitHub Action for SST operations: deploy, diff, and remove.

> **Migration Notice:** This action consolidates functionality from multiple composite actions previously maintained in a monorepo. It provides the same functionality with improved maintainability and reusability as a standalone, distributable GitHub Action.

## Quick Start

### Deploy Operation
```yaml
- name: Deploy to staging
  uses: your-org/sst-operations-action@v1
  with:
    operation: deploy
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Diff Operation  
```yaml
- name: Show infrastructure diff
  uses: your-org/sst-operations-action@v1
  with:
    operation: diff
    stage: staging
    token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: always
```

### Remove Operation
```yaml
- name: Clean up resources
  uses: your-org/sst-operations-action@v1
  with:
    operation: remove
    stage: pr-${{ github.event.number }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

## Development

This action is built with:
- **Runtime**: Bun
- **Language**: TypeScript
- **Testing**: Vitest
- **Linting**: Biome
- **Build**: Bun bundler

### Setup

```bash
bun install
```

### Development Commands

```bash
# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Build action
bun run build

# Run all quality checks
bun run validate
```

### Pre-commit Hooks

This project uses Lefthook for git hooks:

```bash
# Install git hooks (automatic with bun install)
bun run prepare
```

## License

MIT