# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-08-10

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