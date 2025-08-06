/**
 * Error handling exports
 * Centralized export point for error handling utilities
 */

export {
  type ActionError,
  ERROR_PATTERNS,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from './categories';
export { ErrorHandler } from './error-handler';
