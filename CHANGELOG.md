# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive release automation with semantic versioning
- Production build system with ESBuild optimization
- Quality gates and automated linting system
- GitHub Actions distribution pipeline
- Bundle size validation and integrity checks
- Source map generation for debugging
- Multi-platform build testing
- Automated changelog generation
- Release validation and rollback mechanisms
- Complete documentation suite (README, API, Migration, Troubleshooting, Contributing)
- Real-world workflow examples directory with 5 production-ready templates
- Comprehensive migration guide from composite actions
- Advanced error handling and recovery patterns

### Changed
- Build system now uses ESBuild instead of default bundling
- Main entry point changed from `dist/main.js` to `dist/index.js`
- Enhanced CI/CD pipeline with comprehensive quality checks

### Fixed
- Bundle size optimization (2.53MB, well under 10MB limit)
- TypeScript strict mode compliance
- Linting errors resolution across codebase

## [1.0.0] - 2025-08-07

### Added
- Initial SST Operations Action implementation
- Support for deploy, diff, and remove operations
- GitHub integration with PR comments
- TypeScript implementation with comprehensive types
- Test suite with high coverage requirements
- Bun runtime and package management
- Basic CI/CD workflows

### Security
- Dependency vulnerability scanning
- Bundle security validation
- Secure GitHub token handling

---

**Note**: This changelog is automatically updated during releases. For the full commit history, see [GitHub Releases](https://github.com/kodehort/sst-operations-action/releases).