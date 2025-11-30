/**
 * Unit Tests for Input Validators
 * Validates: Requirements 6.2
 */

const { validateEmail, validateDateRange, validateEnum } = require('../../src/utils/validators');

describe('Input Validators', () => {
  describe('validateEmail', () => {
    test('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'admin+tag@hotel.com',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.field).toBe('email');
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        ''
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.field).toBe('email');
      });
    });

    test('should reject null or undefined email', () => {
      expect(validateEmail(null).valid).toBe(false);
      expect(validateEmail(undefined).valid).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    test('should accept valid date ranges where check-out is after check-in', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-05');

      const result = validateDateRange(checkIn, checkOut);
      expect(result.valid).toBe(true);
    });

    test('should accept date strings as input', () => {
      const result = validateDateRange('2024-01-01', '2024-01-05');
      expect(result.valid).toBe(true);
    });

    test('should reject when check-out is before check-in', () => {
      const checkIn = new Date('2024-01-05');
      const checkOut = new Date('2024-01-01');

      const result = validateDateRange(checkIn, checkOut);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('after');
    });

    test('should reject when check-out equals check-in', () => {
      const checkIn = new Date('2024-01-01');
      const checkOut = new Date('2024-01-01');

      const result = validateDateRange(checkIn, checkOut);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('after');
    });

    test('should reject invalid date strings', () => {
      const result1 = validateDateRange('invalid-date', '2024-01-05');
      expect(result1.valid).toBe(false);
      expect(result1.field).toBe('check_in_date');

      const result2 = validateDateRange('2024-01-01', 'invalid-date');
      expect(result2.valid).toBe(false);
      expect(result2.field).toBe('check_out_date');
    });
  });

  describe('validateEnum', () => {
    test('should accept valid enum values', () => {
      const allowedRoles = ['admin', 'staff', 'client'];
      
      allowedRoles.forEach(role => {
        const result = validateEnum(role, allowedRoles, 'role');
        expect(result.valid).toBe(true);
        expect(result.field).toBe('role');
      });
    });

    test('should reject invalid enum values', () => {
      const allowedRoles = ['admin', 'staff', 'client'];
      const result = validateEnum('superuser', allowedRoles, 'role');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
      expect(result.field).toBe('role');
    });

    test('should reject empty or null values', () => {
      const allowedStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];
      
      expect(validateEnum('', allowedStatuses, 'status').valid).toBe(false);
      expect(validateEnum(null, allowedStatuses, 'status').valid).toBe(false);
      expect(validateEnum(undefined, allowedStatuses, 'status').valid).toBe(false);
    });

    test('should use provided field name in error messages', () => {
      const result = validateEnum('invalid', ['valid1', 'valid2'], 'customField');
      
      expect(result.valid).toBe(false);
      expect(result.field).toBe('customField');
      expect(result.error).toContain('customField');
    });
  });
});
