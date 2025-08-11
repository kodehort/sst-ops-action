/**
 * Test suite for StageParser
 * Tests parsing of stage computation operations
 */

import * as github from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StageParser } from '../../src/parsers/stage-parser';

describe('Stage Parser - GitHub Context Processing', () => {
  let parser: StageParser;

  beforeEach(() => {
    parser = new StageParser();
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

      const result = parser.parse('', 'fallback', 0, 1000);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('stage');
      expect(result.stage).toBe('my-awesome-feature');
      expect(result.computedStage).toBe('my-awesome-feature');
      expect(result.ref).toBe('feature/my-awesome-feature');
      expect(result.eventName).toBe('pull_request');
      expect(result.isPullRequest).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.completionStatus).toBe('complete');
    });

    it('should compute stage from push event ref', () => {
      // Mock GitHub context for push event
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/develop',
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('develop');
      expect(result.ref).toBe('refs/heads/develop');
      expect(result.eventName).toBe('push');
      expect(result.isPullRequest).toBe(false);
    });

    it('should compute stage from workflow_dispatch head_ref', () => {
      // Mock GitHub context for workflow_dispatch
      Object.assign(github.context, {
        eventName: 'workflow_dispatch',
        payload: {
          head_ref: 'main',
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('main');
      expect(result.ref).toBe('main');
      expect(result.eventName).toBe('workflow_dispatch');
      expect(result.isPullRequest).toBe(false);
    });

    it('should handle refs starting with digits by prefixing with "pr-"', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: '123-bugfix',
            },
          },
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('pr-123-bugfix');
    });

    it('should truncate long refs to 26 characters', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature/very-long-branch-name-that-exceeds-limits',
            },
          },
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('very-long-branch-name-that');
      expect(result.computedStage.length).toBe(26);
    });

    it('should normalize ref to kebab-case', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'Feature/My_Branch.Name',
            },
          },
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('my-branch-name');
    });

    it('should remove path prefix from refs', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/feature/branch-name',
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('branch-name');
    });

    it('should use fallback stage when ref is missing', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {},
      });

      const result = parser.parse('', 'my-fallback-stage', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('my-fallback-stage');
      expect(result.stage).toBe('my-fallback-stage');
      expect(result.ref).toBe('');
    });

    it('should handle empty ref by using fallback', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: '',
        },
      });

      const result = parser.parse('', 'fallback-stage', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('fallback-stage');
    });

    it('should handle ref with only special characters', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/---___',
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('fallback');
    });

    it('should return error when both computed and fallback stages are empty', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {},
      });

      const result = parser.parse('', '', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Failed to generate a valid stage name from ref'
      );
      expect(result.exitCode).toBe(1);
      expect(result.completionStatus).toBe('failed');
    });
  });

  describe('Output Handling', () => {
    it('should handle output truncation', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const result = parser.parse('', 'fallback', 0, 20); // Very small limit

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.rawOutput.length).toBe(20);
    });

    it('should not truncate when maxOutputSize is sufficient', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          ref: 'refs/heads/main',
        },
      });

      const result = parser.parse('', 'fallback', 0, 1000);

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(false);
      expect(result.rawOutput).toContain('Stage computation successful');
      expect(result.rawOutput).toContain('Event: push');
      expect(result.rawOutput).toContain('Computed Stage: main');
    });

    it('should include debug information in raw output', () => {
      Object.assign(github.context, {
        eventName: 'pull_request',
        payload: {
          pull_request: {
            head: {
              ref: 'feature-branch',
            },
          },
        },
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.rawOutput).toContain('Stage computation successful');
      expect(result.rawOutput).toContain('Event: pull_request');
      expect(result.rawOutput).toContain('Ref: feature-branch');
      expect(result.rawOutput).toContain('Computed Stage: feature-branch');
    });
  });

  describe('Context Fallback Chain', () => {
    it('should try multiple ref sources for non-PR events', () => {
      Object.assign(github.context, {
        eventName: 'workflow_dispatch',
        payload: {
          head_ref: undefined,
          ref: undefined,
        },
        ref: 'from-ref-name',
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('from-ref-name');
      expect(result.ref).toBe('from-ref-name');
    });

    it('should use context.ref as final fallback', () => {
      Object.assign(github.context, {
        eventName: 'push',
        payload: {
          head_ref: undefined,
          ref: undefined,
        },
        ref: 'refs/heads/final-fallback',
      });

      const result = parser.parse('', 'fallback', 0);

      expect(result.success).toBe(true);
      expect(result.computedStage).toBe('final-fallback');
      expect(result.ref).toBe('refs/heads/final-fallback');
    });
  });

  describe('Configurable Parameters', () => {
    describe('Custom Truncation Length', () => {
      it('should use custom truncation length', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/very-long-branch-name-that-exceeds-default-limits',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 15); // Custom truncation length of 15

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('very-long-branc'); // Truncated to 15 chars
        expect(result.computedStage.length).toBe(15);
      });

      it('should not truncate if stage is shorter than custom length', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/short',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 50); // Custom truncation length of 50

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('short');
        expect(result.computedStage.length).toBe(5);
      });

      it('should handle truncation with prefix', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-very-long-branch-name-that-exceeds-limits',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 15, 'pr-'); // Custom truncation length of 15

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-123-very-lon'); // Truncated to 15 chars including prefix
        expect(result.computedStage.length).toBe(15);
        expect(result.computedStage.startsWith('pr-')).toBe(true);
      });

      it('should clean up trailing hyphens after truncation', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/branch-name-with-trailing-',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 12); // Truncate to 12 chars

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('branch-name'); // Trailing hyphen removed
        expect(result.computedStage.endsWith('-')).toBe(false);
      });
    });

    describe('Custom Prefix', () => {
      it('should use custom prefix', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-hotfix',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 26, 'fix-'); // Custom prefix 'fix-'

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('fix-123-hotfix');
        expect(result.computedStage.startsWith('fix-')).toBe(true);
      });

      it('should handle empty prefix', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-hotfix',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 26, ''); // Empty prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('123-hotfix');
      });

      it('should not add prefix for non-numeric branches', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/feature-branch',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 26, 'custom-'); // Custom prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('feature-branch');
        expect(result.computedStage.startsWith('custom-')).toBe(false);
      });

      it('should combine custom prefix with custom truncation length', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-very-long-branch-name-that-needs-truncation',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 20, 'issue-'); // Custom prefix and truncation

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('issue-123-very-long'); // Truncated to 19 chars due to trailing hyphen cleanup
        expect(result.computedStage.length).toBeLessThanOrEqual(20);
        expect(result.computedStage.startsWith('issue-')).toBe(true);
      });
    });

    describe('Default Parameter Values', () => {
      it('should use default values when parameters not provided', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-very-long-branch-name-that-should-be-truncated-to-26-characters',
          },
        });

        const result = parser.parse('', 'fallback', 0); // No custom parameters

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-123-very-long-branch-na'); // Default truncation to 26 chars
        expect(result.computedStage.length).toBeLessThanOrEqual(26);
        expect(result.computedStage.startsWith('pr-')).toBe(true); // Default prefix
      });

      it('should handle partial parameter specification', () => {
        Object.assign(github.context, {
          eventName: 'push',
          payload: {
            ref: 'refs/heads/123-branch',
          },
        });

        const result = parser.parse('', 'fallback', 0, 1000, 20); // Only custom truncation, default prefix

        expect(result.success).toBe(true);
        expect(result.computedStage).toBe('pr-123-branch'); // Default prefix 'pr-'
        expect(result.computedStage.length).toBeLessThanOrEqual(20);
      });
    });
  });
});
