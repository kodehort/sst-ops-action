import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleGitHubIntegrationError,
  logActionVersion,
} from '../../src/utils/github-actions.js';

// Mock @actions/core functions
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  debug: vi.fn(),
}));

// Mock fs functions for version testing
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const { info, debug } = vi.mocked(core);

// Import mocked fs after setting up the mock
import { readFileSync } from 'node:fs';

const mockedReadFileSync = vi.mocked(readFileSync);

describe('GitHub Actions Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadFileSync.mockClear();
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

  describe('logActionVersion', () => {
    it('should log version for deploy operation', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));

      logActionVersion('deploy');

      expect(info).toHaveBeenCalledWith(
        '🏷️ SST Operations Action v1.2.3 - deploy operation'
      );
    });

    it('should handle missing version in package.json', () => {
      mockedReadFileSync.mockReturnValue(JSON.stringify({}));

      logActionVersion('diff');

      expect(info).toHaveBeenCalledWith(
        '🏷️ SST Operations Action vunknown - diff operation'
      );
    });

    it('should handle package.json read errors', () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      logActionVersion('remove');

      expect(info).toHaveBeenCalledWith(
        '🏷️ SST Operations Action vunknown - remove operation'
      );
      expect(debug).toHaveBeenCalledWith(
        'Failed to read version from package.json: ENOENT: no such file or directory'
      );
    });

    it('should handle invalid JSON in package.json', () => {
      mockedReadFileSync.mockReturnValue('{ invalid json');

      logActionVersion('stage');

      expect(info).toHaveBeenCalledWith(
        '🏷️ SST Operations Action vunknown - stage operation'
      );
      expect(debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read version from package.json:')
      );
    });
  });
});
