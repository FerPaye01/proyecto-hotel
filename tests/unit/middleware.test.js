// Set up environment variables before importing modules
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.PORT = '3000';

const { authenticateJWT } = require('../../src/middleware/auth');
const { requireRole, requireAnyRole } = require('../../src/middleware/rbac');
const { 
  errorHandler, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  ConflictError 
} = require('../../src/middleware/errorHandler');
const { generateToken } = require('../../src/utils/jwt');

describe('Authentication Middleware', () => {
  describe('authenticateJWT', () => {
    test('should authenticate valid token and attach user to request', async () => {
      const token = generateToken('user-123', 'client');
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await authenticateJWT(req, res, next);

      expect(nextCalled).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(req.user.role).toBe('client');
    });

    test('should reject request with missing authorization header', async () => {
      const req = { headers: {} };
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await authenticateJWT(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseBody.error).toBe('AUTHENTICATION_ERROR');
    });

    test('should reject request with invalid token format', async () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token123'
        }
      };
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await authenticateJWT(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseBody.error).toBe('AUTHENTICATION_ERROR');
    });

    test('should reject request with invalid token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token.here'
        }
      };
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await authenticateJWT(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseBody.error).toBe('AUTHENTICATION_ERROR');
    });
  });
});

describe('RBAC Middleware', () => {
  describe('requireRole', () => {
    test('should allow user with correct role', () => {
      const req = {
        user: { id: 'user-123', role: 'admin' }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(nextCalled).toBe(true);
    });

    test('should reject user with incorrect role', () => {
      const req = {
        user: { id: 'user-123', role: 'client' }
      };
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseBody.error).toBe('AUTHORIZATION_ERROR');
    });

    test('should reject unauthenticated request', () => {
      const req = {};
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseBody.error).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('requireAnyRole', () => {
    test('should allow user with one of allowed roles', () => {
      const req = {
        user: { id: 'user-123', role: 'staff' }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = requireAnyRole('admin', 'staff');
      middleware(req, res, next);

      expect(nextCalled).toBe(true);
    });

    test('should reject user without any allowed role', () => {
      const req = {
        user: { id: 'user-123', role: 'client' }
      };
      let statusCode = null;
      let responseBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (body) => {
          responseBody = body;
          return res;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const middleware = requireAnyRole('admin', 'staff');
      middleware(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseBody.error).toBe('AUTHORIZATION_ERROR');
    });
  });
});

describe('Error Handler Middleware', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('should handle ValidationError', () => {
    const err = new ValidationError('Invalid email format', 'email');
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(400);
    expect(responseBody.error).toBe('VALIDATION_ERROR');
    expect(responseBody.message).toBe('Invalid email format');
    expect(responseBody.field).toBe('email');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should handle AuthenticationError', () => {
    const err = new AuthenticationError('Invalid token');
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(401);
    expect(responseBody.error).toBe('AUTHENTICATION_ERROR');
    expect(responseBody.message).toBe('Invalid token');
  });

  test('should handle AuthorizationError', () => {
    const err = new AuthorizationError();
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(403);
    expect(responseBody.error).toBe('AUTHORIZATION_ERROR');
    expect(responseBody.message).toBe('Insufficient permissions');
  });

  test('should handle ConflictError', () => {
    const err = new ConflictError('Booking conflict', { roomId: 101 });
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(409);
    expect(responseBody.error).toBe('CONFLICT_ERROR');
    expect(responseBody.message).toBe('Booking conflict');
    expect(responseBody.details).toEqual({ roomId: 101 });
  });

  test('should handle generic server errors', () => {
    const err = new Error('Something went wrong');
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(500);
    expect(responseBody.error).toBe('SERVER_ERROR');
  });

  test('should handle PostgreSQL unique constraint violations as conflicts', () => {
    const err = new Error('Constraint violation');
    err.code = '23505'; // Unique violation
    err.detail = 'Key (email)=(test@test.com) already exists';
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(409);
    expect(responseBody.error).toBe('CONFLICT_ERROR');
  });

  test('should handle other PostgreSQL constraint violations', () => {
    const err = new Error('Check constraint violation');
    err.code = '23514'; // Check constraint violation
    err.detail = 'Check constraint failed';
    const req = { path: '/test', method: 'POST' };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        responseBody = body;
        return res;
      }
    };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(statusCode).toBe(400);
    expect(responseBody.error).toBe('VALIDATION_ERROR');
  });
});
