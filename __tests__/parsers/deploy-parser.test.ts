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
  SST_DEPLOY_SUCCESS_OUTPUT,
} from '../fixtures/sst-outputs';

describe('Deploy Parser - SST Output Processing', () => {
  let parser: DeployParser;

  beforeEach(() => {
    parser = new DeployParser();
  });

  describe('Deployment Output Parsing', () => {
    it('should parse successful deployment output', () => {
      const result = parser.parse(SST_DEPLOY_SUCCESS_OUTPUT, 'production', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('production');
      expect(result.app).toBe('www-kodehort-com');
      expect(result.completionStatus).toBe('complete');
      expect(result.permalink).toBe('https://sst.dev/u/1a3e112e');
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.resourceChanges).toBe(9); // Real count from actual output

      // Check resources - should include created, updated, and deleted
      expect(result.resources.length).toBeGreaterThanOrEqual(5);

      // Check that we have created resources
      const createdResources = result.resources.filter(
        (r) => r.status === 'created'
      );
      expect(createdResources.length).toBeGreaterThan(0);

      // Check that timing is captured
      const timedResources = result.resources.filter((r) => r.timing);
      expect(timedResources.length).toBeGreaterThan(0);

      // Check outputs - should include Astro, www, github_role_arn, and github_role_name
      expect(result.outputs.length).toBeGreaterThanOrEqual(4);

      const astroOutput = result.outputs.find((o) => o.key === 'Astro');
      expect(astroOutput).toBeDefined();
      expect(astroOutput?.value).toBe('https://kodehort.com');

      const wwwOutput = result.outputs.find((o) => o.key === 'www');
      expect(wwwOutput).toBeDefined();
      expect(wwwOutput?.value).toBe('https://kodehort.com');

      const githubRoleArnOutput = result.outputs.find(
        (o) => o.key === 'github_role_arn'
      );
      expect(githubRoleArnOutput).toBeDefined();
      expect(githubRoleArnOutput?.value).toBe(
        'arn:aws:iam::196313910340:role/production-GithubActionRole'
      );

      const githubRoleNameOutput = result.outputs.find(
        (o) => o.key === 'github_role_name'
      );
      expect(githubRoleNameOutput).toBeDefined();
      expect(githubRoleNameOutput?.value).toBe('production-GithubActionRole');
    });

    it('should parse failed deployment output', () => {
      const result = parser.parse(
        SST_DEPLOY_FAILURE_OUTPUT,
        'sst-ops-actions',
        1
      );

      expect(result.success).toBe(false);
      expect(result.operation).toBe('deploy');
      expect(result.app).toBe('kodehort-scratch');
      expect(result.completionStatus).toBe('failed');
      expect(result.exitCode).toBe(1);
      expect(result.error).toBeDefined();
      expect(result.error).toContain(
        "Resource 'E3EDFTB7D6VMW5' does not exist"
      );

      // Should capture resource information even on failure
      const createdResources = result.resources.filter(
        (r) => r.status === 'created'
      );
      expect(createdResources.length).toBeGreaterThan(0);

      // Should capture timing for successful resources
      const timedResources = result.resources.filter((r) => r.timing);
      expect(timedResources.length).toBeGreaterThan(0);

      // Failed deployments may have outputs for debugging
      expect(result.outputs.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed output gracefully', () => {
      const result = parser.parse(MALFORMED_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true); // Exit code 0
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe(''); // No app found
      expect(result.resources).toHaveLength(0);
      expect(result.outputs).toHaveLength(0);
      expect(result.resourceChanges).toBe(0);
    });

    it('should handle empty output', () => {
      const result = parser.parse(EMPTY_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.stage).toBe('staging');
      expect(result.app).toBe('');
      expect(result.resources).toHaveLength(0);
      expect(result.outputs).toHaveLength(0);
      expect(result.resourceChanges).toBe(0);
    });

    it('should handle incomplete output', () => {
      const result = parser.parse(INCOMPLETE_OUTPUT, 'staging', 0);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('deploy');
      expect(result.app).toBe('my-sst-app');
      expect(result.completionStatus).toBe('complete');
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0]).toEqual({
        name: 'Function',
        type: 'sst:aws:Function',
        status: 'created',
        timing: '1.2s',
      });
      expect(result.outputs).toHaveLength(0);
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
SST 3.17.10  ready!

➜  App:        test-app
   Stage:      staging

~  Deploy

|  Created     Function sst:aws:Function (1.2s)
|  Updated     Api sst:aws:Function (0.8s)
|  Updated     Website sst:aws:Astro (2.3s)
|  Created     Function sst:aws:Function (1.5s)
|  Deleted     Database sst:aws:Dynamo (0.5s)

✓  Complete
   Router: https://api.test.com
`;

      const result = parser.parse(mixedOutput, 'staging', 0);

      expect(result.resourceChanges).toBe(5);
      expect(result.resources).toHaveLength(5);

      // Check specific statuses and timing
      const functionResources = result.resources.filter(
        (r) => r.name === 'Function'
      );
      expect(functionResources).toHaveLength(2);
      expect(functionResources.every((r) => r.status === 'created')).toBe(true);
      expect(functionResources.every((r) => r.timing)).toBe(true);

      const apiResources = result.resources.filter((r) => r.name === 'Api');
      expect(apiResources).toHaveLength(1);
      expect(apiResources[0]?.status).toBe('updated');
      expect(apiResources[0]?.timing).toBe('0.8s');

      const deletedResources = result.resources.filter(
        (r) => r.status === 'deleted'
      );
      expect(deletedResources).toHaveLength(1);
      expect(deletedResources[0]?.name).toBe('Database');
    });

    it('should handle various URL types correctly', () => {
      const urlOutput = `
SST 3.17.10  ready!

➜  App:        test-app
   Stage:      staging

~  Deploy

|  Created     Function sst:aws:Function (1.2s)

✓  Complete
   Router: https://router.example.com
   Api: https://api.example.com/v1
   Web: https://web.example.com
   Website: https://site.example.com
   Function: https://lambda.example.com
`;

      const result = parser.parse(urlOutput, 'staging', 0);

      expect(result.outputs).toHaveLength(5);

      // Check output parsing
      const routerOutput = result.outputs.find((o) => o.key === 'Router');
      expect(routerOutput?.value).toBe('https://router.example.com');

      const apiOutput = result.outputs.find((o) => o.key === 'Api');
      expect(apiOutput?.value).toBe('https://api.example.com/v1');

      const webOutput = result.outputs.find((o) => o.key === 'Web');
      expect(webOutput?.value).toBe('https://web.example.com');

      const websiteOutput = result.outputs.find((o) => o.key === 'Website');
      expect(websiteOutput?.value).toBe('https://site.example.com');

      const functionOutput = result.outputs.find((o) => o.key === 'Function');
      expect(functionOutput?.value).toBe('https://lambda.example.com');
    });
  });

  describe('error handling', () => {
    it('should extract error messages from failed deployments', () => {
      const errorOutput = `
SST 3.17.10  ready!

➜  App:        test-app
   Stage:      staging

~  Deploy

|  Error       Api sst:aws:Function → ApiDistribution aws:cloudfront:Distribution
resource 'E1234567890' does not exist

✖  Failed

Error: invocation of aws:iam/getPolicyDocument:getPolicyDocument returned an error: grpc: the client
Additional context: AWS credentials invalid
`;

      const result = parser.parse(errorOutput, 'staging', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Resource 'E1234567890' does not exist");
      expect(result.completionStatus).toBe('failed');
    });

    it('should handle resource parsing errors gracefully', () => {
      const malformedResourceOutput = `
SST 3.17.10  ready!

➜  App:        test-app
   Stage:      staging

~  Deploy

| Invalid resource line format
|  Created     Function sst:aws:Function (1.2s)
| Malformed    line without proper spacing

✓  Complete
`;

      const result = parser.parse(malformedResourceOutput, 'staging', 0);

      // Should still parse what it can
      expect(result.success).toBe(true);
      expect(result.resources.length).toBeGreaterThanOrEqual(1);

      // Should find the valid resource
      const validResource = result.resources.find((r) => r.name === 'Function');
      expect(validResource).toBeDefined();
      expect(validResource?.status).toBe('created');
      expect(validResource?.timing).toBe('1.2s');
    });
  });

  describe('performance', () => {
    it('should parse large outputs efficiently', () => {
      // Create large output with many resources
      const largeResourceList = Array.from(
        { length: 100 },
        (_, i) =>
          `|  Created     Function-${i} sst:aws:Function (${(Math.random() * 5 + 0.5).toFixed(1)}s)`
      ).join('\n');

      const largeOutput = `
SST 3.17.10  ready!

➜  App:        large-app
   Stage:      staging

~  Deploy

${largeResourceList}

✓  Complete
   Router: https://api.large-app.com
`;

      const startTime = Date.now();
      const result = parser.parse(largeOutput, 'staging', 0);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.resources).toHaveLength(100);
      expect(result.resourceChanges).toBe(100);

      // All resources should have timing
      expect(result.resources.every((r) => r.timing)).toBe(true);
    });
  });
});
