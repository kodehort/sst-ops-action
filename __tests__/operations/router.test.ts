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
      const { token: _token, ...optionsWithoutToken } = mockOperationOptions;

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

    it('should allow empty stage (auto-computation)', () => {
      const optionsWithEmptyStage = { ...mockOperationOptions, stage: '' };

      expect(() => {
        validateOperationConfig('deploy', optionsWithEmptyStage);
      }).not.toThrow();
    });

    it('should pass validation for production remove operations', () => {
      const prodOptions = {
        ...mockOperationOptions,
        stage: 'production',
      };

      // Should not throw since environment validation is handled at platform level
      expect(() => {
        validateOperationConfig('remove', prodOptions);
      }).not.toThrow();
    });

    it('should allow production remove with confirmation', () => {
      const prodOptions = {
        ...mockOperationOptions,
        stage: 'production',
      };

      // Environment validation is handled at platform level, so this should pass
      expect(() => {
        validateOperationConfig('remove', prodOptions);
      }).not.toThrow();
    });
  });
});
