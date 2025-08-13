import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGitHubIntegrationError } from '../../src/utils/github-actions.js';

// Mock @actions/core functions
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  debug: vi.fn(),
}));

const { info, debug } = vi.mocked(core);

describe('GitHub Actions Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleGitHubIntegrationError', () => {
    it('should log info and debug messages for Error objects', () => {
      const testError = new Error('GitHub API token invalid');
      const integrationType = 'comment';

      handleGitHubIntegrationError(testError, integrationType);

      expect(info).toHaveBeenCalledWith(
        'GitHub comment integration failed - continuing with operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'GitHub comment integration error details: GitHub API token invalid'
      );
    });

    it('should log info and debug messages for string errors', () => {
      const testError = 'Network timeout';
      const integrationType = 'workflow summary';

      handleGitHubIntegrationError(testError, integrationType);

      expect(info).toHaveBeenCalledWith(
        'GitHub workflow summary integration failed - continuing with operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'GitHub workflow summary integration error details: Network timeout'
      );
    });

    it('should handle unknown error types', () => {
      const testError = { code: 404, status: 'Not Found' };
      const integrationType = 'comment';

      handleGitHubIntegrationError(testError, integrationType);

      expect(info).toHaveBeenCalledWith(
        'GitHub comment integration failed - continuing with operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'GitHub comment integration error details: [object Object]'
      );
    });

    it('should handle null and undefined errors', () => {
      const integrationType = 'workflow summary';

      handleGitHubIntegrationError(null, integrationType);

      expect(info).toHaveBeenCalledWith(
        'GitHub workflow summary integration failed - continuing with operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'GitHub workflow summary integration error details: null'
      );

      vi.clearAllMocks();

      handleGitHubIntegrationError(undefined, integrationType);

      expect(info).toHaveBeenCalledWith(
        'GitHub workflow summary integration failed - continuing with operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'GitHub workflow summary integration error details: undefined'
      );
    });

    it('should customize message based on integration type', () => {
      const testError = new Error('Test error');

      handleGitHubIntegrationError(testError, 'custom integration');

      expect(info).toHaveBeenCalledWith(
        'GitHub custom integration integration failed - continuing with operation'
      );
    });
  });
});
