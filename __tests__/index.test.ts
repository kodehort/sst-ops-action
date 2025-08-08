import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/main', () => ({
  run: vi.fn(),
}));

describe('Index Entry Point', () => {
  it('should import and call run function', async () => {
    const { run } = await import('../src/main');

    await import('../src/index');

    expect(run).toHaveBeenCalled();
  });
});
