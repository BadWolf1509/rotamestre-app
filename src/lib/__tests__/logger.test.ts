/**
 * Tests for logger utilities
 */

import { logger, measureTime } from '../logger';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('debug', () => {
    it('should log in development mode', () => {
      logger.debug('Test message');

      // __DEV__ is true in test environment
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'Test message');
    });

    it('should sanitize sensitive data', () => {
      logger.debug({ password: 'secret123', name: 'John' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', {
        password: '[REDACTED]',
        name: 'John',
      });
    });
  });

  describe('info', () => {
    it('should log in development mode', () => {
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'Info message');
    });

    it('should sanitize email in string', () => {
      logger.info('User email: test@example.com');

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'User email: [REDACTED]');
    });
  });

  describe('warn', () => {
    it('should log warning in development mode', () => {
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', 'Warning message');
    });
  });

  describe('error', () => {
    it('should log error with message', () => {
      logger.error('Error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Error occurred', undefined);
    });

    it('should log error with Error object', () => {
      const error = new Error('Something went wrong');
      logger.error('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Operation failed', error);
    });
  });

  describe('api', () => {
    it('should log API operation', () => {
      logger.api('fetchUsers');

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] fetchUsers', '');
    });

    it('should log API operation with details', () => {
      logger.api('createUser', { userId: '123', name: 'John' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] createUser', {
        userId: '123',
        name: 'John',
      });
    });

    it('should sanitize API details', () => {
      logger.api('login', { email: 'test@example.com', token: 'abc123' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] login', {
        email: '[REDACTED]',
        token: '[REDACTED]',
      });
    });
  });

  describe('navigation', () => {
    it('should log navigation', () => {
      logger.navigation('HomeScreen');

      expect(consoleLogSpy).toHaveBeenCalledWith('[NAV] → HomeScreen', '');
    });

    it('should log navigation with params', () => {
      logger.navigation('ProfileScreen', { userId: '123' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[NAV] → ProfileScreen', {
        userId: '123',
      });
    });
  });

  describe('perf', () => {
    it('should log performance with rocket emoji for fast operations', () => {
      logger.perf('fastOperation', 100);

      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] 🚀 fastOperation: 100ms');
    });

    it('should log performance with walking emoji for medium operations', () => {
      logger.perf('mediumOperation', 700);

      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] 🚶 mediumOperation: 700ms');
    });

    it('should log performance with turtle emoji for slow operations', () => {
      logger.perf('slowOperation', 1500);

      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] 🐢 slowOperation: 1500ms');
    });
  });

  describe('sanitization', () => {
    it('should redact JWT tokens in strings', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      logger.info(`Token: ${token}`);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'Token: [REDACTED]');
    });

    it('should redact CPF in strings', () => {
      logger.info('CPF: 123.456.789-00');

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'CPF: [REDACTED]');
    });

    it('should redact CNPJ in strings', () => {
      logger.info('CNPJ: 12.345.678/0001-90');

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'CNPJ: [REDACTED]');
    });

    it('should redact phone numbers in strings', () => {
      logger.info('Phone: 11999887766');

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 'Phone: [REDACTED]');
    });

    it('should redact sensitive fields in objects', () => {
      const data = {
        name: 'John',
        password: 'secret',
        api_key: 'key123',
        authorization: 'Bearer token',
        credit_card: '1234-5678-9012-3456',
        service_role: 'admin',
      };

      logger.info(data);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', {
        name: 'John',
        password: '[REDACTED]',
        api_key: '[REDACTED]',
        authorization: '[REDACTED]',
        credit_card: '[REDACTED]',
        service_role: '[REDACTED]',
      });
    });

    it('should redact nested sensitive fields', () => {
      const data = {
        user: {
          name: 'John',
          senha: 'secret123',
        },
      };

      logger.info(data);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', {
        user: {
          name: 'John',
          senha: '[REDACTED]',
        },
      });
    });

    it('should redact sensitive data in arrays', () => {
      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ];

      logger.info(data);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', [
        { name: 'John', email: '[REDACTED]' },
        { name: 'Jane', email: '[REDACTED]' },
      ]);
    });

    it('should handle null and undefined values', () => {
      logger.info(null);
      logger.info(undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', null);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', undefined);
    });

    it('should handle numbers and booleans', () => {
      logger.info(123);
      logger.info(true);

      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', 123);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO]', true);
    });
  });

  describe('measureTime', () => {
    beforeEach(() => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(150);
    });

    it('should measure synchronous function time', () => {
      const result = measureTime('testOp', () => 'result');

      expect(result).toBe('result');
      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] 🚀 testOp: 150ms');
    });

    it('should measure async function time', async () => {
      jest.spyOn(performance, 'now')
        .mockReset()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(500);

      const result = await measureTime('asyncOp', async () => {
        return 'async result';
      });

      expect(result).toBe('async result');
    });

    it('should still log time when function throws', () => {
      expect(() => {
        measureTime('errorOp', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] 🚀 errorOp: 150ms');
    });
  });

  describe('network', () => {
    it('should log network request without status', () => {
      logger.network('GET', '/api/users');

      expect(consoleLogSpy).toHaveBeenCalledWith('[NET] 🌐 GET /api/users');
    });

    it('should log network request with status and duration', () => {
      logger.network('POST', '/api/routes', 201, 150);

      expect(consoleLogSpy).toHaveBeenCalledWith('[NET] 🌐 POST /api/routes → 201 (150ms)');
    });

    it('should log network error with warning emoji', () => {
      logger.network('GET', '/api/users', 404, 50);

      expect(consoleLogSpy).toHaveBeenCalledWith('[NET] ⚠️ GET /api/users → 404 (50ms)');
    });

    it('should log network error with error message', () => {
      logger.network('POST', '/api/data', undefined, undefined, 'Network error');

      expect(consoleLogSpy).toHaveBeenCalledWith('[NET] ❌ POST /api/data - Network error');
    });
  });

  describe('action', () => {
    it('should log user action', () => {
      logger.action('button_click', 'Save Route');

      expect(consoleLogSpy).toHaveBeenCalledWith('[ACTION] 👆 button_click: Save Route', '');
    });

    it('should log user action with data', () => {
      logger.action('form_submit', 'Create Route', { routeId: '123' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ACTION] 👆 form_submit: Create Route',
        { routeId: '123' }
      );
    });

    it('should sanitize sensitive data in actions', () => {
      logger.action('login', 'User logged in', { email: 'test@example.com' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ACTION] 👆 login: User logged in',
        { email: '[REDACTED]' }
      );
    });
  });

  describe('breadcrumbs', () => {
    beforeEach(() => {
      logger.clearBreadcrumbs();
    });

    it('should collect breadcrumbs from actions', () => {
      logger.action('click', 'Button A');
      logger.action('click', 'Button B');

      const crumbs = logger.getBreadcrumbs();

      expect(crumbs).toHaveLength(2);
      expect(crumbs[0].message).toBe('click: Button A');
      expect(crumbs[1].message).toBe('click: Button B');
    });

    it('should collect breadcrumbs from network calls', () => {
      logger.network('GET', '/api/users', 200, 50);

      const crumbs = logger.getBreadcrumbs();

      expect(crumbs).toHaveLength(1);
      expect(crumbs[0].type).toBe('network');
      expect(crumbs[0].message).toContain('GET /api/users');
    });

    it('should limit breadcrumbs to MAX_BREADCRUMBS', () => {
      // Add more than MAX_BREADCRUMBS (50)
      for (let i = 0; i < 60; i++) {
        logger.action('click', `Button ${i}`);
      }

      const crumbs = logger.getBreadcrumbs();

      expect(crumbs.length).toBeLessThanOrEqual(50);
      // Should have the most recent ones
      expect(crumbs[crumbs.length - 1].message).toBe('click: Button 59');
    });

    it('should clear breadcrumbs', () => {
      logger.action('click', 'Button');
      logger.clearBreadcrumbs();

      const crumbs = logger.getBreadcrumbs();

      expect(crumbs).toHaveLength(0);
    });
  });

  describe('operation tracking', () => {
    let consoleGroupSpy: jest.SpyInstance;
    let consoleGroupEndSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
      consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
      logger.clearBreadcrumbs();
    });

    afterEach(() => {
      consoleGroupSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });

    it('should start operation and return correlation ID', () => {
      const correlationId = logger.startOperation('Create Route');

      expect(correlationId).toBeDefined();
      expect(correlationId.length).toBe(6);
      expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('Create Route'));
    });

    it('should end operation', () => {
      logger.startOperation('Test Op');
      logger.endOperation(true);

      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should track correlation ID', () => {
      const id = logger.startOperation('Test');

      expect(logger.getCorrelationId()).toBe(id);

      logger.endOperation();

      expect(logger.getCorrelationId()).toBeNull();
    });

    it('should add operation to breadcrumbs', () => {
      logger.startOperation('Important Op');
      logger.endOperation(false);

      const crumbs = logger.getBreadcrumbs();

      expect(crumbs.some(c => c.message.includes('Started: Important Op'))).toBe(true);
      expect(crumbs.some(c => c.message.includes('Ended: failure'))).toBe(true);
    });
  });
});
