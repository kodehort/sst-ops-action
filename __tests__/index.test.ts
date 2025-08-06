import { describe, expect, it, vi } from 'vitest';

// Mock the main module before importing
vi.mock('../src/main', () => ({
  run: vi.fn(),
}));

describe('Index Entry Point', () => {
  it('should import and call run function', async () => {
    const { run } = await import('../src/main');

    // Import the index file to trigger the run call
    await import('../src/index');

    expect(run).toHaveBeenCalled();
  });
});
