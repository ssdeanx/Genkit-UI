import { describe, it, expect } from 'vitest';
import { UserFacingError } from '../UserFacingError.js';

describe('UserFacingError', () => {
  it('sets name and message', () => {
    const err = new UserFacingError('oops');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UserFacingError');
    expect(err.message).toBe('oops');
    expect(err.details).toBeUndefined();
  });

  it('stores details when provided', () => {
    const details = { reason: 'x', code: 400 };
    const err = new UserFacingError('bad', { details });
    expect(err.details).toEqual(details);
  });
});
