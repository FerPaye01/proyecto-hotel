const fc = require('fast-check');
const { requireRole, requireAnyRole } = require('../../src/middleware/rbac');

// **Feature: hotel-management-refactor, Property 8: Role-based access control enforcement**
// **Validates: Requirements 4.5, 5.5, 6.5**

describe('Property 8: Role-based access control enforcement', () => {
  test('requireRole rejects users without required role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('admin', 'staff', 'client'),
        fc.constantFrom('admin', 'staff', 'client'),
        async (userRole, requiredRole) => {
          // Create mock request, response, and next
          const req = {
            user: {
              id: 'test-user-id',
              role: userRole
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
          const next = () => {
            nextCalled = true;
          };

          // Execute middleware
          const middleware = requireRole(requiredRole);
          middleware(req, res, next);

          // Property: If user role matches required role, next() is called
          // If user role doesn't match, 403 error is returned
          if (userRole === requiredRole) {
            expect(nextCalled).toBe(true);
            expect(statusCode).toBeNull();
          } else {
            expect(nextCalled).toBe(false);
            expect(statusCode).toBe(403);
            expect(responseBody).toEqual({
              error: 'AUTHORIZATION_ERROR',
              message: 'Insufficient permissions'
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('requireRole rejects unauthenticated requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('admin', 'staff', 'client'),
        async (requiredRole) => {
          // Create mock request without user
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
          const next = () => {
            nextCalled = true;
          };

          // Execute middleware
          const middleware = requireRole(requiredRole);
          middleware(req, res, next);

          // Property: Unauthenticated requests always return 401
          expect(nextCalled).toBe(false);
          expect(statusCode).toBe(401);
          expect(responseBody).toEqual({
            error: 'AUTHENTICATION_ERROR',
            message: 'Authentication required'
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('requireAnyRole allows users with any of the allowed roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('admin', 'staff', 'client'),
        fc.subarray(['admin', 'staff', 'client'], { minLength: 1, maxLength: 3 }),
        async (userRole, allowedRoles) => {
          // Create mock request
          const req = {
            user: {
              id: 'test-user-id',
              role: userRole
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
          const next = () => {
            nextCalled = true;
          };

          // Execute middleware
          const middleware = requireAnyRole(...allowedRoles);
          middleware(req, res, next);

          // Property: If user role is in allowed roles, next() is called
          // Otherwise, 403 error is returned
          if (allowedRoles.includes(userRole)) {
            expect(nextCalled).toBe(true);
            expect(statusCode).toBeNull();
          } else {
            expect(nextCalled).toBe(false);
            expect(statusCode).toBe(403);
            expect(responseBody).toEqual({
              error: 'AUTHORIZATION_ERROR',
              message: 'Insufficient permissions'
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
