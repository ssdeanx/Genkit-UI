export class UserFacingError extends Error {
  public details?: unknown;

  constructor(message: string, options?: { details?: unknown }) {
    super(message);
    this.name = 'UserFacingError';
    this.details = options?.details;
  }
}
