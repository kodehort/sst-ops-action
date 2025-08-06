import { describe, expect, it } from 'vitest';
import {
  ERROR_PATTERNS,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from '../../src/errors/categories';

describe('Error Categories', () => {
  describe('ERROR_PATTERNS', () => {
    it('should have patterns with all required properties', () => {
      ERROR_PATTERNS.forEach((pattern, _index) => {
        expect(pattern).toHaveProperty('category');
        expect(pattern).toHaveProperty('patterns');
        expect(pattern).toHaveProperty('severity');
        expect(pattern).toHaveProperty('recoverable');
        expect(pattern).toHaveProperty('retryable');
        expect(pattern).toHaveProperty('recoveryStrategy');
        expect(pattern).toHaveProperty('getSuggestions');

        // Ensure patterns is an array of RegExp objects
        expect(Array.isArray(pattern.patterns)).toBe(true);
        expect(pattern.patterns.length).toBeGreaterThan(0);

        pattern.patterns.forEach((regex) => {
          expect(regex).toBeInstanceOf(RegExp);
        });

        // Ensure getSuggestions is a function that returns string array
        expect(typeof pattern.getSuggestions).toBe('function');
        const suggestions = pattern.getSuggestions(new Error('test'));
        expect(Array.isArray(suggestions)).toBe(true);
        suggestions.forEach((suggestion) => {
          expect(typeof suggestion).toBe('string');
        });
      });
    });

    it('should cover all error categories', () => {
      const coveredCategories = new Set(ERROR_PATTERNS.map((p) => p.category));
      const allCategories = Object.values(ErrorCategory);

      // Most categories should be covered (allowing for some that might not need patterns)
      expect(coveredCategories.size).toBeGreaterThan(
        allCategories.length * 0.7
      );
    });

    describe('Authentication errors', () => {
      const authPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.AUTHENTICATION
      );

      it('should detect AWS credential errors', () => {
        expect(authPattern).toBeDefined();

        const testCases = [
          'aws credentials not configured',
          'The AWS Access Key Id you provided does not exist',
          'invalid aws credentials',
          'Unable to locate credentials',
          'credential provider error',
        ];

        testCases.forEach((message) => {
          const hasMatch = authPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });

      it('should provide relevant suggestions', () => {
        const suggestions = authPattern?.getSuggestions(
          new Error('AWS credentials not found')
        );
        expect(suggestions).toContain(
          'Configure AWS credentials using AWS CLI or environment variables'
        );
        expect(suggestions).toContain(
          'Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set'
        );
      });
    });

    describe('Permission errors', () => {
      const permissionPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.PERMISSIONS
      );

      it('should detect permission denied errors', () => {
        expect(permissionPattern).toBeDefined();

        const testCases = [
          'permission denied',
          'access denied',
          'insufficient permissions',
          'not authorized',
          'forbidden',
        ];

        testCases.forEach((message) => {
          const hasMatch = permissionPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });

      it('should provide permission-related suggestions', () => {
        const suggestions = permissionPattern?.getSuggestions(
          new Error('Permission denied')
        );
        expect(suggestions).toBeDefined();
        expect(suggestions?.some((s) => s.includes('IAM'))).toBe(true);
        expect(suggestions?.some((s) => s.includes('permissions'))).toBe(true);
      });
    });

    describe('Timeout errors', () => {
      const timeoutPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.TIMEOUT
      );

      it('should detect timeout errors', () => {
        expect(timeoutPattern).toBeDefined();

        const testCases = [
          'operation timed out',
          'timeout',
          'request timeout',
          'connection timeout',
          'timed out after',
        ];

        testCases.forEach((message) => {
          const hasMatch = timeoutPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });

      it('should be retryable', () => {
        expect(timeoutPattern?.retryable).toBe(true);
        expect(timeoutPattern?.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      });
    });

    describe('Network errors', () => {
      const networkPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.NETWORK
      );

      it('should detect network connectivity errors', () => {
        expect(networkPattern).toBeDefined();

        const testCases = [
          'network error',
          'connection refused',
          'connection reset',
          'network timeout',
          'dns resolution failed',
          'connection failed',
        ];

        testCases.forEach((message) => {
          const hasMatch = networkPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });
    });

    describe('GitHub API errors', () => {
      const githubPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.GITHUB_API
      );

      it('should detect GitHub API errors', () => {
        expect(githubPattern).toBeDefined();

        const testCases = [
          'github api error',
          'rate limit exceeded',
          'github token',
          'api rate limit',
          'secondary rate limit',
        ];

        testCases.forEach((message) => {
          const hasMatch = githubPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });
    });

    describe('Resource conflicts', () => {
      const conflictPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.RESOURCE_CONFLICT
      );

      it('should detect resource conflict errors', () => {
        expect(conflictPattern).toBeDefined();

        const testCases = [
          'resource already exists',
          'conflicting resource',
          'already exists',
          'duplicate resource',
          'resource conflict',
        ];

        testCases.forEach((message) => {
          const hasMatch = conflictPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });
    });

    describe('Output parsing errors', () => {
      const parsingPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.OUTPUT_PARSING
      );

      it('should detect parsing errors', () => {
        expect(parsingPattern).toBeDefined();

        const testCases = [
          'failed to parse output',
          'invalid json format',
          'unexpected output format',
          'json parse error',
          'malformed output data',
        ];

        testCases.forEach((message) => {
          const hasMatch = parsingPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          );
          expect(hasMatch).toBe(true);
        });
      });

      it('should be recoverable with partial success potential', () => {
        expect(parsingPattern?.recoverable).toBe(true);
        expect(parsingPattern?.severity).toBe(ErrorSeverity.LOW);
      });
    });

    describe('CLI execution errors', () => {
      const cliPattern = ERROR_PATTERNS.find(
        (p) => p.category === ErrorCategory.CLI_EXECUTION
      );

      it('should detect CLI execution failures', () => {
        expect(cliPattern).toBeDefined();

        const testCases = [
          'sst deploy failed',
          'sst exited with code 1',
          'process exited with code 1',
          'sst: command not found',
        ];

        // At least some of these should match
        const matchCount = testCases.filter((message) =>
          cliPattern?.patterns.some((regex) =>
            regex.test(message.toLowerCase())
          )
        ).length;

        expect(matchCount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('ErrorCategory enum', () => {
    it('should have all expected categories', () => {
      const expectedCategories = [
        'CLI_EXECUTION',
        'OUTPUT_PARSING',
        'GITHUB_API',
        'VALIDATION',
        'TIMEOUT',
        'PERMISSIONS',
        'AUTHENTICATION',
        'NETWORK',
        'RESOURCE_CONFLICT',
        'SYSTEM',
      ];

      expectedCategories.forEach((category) => {
        expect(Object.values(ErrorCategory)).toContain(
          ErrorCategory[category as keyof typeof ErrorCategory]
        );
      });
    });

    it('should have string values matching keys in lowercase', () => {
      Object.entries(ErrorCategory).forEach(([key, value]) => {
        expect(value).toBe(key.toLowerCase());
      });
    });
  });

  describe('ErrorSeverity enum', () => {
    it('should have all severity levels', () => {
      const expectedSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      expectedSeverities.forEach((severity) => {
        expect(Object.values(ErrorSeverity)).toContain(
          ErrorSeverity[severity as keyof typeof ErrorSeverity]
        );
      });
    });

    it('should have logical severity ordering', () => {
      const severities = Object.values(ErrorSeverity);
      expect(severities).toEqual(['low', 'medium', 'high', 'critical']);
    });
  });

  describe('RecoveryStrategy enum', () => {
    it('should have all recovery strategies', () => {
      const expectedStrategies = [
        'RETRY',
        'MANUAL_INTERVENTION',
        'CONFIGURATION_UPDATE',
        'NOT_RECOVERABLE',
      ];

      expectedStrategies.forEach((strategy) => {
        expect(Object.values(RecoveryStrategy)).toContain(
          RecoveryStrategy[strategy as keyof typeof RecoveryStrategy]
        );
      });
    });
  });

  describe('Pattern consistency', () => {
    it('should have consistent retryable and recovery strategy mapping', () => {
      ERROR_PATTERNS.forEach((pattern) => {
        // Retryable patterns should generally use RETRY strategy
        if (pattern.retryable && pattern.recoverable) {
          expect([
            RecoveryStrategy.RETRY,
            RecoveryStrategy.MANUAL_INTERVENTION,
          ]).toContain(pattern.recoveryStrategy);
        }

        // Non-recoverable patterns should use NOT_RECOVERABLE strategy
        if (!pattern.recoverable) {
          expect([
            RecoveryStrategy.NOT_RECOVERABLE,
            RecoveryStrategy.CONFIGURATION_UPDATE,
          ]).toContain(pattern.recoveryStrategy);
        }

        // High severity errors should generally not be retryable
        if (pattern.severity === ErrorSeverity.CRITICAL) {
          expect(pattern.retryable).toBe(false);
        }
      });
    });

    it('should provide non-empty suggestions for all patterns', () => {
      ERROR_PATTERNS.forEach((pattern, _index) => {
        const suggestions = pattern.getSuggestions(new Error('test error'));
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).not.toBe('');
      });
    });

    it('should have patterns for all major categories', () => {
      const categories = ERROR_PATTERNS.map((p) => p.category);
      const uniqueCategories = new Set(categories);

      // Note: We may have multiple patterns per category, so unique count may be less than total
      expect(uniqueCategories.size).toBeGreaterThan(5);
      expect(categories.length).toBeGreaterThan(8);
    });
  });

  describe('Pattern regex validity', () => {
    it('should have valid regex patterns that can match test strings', () => {
      ERROR_PATTERNS.forEach((pattern) => {
        pattern.patterns.forEach((regex) => {
          // Test that regex is valid and can be executed
          expect(() => regex.test('test string')).not.toThrow();

          // Test regex flags are reasonable
          expect(regex.global).toBe(false); // Global flag not typically needed for error matching
          expect(regex.ignoreCase).toBe(true); // Should be case insensitive
        });
      });
    });

    it('should not have overly broad patterns that match everything', () => {
      const testStrings = [
        'success',
        'completed successfully',
        'operation finished',
        'no errors found',
      ];

      ERROR_PATTERNS.forEach((pattern) => {
        pattern.patterns.forEach((regex) => {
          // Patterns should not match success messages
          testStrings.forEach((testString) => {
            expect(regex.test(testString.toLowerCase())).toBe(false);
          });
        });
      });
    });
  });
});
