import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmActionTool } from '../confirmAction.js';
import { confirmOverwriteTool } from '../confirmOverwrite.js';
import { ai } from '../../../config.js';

vi.mock('../../../config.js', () => {
  const fakeAi = {
    defineTool: vi.fn((cfg: unknown, impl: Function) => impl),
  };
  return { ai: fakeAi };
});

describe('interrupt tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirmActionTool approves when resumed status APPROVED', async () => {
    const res = await confirmActionTool({ actionName: 'delete', target: 'file.txt', risk: 'low' }, { resumed: { status: 'APPROVED', approver: 'sam' }, interrupt: vi.fn() } as unknown as Parameters<typeof confirmActionTool>[1]);
    expect(res.status).toBe('APPROVED');
    expect(res.message).toContain('approved');
  });

  it('confirmActionTool rejects when resumed status REJECTED', async () => {
    const res = await confirmActionTool({ actionName: 'delete', target: 'file.txt', risk: 'medium' }, { resumed: { status: 'REJECTED' }, interrupt: vi.fn() } as unknown as Parameters<typeof confirmActionTool>[1]);
    expect(res.status).toBe('REJECTED');
  });

  it('confirmActionTool triggers interrupt when no approval', async () => {
    const interrupt = vi.fn();
    const res = await confirmActionTool({ actionName: 'delete', target: 'file.txt', reason: 'cleanup', risk: 'high' }, { interrupt } as unknown as Parameters<typeof confirmActionTool>[1]);
    expect(interrupt).toHaveBeenCalled();
    expect(res.status).toBe('PENDING');
  });

  it('confirmOverwriteTool confirms when resumed.approved true', async () => {
    const res = await confirmOverwriteTool({ filePath: 'a.txt', risk: 'low' }, { resumed: { approved: true }, interrupt: vi.fn() } as unknown as Parameters<typeof confirmOverwriteTool>[1]);
    expect(res.confirmed).toBe(true);
  });

  it('confirmOverwriteTool declines when resumed.approved false', async () => {
    const res = await confirmOverwriteTool({ filePath: 'a.txt', risk: 'low' }, { resumed: { approved: false }, interrupt: vi.fn() } as unknown as Parameters<typeof confirmOverwriteTool>[1]);
    expect(res.confirmed).toBe(false);
  });

  it('confirmOverwriteTool triggers interrupt when no decision', async () => {
    const interrupt = vi.fn();
    const res = await confirmOverwriteTool({ filePath: 'a.txt', summary: 'sum', risk: 'medium' }, { interrupt } as unknown as Parameters<typeof confirmOverwriteTool>[1]);
    expect(interrupt).toHaveBeenCalled();
    expect(res.confirmed).toBe(false);
  });
});
