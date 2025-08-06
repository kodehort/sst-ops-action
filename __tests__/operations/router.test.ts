import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createOperationFactory,
  validateOperationConfig,
} from '../../src/operations/router';
import type { OperationOptions } from '../../src/types';

const mockOperationOptions: OperationOptions = {
  stage: 'staging',
  token: 'ghp_test_token',
  commentMode: 'on-success',
  failOnError: false,
  maxOutputSize: 50_000,
  environment: {},
};

describe('OperationRouter', () => {
  let originalGitHubToken: string | undefined;

  beforeEach(() => {
    // Save original value
    originalGitHubToken = process.env.GITHUB_TOKEN;
    // Set a test token for GitHubClient
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    // Restore original value
    if (originalGitHubToken !== undefined) {
      process.env.GITHUB_TOKEN = originalGitHubToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  describe('createOperationFactory', () => {
    it('should create factory with correct dependencies', () => {
      const factory = createOperationFactory(mockOperationOptions);

      expect(factory).toBeDefined();
      expect(factory).toHaveProperty('createOperation');
      expect(typeof factory.createOperation).toBe('function');
    });

    it('should handle missing token gracefully', () => {
      const { token, ...optionsWithoutToken } = mockOperationOptions;

      const factory = createOperationFactory(optionsWithoutToken);

      expect(factory).toBeDefined();
    });
  });

  describe('validateOperationConfig', () => {
    it('should pass validation for valid deploy configuration', () => {
      expect(() => {
        validateOperationConfig('deploy', mockOperationOptions);
      }).not.toThrow();
    });

    it('should pass validation for valid diff configuration', () => {
      expect(() => {
        validateOperationConfig('diff', mockOperationOptions);
      }).not.toThrow();
    });

    it('should pass validation for valid remove configuration', () => {
      expect(() => {
        validateOperationConfig('remove', mockOperationOptions);
      }).not.toThrow();
    });

    it('should throw error when stage is missing', () => {
      const invalidOptions = { ...mockOperationOptions, stage: '' };

      expect(() => {
        validateOperationConfig('deploy', invalidOptions);
      }).toThrow('Stage is required for all operations');
    });

    it('should require confirmation for production remove operations', () => {
      const prodOptions = {
        ...mockOperationOptions,
        stage: 'production',
        environment: {},
      };

      expect(() => {
        validateOperationConfig('remove', prodOptions);
      }).toThrow(
        'Production remove operations require CONFIRM_PRODUCTION_REMOVE environment variable'
      );
    });

    it('should allow production remove with confirmation', () => {
      const prodOptions = {
        ...mockOperationOptions,
        stage: 'production',
        environment: {
          CONFIRM_PRODUCTION_REMOVE: 'true',
        },
      };

      expect(() => {
        validateOperationConfig('remove', prodOptions);
      }).not.toThrow();
    });
  });
});
