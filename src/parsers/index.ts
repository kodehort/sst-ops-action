/**
 * Parser module exports
 * Provides base parser infrastructure and utilities
 */

// Legacy base parser (for backward compatibility)
export * from './base-parser';
export {
  BaseParser,
  createParsedSection,
  type ParsedSection,
} from './base-parser';
// CLI operation parsers
export * from './deploy-parser';
export { DeployParser } from './deploy-parser';
export * from './diff-parser';
export { DiffParser } from './diff-parser';
export * from './input-processor';
export { InputProcessor, type ProcessingOptions } from './input-processor';
// Base parser infrastructure
export * from './operation-parser';
export { OperationParser } from './operation-parser';

export * from './remove-parser';
export { RemoveParser } from './remove-parser';
// Legacy stage parser (for backward compatibility)
export * from './stage-parser';
export { StageParser } from './stage-parser';
// Input-based processors
export * from './stage-processor';
export { type StageProcessingOptions, StageProcessor } from './stage-processor';
