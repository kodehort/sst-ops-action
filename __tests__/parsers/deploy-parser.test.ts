/**
 * Test suite for DeployParser
 * Tests parsing of SST deploy command outputs
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DeployParser } from '../../src/parsers/deploy-parser';
import {
  EMPTY_OUTPUT,
  INCOMPLETE_OUTPUT,
  MALFORMED_OUTPUT,
  SST_DEPLOY_FAILURE_OUTPUT,
  SST_DEPLOY_PARTIAL_OUTPUT,
  SST_DEPLOY_SUCCESS_OUTPUT,
} from '../fixtures/sst-outputs';

describe('DeployParser', () => {
  let parser: DeployParser;

  beforeEach(() => {
    parser = new DeployParser();
  });

  describe('parse', () => {
    it('should parse successful deployment output', () => {
      const result = parser.parse(SST_DEPLOY_SUCCESS_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('my-sst-app');
      expect(result.completionStatus).toBe('complete');
      expect(result.permalink).toBe(
        'https://console.sst.dev/my-sst-app/staging/deployments/abc123'
      );
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.resourceChanges).toBe(3);

      // Check resources
      expect(result.resources).toHaveLength(3);
      expect(result.resources[0]).toEqual({
        type: 'Function',
        name: 'my-sst-app-staging-handler',
        status: 'created',
      });
      expect(result.resources[1]).toEqual({
        type: 'Api',
        name: 'my-sst-app-staging-api',
        status: 'created',
      });
      expect(result.resources[2]).toEqual({
        type: 'Website',
        name: 'my-sst-app-staging-web',
        status: 'created',
      });

      // Check URLs
      expect(result.urls).toHaveLength(2);
      expect(result.urls[0]).toEqual({
        name: 'Router',
        url: 'https://api.staging.example.com',
        type: 'api',
      });
      expect(result.urls[1]).toEqual({
        name: 'Web',
        url: 'https://staging.example.com',
        type: 'web',
      });
    });

    it('should parse partial deployment output', () => {
      const result = parser.parse(SST_DEPLOY_PARTIAL_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0 = success even if partial
      expect(result.operation).toBe('deploy');
      expect(result.completionStatus).toBe('partial');
      expect(result.resourceChanges).toBe(3);

      // Check mixed resource statuses
      expect(result.resources).toHaveLength(3);
      expect(result.resources[0].status).toBe('created');
      expect(result.resources[1].status).toBe('updated');
      expect(result.resources[2].status).toBe('unchanged'); // Failed mapped to unchanged for now

      // Only successful URLs should be included
      expect(result.urls).toHaveLength(1);
      expect(result.urls[0].name).toBe('Router');
    });

    it('should parse failed deployment output', () => {
      const result = parser.parse(SST_DEPLOY_FAILURE_OUTPUT, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('deploy');
      expect(result.completionStatus).toBe('failed');
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Deployment failed');
      expect(result.resourceChanges).toBe(3);

      // Should still capture resource information even on failure
      expect(result.resources).toHaveLength(3);
      expect(result.resources[0].status).toBe('created');
      expect(result.resources[1].status).toBe('unchanged'); // Failed mapped to unchanged
      expect(result.resources[2].status).toBe('unchanged');

      // No URLs on failed deployment
      expect(result.urls).toHaveLength(0);
    });

    it('should handle malformed output gracefully', () => {
      const result = parser.parse(MALFORMED_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe(''); // No app found
      expect(result.resources).toHaveLength(0);
      expect(result.urls).toHaveLength(0);
      expect(result.resourceChanges).toBe(0);
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('');
      expect(result.resources).toHaveLength(0);
      expect(result.urls).toHaveLength(0);
      expect(result.resourceChanges).toBe(0);
    });

    it('should handle incomplete output', () => {
      const result = parser.parse(INCOMPLETE_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.app).toBe('my-sst-app');
      expect(result.completionStatus).toBe('complete');
      expect(result.resources).toHaveLength(1);
      expect(result.urls).toHaveLength(0);
      expect(result.resourceChanges).toBe(1);
    });

    it('should properly set truncated flag based on output size', () => {
      const largeOutput = SST_DEPLOY_SUCCESS_OUTPUT.repeat(1000);
      const result = parser.parse(largeOutput, 'staging', 0, 1000); // max size 1000 bytes

      expect(result.truncated).toBe(true);
      expect(result.rawOutput.length).toBeLessThanOrEqual(1000);
    });

    it('should extract resource changes correctly', () => {
      const mixedOutput = `
SST Deploy
App: test-app
Stage: staging

✓ Complete
| Created         Function       test-function-1
| Updated         Api           test-api-1  
| Updated         Website       test-web-1
| Created         Function      test-function-2
| Unchanged       Database      test-db-1

Router: https://api.test.com
`;

      const result = parser.parse(mixedOutput, 'staging', 0);

      expect(result.resourceChanges).toBe(5);
      expect(result.resources).toHaveLength(5);

      // Check specific statuses
      const functionResources = result.resources.filter(
        (r) => r.type === 'Function'
      );
      expect(functionResources).toHaveLength(2);
      expect(functionResources.every((r) => r.status === 'created')).toBe(true);

      const apiResources = result.resources.filter((r) => r.type === 'Api');
      expect(apiResources).toHaveLength(1);
      expect(apiResources[0].status).toBe('updated');
    });

    it('should handle various URL types correctly', () => {
      const urlOutput = `
SST Deploy
App: test-app
Stage: staging

✓ Complete
| Created         Function       test-function

Router:   https://router.example.com
Api:      https://api.example.com/v1
Web:      https://web.example.com
Website:  https://site.example.com
Function: https://lambda.example.com
`;

      const result = parser.parse(urlOutput, 'staging', 0);

      expect(result.urls).toHaveLength(5);

      // Check URL type mapping
      const routerUrl = result.urls.find((u) => u.name === 'Router');
      expect(routerUrl?.type).toBe('api');

      const apiUrl = result.urls.find((u) => u.name === 'Api');
      expect(apiUrl?.type).toBe('api');

      const webUrl = result.urls.find((u) => u.name === 'Web');
      expect(webUrl?.type).toBe('web');

      const websiteUrl = result.urls.find((u) => u.name === 'Website');
      expect(websiteUrl?.type).toBe('web');

      const functionUrl = result.urls.find((u) => u.name === 'Function');
      expect(functionUrl?.type).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should extract error messages from failed deployments', () => {
      const errorOutput = `
SST Deploy
App: test-app
Stage: staging

✗ Failed
| Failed          Api           test-api (permission denied)

Error: Deployment failed with 1 errors
Additional context: AWS credentials invalid
`;

      const result = parser.parse(errorOutput, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment failed');
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle resource parsing errors gracefully', () => {
      const malformedResourceOutput = `
SST Deploy
App: test-app  
Stage: staging

✓ Complete
| Invalid resource line format
| Created Function test-function
| Malformed    line without proper spacing
`;

      const result = parser.parse(malformedResourceOutput, 'staging', 0);

      // Should still parse what it can
      expect(result.success).toBe(true);
      expect(result.resources.length).toBeGreaterThanOrEqual(1);

      // Should find the valid resource
      const validResource = result.resources.find(
        (r) => r.name === 'test-function'
      );
      expect(validResource).toBeDefined();
      expect(validResource?.status).toBe('created');
    });
  });

  describe('performance', () => {
    it('should parse large outputs efficiently', () => {
      // Create large output with many resources
      const largeResourceList = Array.from(
        { length: 100 },
        (_, i) => `| Created         Function       test-function-${i}`
      ).join('\n');

      const largeOutput = `
SST Deploy
App: large-app
Stage: staging

✓ Complete
${largeResourceList}

Router: https://api.large-app.com
`;

      const startTime = Date.now();
      const result = parser.parse(largeOutput, 'staging', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.resources).toHaveLength(100);
      expect(result.resourceChanges).toBe(100);
    });
  });
});
