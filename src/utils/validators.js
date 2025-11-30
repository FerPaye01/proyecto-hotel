/**
 * Input Validation Utilities Module
 * Provides validation functions for common input types
 * Validates: Requirements 6.2, 5.3
 */

/**
 * Validate an email address format
 * @param {string} email - The email address to validate
 * @returns {object} { valid: boolean, error?: string, field: string }
 */
function validateEmail(email) {
  const field = 'email';
  
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email is required',
      field
    };
  }

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Invalid email format',
      field
    };
  }

  return { valid: true, field };
}

/**
 * Validate a date range (check-in and check-out dates)
 * @param {Date|string} checkInDate - The check-in date
 * @param {Date|string} checkOutDate - The check-out date
 * @returns {object} { valid: boolean, error?: string, field: string }
 */
function validateDateRange(checkInDate, checkOutDate) {
  const field = 'dateRange';

  // Convert to Date objects if strings
  const checkIn = checkInDate instanceof Date ? checkInDate : new Date(checkInDate);
  const checkOut = checkOutDate instanceof Date ? checkOutDate : new Date(checkOutDate);

  // Check if dates are valid
  if (isNaN(checkIn.getTime())) {
    return {
      valid: false,
      error: 'Invalid check-in date',
      field: 'check_in_date'
    };
  }

  if (isNaN(checkOut.getTime())) {
    return {
      valid: false,
      error: 'Invalid check-out date',
      field: 'check_out_date'
    };
  }

  // Check if check-out is after check-in
  if (checkOut <= checkIn) {
    return {
      valid: false,
      error: 'Check-out date must be after check-in date',
      field
    };
  }

  return { valid: true, field };
}

/**
 * Validate that a value is one of the allowed enum values
 * @param {string} value - The value to validate
 * @param {string[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field being validated
 * @returns {object} { valid: boolean, error?: string, field: string }
 */
function validateEnum(value, allowedValues, fieldName = 'field') {
  if (!value) {
    return {
      valid: false,
      error: `${fieldName} is required`,
      field: fieldName
    };
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      field: fieldName
    };
  }

  return { valid: true, field: fieldName };
}

module.exports = {
  validateEmail,
  validateDateRange,
  validateEnum
};
