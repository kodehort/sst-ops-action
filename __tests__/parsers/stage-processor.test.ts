/**
 * Test suite for StageProcessor
 * Tests processing of stage computation operations
 */

import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StageProcessor } from '../../src/parsers/stage-processor';
import type { BranchEnvironmentMapping, SSTOperation } from '../../src/types/operations';

describe('Stage Processor - GitHub Context Processing', () => {
  let processor: StageProcessor;

  beforeEach(() => {
    processor = new StageProcessor();
    // Reset the GitHub context mock
    vi.clearAllMocks();

    // Reset GitHub context to a clean state
    Object.assign(github.context, {
      eventName: 'push',
      payload: {},
      ref: undefined,
      ref_name: undefined,
    });
  });

  describe('Stage Computation from GitHub Context', () => {
    it('should compute stage from pull request head ref', () => {
      // Mock GitHub context for pull request
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/my-awesome-feature',
            },
          },
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(true);
      expect(result.operation).toBe('stage');
      expect(result.stage).toBe('my-awesome-feature');
      expect(result.computedStage).toBe('my-awesome-feature');
      expect(result.ref).toBe('feature/my-awesome-feature');
      expect(result.eventName).toBe('pull_request');
      expect(result.isPullRequest).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should compute stage from push event ref', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(true);
      expect(result.stage).toBe('main');
      expect(result.computedStage).toBe('main');
      expect(result.ref).toBe('refs/heads/main');
      expect(result.eventName).toBe('push');
      expect(result.isPullRequest).toBe(false);
    });

    it('should compute stage from head_ref in payload', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          head_ref: 'feature/awesome-branch',
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(true);
      expect(result.stage).toBe('awesome-branch');
      expect(result.computedStage).toBe('awesome-branch');
    });

    it('should fail when no ref is available', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {},
        ref: undefined,
      });

      const result = processor.process({});

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Failed to generate a valid stage name from Git context'
      );
      expect(result.exitCode).toBe(1);
    });

    it('should fail when ref results in empty stage', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: '---___', // This will result in empty string after sanitization
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Failed to generate a valid stage name from Git context'
      );
    });

    it('should sanitize ref names correctly', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/Feature/My_AWESOME-Feature!123',
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(true);
      expect(result.stage).toBe('my-awesome-feature-123');
      expect(result.computedStage).toBe('my-awesome-feature-123');
    });
  });

  describe('Output Content', () => {
    it('should include debug information in raw output', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const result = processor.process({});

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(false); // Never truncated since no CLI output
      expect(result.rawOutput).toContain('Stage computation successful');
      expect(result.rawOutput).toContain('Event: push');
      expect(result.rawOutput).toContain('Computed Stage: main');
    });
  });

  describe('Stage Name Truncation and Prefixing', () => {
    describe('Truncation Length', () => {
      it('should truncate long stage names to specified length', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/very-long-branch-name-that-exceeds-default-limits',
          },
        });

        const result = processor.process({
          truncationLength: 15,
        }); // Custom truncation length of 15

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('very-long-branc'); // Truncated to 15 chars
        expect(result.computedStage.length).toBe(15);
      });

      it('should not truncate short stage names', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/my-very-long-feature-branch-name-here',
          },
        });

        const result = processor.process({
          truncationLength: 50,
        }); // Custom truncation length of 50

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe(
          'my-very-long-feature-branch-name-here'
        ); // Should not be truncated
      });

      it('should handle prefix and truncation together', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-my-very-long-feature-branch-name-here',
          },
        });

        const result = processor.process({
          truncationLength: 15,
          prefix: 'pr-',
        }); // Custom truncation length of 15

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-123-my-very'); // Should be truncated to 15 chars total
        expect(result.computedStage.length).toBe(14); // After trailing hyphen cleanup
      });

      it('should remove trailing hyphens after truncation', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-my-very-long-feature-branch-name-here',
          },
        });

        const result = processor.process({
          truncationLength: 12,
        }); // Truncate to 12 chars

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-123-my-ve'); // Should be truncated to 12 chars
        expect(result.computedStage.length).toBe(12);
      });
    });

    describe('Prefix Handling', () => {
      it('should add prefix when stage name starts with digit', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-my-feature',
          },
        });

        const result = processor.process({
          truncationLength: 26,
          prefix: 'fix-',
        }); // Custom prefix 'fix-'

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('fix-123-my-feature');
      });

      it('should handle empty prefix', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-my-feature',
          },
        });

        const result = processor.process({
          truncationLength: 26,
          prefix: '',
        }); // Empty prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('123-my-feature');
      });

      it('should use custom prefix for numeric stage names', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/456-urgent-fix',
          },
        });

        const result = processor.process({
          truncationLength: 26,
          prefix: 'custom-',
        }); // Custom prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('custom-456-urgent-fix');
      });

      it('should handle prefix with truncation correctly', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/789-very-long-branch-name-that-will-be-truncated',
          },
        });

        const result = processor.process({
          truncationLength: 20,
          prefix: 'issue-',
        }); // Custom prefix and truncation

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('issue-789-very-long'); // Should include prefix in total length
        expect(result.computedStage.length).toBe(19); // After trailing hyphen cleanup
      });

      it('should not add prefix when stage starts with letter', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/feature-branch',
          },
        });

        const result = processor.process({}); // No custom parameters

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('feature-branch'); // No prefix added
      });

      it('should handle default prefix correctly', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/987-another-numeric-branch-with-default-prefix',
          },
        });

        const result = processor.process({
          truncationLength: 20,
        }); // Only custom truncation, default prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-987-another-numer'); // Should use default 'pr-' prefix
        expect(result.computedStage.length).toBe(20);
      });
    });
  });

  describe('Branch to Environment Mapping', () => {
    const createMockBranchMappings = (): BranchEnvironmentMapping => ({
      'main': 'production',
      'develop': 'staging',
      'feature/user-auth': 'development',
      '*': 'pr-env'
    });

    it('should resolve exact branch match for deploy operation', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const branchMappings = createMockBranchMappings();
      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('production');
      expect(result.computedStage).toBe('production');
      expect(result.ref).toBe('refs/heads/main');
    });

    it('should resolve exact branch match for develop branch', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/develop',
        },
      });

      const branchMappings = createMockBranchMappings();
      const result = processor.process({
        operation: 'diff' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('staging');
      expect(result.computedStage).toBe('staging');
    });

    it('should resolve exact branch match for feature branch', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/user-auth',
            },
          },
        },
      });

      const branchMappings = createMockBranchMappings();
      const result = processor.process({
        operation: 'diff' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('development');
      expect(result.computedStage).toBe('development');
      expect(result.ref).toBe('feature/user-auth');
    });

    it('should fall back to wildcard mapping for unmapped branches', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/unmapped-branch',
            },
          },
        },
      });

      const branchMappings = createMockBranchMappings();
      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('pr-env');
      expect(result.computedStage).toBe('pr-env');
    });

    it('should fall back to computed stage when no branch mapping found', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/unmapped-branch',
        },
      });

      const branchMappings: BranchEnvironmentMapping = {
        'main': 'production',
        'develop': 'staging',
      }; // No wildcard

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('unmapped-branch'); // Falls back to computed stage
      expect(result.computedStage).toBe('unmapped-branch');
    });

    it('should work without branch mappings (backward compatibility)', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/feature-branch',
        },
      });

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        // No branchMappings provided
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('feature-branch');
      expect(result.computedStage).toBe('feature-branch');
    });

    it('should handle empty branch mappings', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/test-branch',
        },
      });

      const branchMappings: BranchEnvironmentMapping = {}; // Empty mappings

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('test-branch'); // Falls back to computed stage
      expect(result.computedStage).toBe('test-branch');
    });

    it('should handle branch names with path prefixes correctly', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const branchMappings: BranchEnvironmentMapping = {
        'main': 'production', // Should match just 'main', not 'refs/heads/main'
      };

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('production');
      expect(result.computedStage).toBe('production');
    });

    it('should prioritize exact match over wildcard', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const branchMappings: BranchEnvironmentMapping = {
        'main': 'production',
        '*': 'default-env',
      };

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('production'); // Exact match should take priority
      expect(result.computedStage).toBe('production');
    });

    it('should handle special characters in branch names', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/JIRA-123_fix-bug',
            },
          },
        },
      });

      const branchMappings: BranchEnvironmentMapping = {
        'feature/JIRA-123_fix-bug': 'test-environment',
        '*': 'default-env',
      };

      const result = processor.process({
        operation: 'diff' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('test-environment');
      expect(result.computedStage).toBe('test-environment');
    });

    it('should handle case-sensitive branch matching', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/Main', // Capital M
        },
      });

      const branchMappings: BranchEnvironmentMapping = {
        'main': 'production', // lowercase
        'Main': 'production-alt', // uppercase
      };

      const result = processor.process({
        operation: 'deploy' as SSTOperation,
        branchMappings,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('production-alt'); // Should match exact case
      expect(result.computedStage).toBe('production-alt');
    });
  });
});
