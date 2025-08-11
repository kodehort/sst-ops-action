# Release v0.2.0

**Release Date:** 2025-08-11
**Previous Version:** v0.1.1

## 🚀 What's New


## 📦 Bundle Information

- **Bundle Size:** 1.93MB (2025422 bytes)
- **Integrity Hash:** `3f3e6ad72497d490...`
- **Format:** ES Modules for GitHub Actions
- **Target:** Node.js 20+
- **Source Maps:** Included for debugging
- **Distribution:** Files included in repository at tagged version

## 🚀 Usage

```yaml
- name: SST Operations
  uses: kodehort/sst-ops-action@v0.2.0
  with:
    operation: deploy  # deploy, diff, or remove
    stage: production
    token: \ghs_nGNDiR1O93wh9UmmT5083QWBryBTV53vYUDp
```

## 🔗 Links

- [Full Changelog](https://github.com/kodehort/sst-ops-action/compare/v0.1.1...v0.2.0)
- [Documentation](https://github.com/kodehort/sst-ops-action/blob/v0.2.0/README.md)
- [Action Marketplace](https://github.com/marketplace/actions/sst-operations)

---

**Full Changelog**: https://github.com/kodehort/sst-ops-action/compare/v0.1.1...v0.2.0

---

# Release v0.1.1

**Release Date:** 2025-08-11
**Previous Version:** v0.1.0

## 🚀 What's New


### 🐛 Bug Fixes

- fix: remove GitHub Actions expression syntax from action.yml description (`0e2eee8`)

### 🔧 Improvements & Maintenance

- refactor: implement operation-specific discriminated union validation and remove deprecated code (#4) (`90bfa7b`)

## 📦 Bundle Information

- **Bundle Size:** 5.23MB (5483618 bytes)
- **Integrity Hash:** `0a1e7933c45a3899...`
- **Format:** ES Modules for GitHub Actions
- **Target:** Node.js 20+
- **Source Maps:** Included for debugging
- **Distribution:** Files included in repository at tagged version

## 🚀 Usage

```yaml
- name: SST Operations
  uses: kodehort/sst-ops-action@v0.1.1
  with:
    operation: deploy  # deploy, diff, or remove
    stage: production
    token: \ghs_3obnwWqbYz1pH241u2iKDBCtOpO7Mt2HmVza
```

## 🔗 Links

- [Full Changelog](https://github.com/kodehort/sst-ops-action/compare/v0.1.0...v0.1.1)
- [Documentation](https://github.com/kodehort/sst-ops-action/blob/v0.1.1/README.md)
- [Action Marketplace](https://github.com/marketplace/actions/sst-operations)

---

**Full Changelog**: https://github.com/kodehort/sst-ops-action/compare/v0.1.0...v0.1.1

---

# Release v0.1.0

**Release Date:** 2025-08-10
**Previous Version:** v0.0.1

## 🚀 What's New


## 📦 Bundle Information

- **Bundle Size:** 5.21MB (5458391 bytes)
- **Integrity Hash:** `46e908413fe65efb...`
- **Format:** ES Modules for GitHub Actions
- **Target:** Node.js 20+
- **Source Maps:** Included for debugging
- **Distribution:** Files included in repository at tagged version

## 🚀 Usage

```yaml
- name: SST Operations
  uses: kodehort/sst-ops-action@v0.1.0
  with:
    operation: deploy  # deploy, diff, or remove
    stage: production
    token: \ghs_4fHrgDBJdo4jEikDmX1nxxmSpBAHhO3OyhpF
```

## 🔗 Links

- [Full Changelog](https://github.com/kodehort/sst-ops-action/compare/v0.0.1...v0.1.0)
- [Documentation](https://github.com/kodehort/sst-ops-action/blob/v0.1.0/README.md)
- [Action Marketplace](https://github.com/marketplace/actions/sst-operations)

---

**Full Changelog**: https://github.com/kodehort/sst-ops-action/compare/v0.0.1...v0.1.0

---

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.0.1] - 2025-08-10

### Added
- Unified GitHub Action for SST operations (deploy, diff, remove)
- Comprehensive input validation and error handling
- PR comment integration for diff operations
- Support for multiple package managers (bun, npm, pnpm, yarn)
- Proper timeout handling and resource cleanup
- Extensive test coverage with 90% thresholds

### Fixed
- Event loop hanging issue by properly cleaning up setTimeout timers
- CLI command execution with proper error handling
- GitHub Actions output formatting and validation

### Changed
- Consolidated multiple SST operations into a single action
- Improved error messages and user feedback
- Enhanced TypeScript configuration with strict settings