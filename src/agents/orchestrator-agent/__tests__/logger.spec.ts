import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, logger } from '../logger.js';

// Mock pino to avoid actual logging in tests
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    level: 'info',
    name: 'orchestrator-agent'
  };

  return {
    default: vi.fn(() => mockLogger),
    stdTimeFunctions: {
      isoTime: vi.fn()
    },
    transport: vi.fn()
  };
});

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log function', () => {
    it('should call logger.info for log level', () => {
      log('log', 'Test message');

      expect(logger.info).toHaveBeenCalledWith(undefined, 'Test message');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should call logger.warn for warn level', () => {
      log('warn', 'Warning message');

      expect(logger.warn).toHaveBeenCalledWith(undefined, 'Warning message');
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should call logger.error for error level', () => {
      log('error', 'Error message');

      expect(logger.error).toHaveBeenCalledWith(undefined, 'Error message');
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should include args object when additional arguments provided', () => {
      const args = { userId: 123, action: 'test' };
      log('log', 'Message with args', args);

      expect(logger.info).toHaveBeenCalledWith({ args }, 'Message with args');
    });

    it('should handle multiple additional arguments', () => {
      log('log', 'Message', 'arg1', 'arg2', { key: 'value' });

      expect(logger.info).toHaveBeenCalledWith(
        { args: ['arg1', 'arg2', { key: 'value' }] },
        'Message'
      );
    });

    it('should handle empty additional arguments', () => {
      log('log', 'Simple message');

      expect(logger.info).toHaveBeenCalledWith(undefined, 'Simple message');
    });
  });

  describe('logger configuration', () => {
    it('should export the logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should have expected logger methods', () => {
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
    });
  });
});