/**
 * Simplified error handling exports
 * Centralized export point for error handling utilities
 */

export type {
  ActionError,
  ErrorType,
} from './categories';
export {
  createInputValidationError,
  createOutputParsingError,
  createSubprocessError,
  fromValidationError,
  handleError,
  isParsingError,
} from './error-handler';
