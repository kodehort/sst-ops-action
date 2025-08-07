# Testing Guide

This document provides comprehensive information about the testing structure and strategy for the SST Operations Action.

## Test Structure

The testing suite is organized into three main categories:

### 1. Unit Tests (`__tests__/unit/`)
- Test individual functions and modules in isolation
- Use mocking extensively to isolate units under test
- Fast execution, comprehensive coverage
- Focus on business logic, input validation, and edge cases

### 2. Integration Tests (`__tests__/integration/`)
- Test interaction between different components
- Test the action with mocked SST CLI and GitHub API
- Validate end-to-end workflows with controlled inputs/outputs
- Real SST CLI integration tests (when SST CLI is available)

### 3. End-to-End Tests (`__tests__/e2e/`)
- Test the complete GitHub Action as it would run in production
- Execute the bundled action with realistic inputs
- Test actual file operations, environment handling, and output generation
- Validate error handling and recovery scenarios

## Running Tests

### All Tests
```bash
bun test                  # Run all tests
bun run test:coverage     # Run with coverage report
```

### By Category
```bash
bun run test:unit         # Unit tests only
bun run test:integration  # Integration tests only  
bun run test:e2e         # End-to-end tests only
```

### Specific Integration Tests
```bash
bun run test:integration:real  # Real SST CLI integration tests
```

## Test Configuration

### Test Environment
- **Framework**: Vitest with Node.js environment
- **Timeout**: 30 seconds (increased for integration tests)
- **Coverage**: 90% thresholds for branches, functions, lines, and statements
- **Isolation**: Fork pool for better test isolation

### Mocking Strategy
- Unit tests: Extensive mocking of external dependencies
- Integration tests: Partial mocking with real business logic
- E2E tests: Minimal mocking, testing actual bundled code

## Integration Tests

### Standard Integration Tests
Located in `__tests__/integration/action-integration.test.ts`:
- Test complete operation workflows (deploy, diff, remove)
- Mock SST CLI execution but test real parsing and validation logic
- Test error handling, input validation, and output formatting
- Test GitHub Actions integration points

### Real SST CLI Integration Tests
Located in `__tests__/integration/real-sst-integration.test.ts`:
- Test with actual SST CLI when available
- Automatically skip when SST CLI is not installed
- Create temporary SST projects for testing
- Test real SST commands with controlled configurations
- Validate error scenarios with actual SST CLI responses

**Note**: Real SST CLI tests require SST to be installed globally:
```bash
npm install -g sst@latest
```

### Bundle Integration Tests
Located in `__tests__/integration/bundle-integration.test.ts`:
- Test the bundled action code
- Validate bundle integrity and completeness
- Test CommonJS compatibility and module loading

## End-to-End Tests

Located in `__tests__/e2e/action-e2e.test.ts`:

### Features Tested
- Complete GitHub Action execution flow
- Input validation and parsing
- Operation routing and execution  
- Output formatting and GitHub Actions integration
- Error handling and recovery
- Environment variable processing
- Comment mode behavior
- Output size limits

### Test Environment Setup
- Creates temporary SST projects for each test
- Sets up realistic GitHub Actions environment variables
- Executes the bundled action (`dist/index.cjs`)
- Captures stdout, stderr, and exit codes
- Validates expected outputs and behaviors

### Prerequisites
- Action must be built: `bun run build`
- Tests create temporary projects and clean up automatically

## Test Data and Fixtures

### SST Output Fixtures
Located in `__tests__/fixtures/sst-outputs.ts`:
- Sample SST CLI outputs for different operations
- Used for testing parsing logic without running actual SST commands
- Includes success, failure, and edge case scenarios

### Mock Helpers
Located in `__tests__/setup.ts`:
- Global test setup and configuration
- Mock implementations for GitHub Actions APIs
- Common test utilities and helpers

## Coverage Requirements

The project enforces strict coverage requirements:
- **Branches**: 90% minimum
- **Functions**: 90% minimum  
- **Lines**: 90% minimum
- **Statements**: 90% minimum

Coverage excludes:
- Test files (`__tests__/`)
- Distribution files (`dist/`)
- Configuration files (`*.config.*`)
- Build scripts (`scripts/`)

## Testing Best Practices

### 1. Test Categorization
- Use unit tests for pure functions and isolated logic
- Use integration tests for component interaction
- Use E2E tests for complete workflow validation

### 2. Mock Strategy
- Mock external dependencies (SST CLI, GitHub API) in unit/integration tests
- Use real implementations in E2E tests where possible
- Keep mocks simple and focused on the behavior being tested

### 3. Error Testing
- Test both expected and unexpected error scenarios
- Validate error messages and recovery behavior
- Test fail-on-error configuration options

### 4. Environment Testing
- Test different GitHub Actions environments (PR, push, etc.)
- Test missing or invalid environment variables
- Test CI vs local execution differences

### 5. Real-World Scenarios
- Integration tests simulate real SST CLI usage
- E2E tests use actual GitHub Actions environment setup
- Test data reflects actual SST CLI outputs

## Continuous Integration

### Test Execution in CI
- All test categories run in CI pipeline
- Coverage reports generated and enforced
- Real SST CLI tests skip when CLI unavailable
- E2E tests require successful build step

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No test skips allowed in main branch (except optional real SST CLI tests)
- Lint and type checks must pass

## Troubleshooting

### Common Issues

#### "Action not built" Error in E2E Tests
```bash
# Solution: Build the action first
bun run build
bun run test:e2e
```

#### "SST CLI not available" in Integration Tests
```bash
# Solution: Install SST CLI globally (optional)
npm install -g sst@latest
bun run test:integration:real
```

#### Test Timeouts
- Integration tests have 30-second timeout
- E2E tests have 60-second timeout
- Increase timeout in vitest.config.ts if needed

#### Mock Issues
- Check `__tests__/setup.ts` for global mocks
- Ensure vi.clearAllMocks() is called between tests
- Verify mock implementations match expected interfaces

### Debug Test Failures
```bash
# Run specific test file
bun test __tests__/unit/specific-file.test.ts

# Run with verbose output
bun test --reporter=verbose

# Run single test by name
bun test -t "specific test name"
```

## Future Enhancements

### Planned Improvements
1. **Performance Testing**: Add benchmarks for operation execution times
2. **Load Testing**: Test with large SST projects and outputs  
3. **Security Testing**: Validate secrets handling and sanitization
4. **Compatibility Testing**: Test across different Node.js versions
5. **Regression Testing**: Automated testing against SST CLI updates

### Test Infrastructure
1. **Test Databases**: Consider adding database integration tests
2. **External Services**: Mock external AWS/GitHub services more comprehensively
3. **Visual Testing**: Add screenshot testing for generated outputs
4. **Chaos Testing**: Test resilience to random failures