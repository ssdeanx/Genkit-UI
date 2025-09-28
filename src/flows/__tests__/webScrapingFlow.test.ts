import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webScrapingFlow } from '../webScrapingFlow.js';
import * as tool from '../../tools/webScrapingTool.js';
import type { WebScrapingInput, WebScrapingOutput } from '../../schemas/webScrapingSchema.js';

vi.mock('../../tools/webScrapingTool.js', () => ({ webScrapingTool: vi.fn() }));

describe('webScrapingFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated envelope from tool', async () => {
    const envelope = {
      success: true,
      operation: 'scrapeUrl',
      result: { url: 'https://ex.com', meta: {}, html: '<p/>', text: 't', links: [], images: [], fetchedAt: new Date().toISOString() },
      metadata: { timestamp: new Date().toISOString(), duration: 5, urlsProcessed: 1 },
    };
  vi.mocked(tool.webScrapingTool).mockResolvedValue(envelope as WebScrapingOutput);

  const input: WebScrapingInput = { operation: 'scrapeUrl', url: 'https://ex.com', options: undefined, urls: undefined, data: undefined, flowId: undefined };
  const res = await webScrapingFlow(input);
    expect(res.success).toBe(true);
  });

  it('throws UserFacingError when tool returns invalid envelope', async () => {
    vi.mocked(tool.webScrapingTool).mockResolvedValue({ nope: true } as unknown as WebScrapingOutput);
    await expect(webScrapingFlow({ operation: 'scrapeUrl', url: 'https://ex.com' } as WebScrapingInput)).rejects.toThrowError('Schema validation failed for webScrapingFlow output');
  });
});
