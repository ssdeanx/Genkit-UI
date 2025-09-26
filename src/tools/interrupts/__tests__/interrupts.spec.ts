import { describe, it, expect } from 'vitest';
import { ResumedMetadataSchema } from '../confirmOverwrite.js';
import { ActionResumedSchema } from '../confirmAction.js';

describe('interrupt resumed metadata schemas', () => {
  it('parses ResumedMetadataSchema approved true', () => {
    const parsed = ResumedMetadataSchema.safeParse({ approved: true, approver: 'alice' });
    expect(parsed.success).toBe(true);
    if (parsed.success) { expect(parsed.data.approved).toBe(true); }
  });

  it('rejects unexpected fields in ResumedMetadataSchema when strict', () => {
    const parsed = ResumedMetadataSchema.safeParse({ approved: 'yes' });
    expect(parsed.success).toBe(false);
  });

  it('parses ActionResumedSchema APPROVED', () => {
    const parsed = ActionResumedSchema.safeParse({ status: 'APPROVED', approver: 'bob' });
    expect(parsed.success).toBe(true);
    if (parsed.success) { expect(parsed.data.status).toBe('APPROVED'); }
  });

  it('rejects invalid ActionResumedSchema status', () => {
    const parsed = ActionResumedSchema.safeParse({ status: 'MAYBE' });
    expect(parsed.success).toBe(false);
  });
});
