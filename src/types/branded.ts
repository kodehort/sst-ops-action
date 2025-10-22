/**
 * Branded Types for Enhanced Type Safety
 *
 * Provides compile-time type safety for critical string values throughout the application.
 * Branded types prevent accidental mixing of similar string types (e.g., stage names vs app names).
 *
 * Benefits:
 * - Prevents accidental string mixing at compile time
 * - Self-documenting code with clear intent
 * - No runtime cost (compiles to regular strings)
 * - Catch errors early in development
 */

/**
 * Brand symbol for creating unique types
 * This symbol ensures types cannot be accidentally compatible
 */
declare const __brand: unique symbol;

/**
 * Base branded type that adds a compile-time brand to a primitive type
 */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

/**
 * Stage name branded type
 * Ensures stage names are validated before use
 *
 * @example
 * ```typescript
 * const stage = StageName.create('production'); // ✓ OK
 * const invalid = 'production'; // ✗ Type error if used where StageName expected
 * ```
 */
export type StageName = Brand<string, 'StageName'>;

/**
 * Application name branded type
 * Ensures app names are validated and distinct from other strings
 */
export type AppName = Brand<string, 'AppName'>;

/**
 * Resource name branded type
 * Used for AWS resource identifiers
 */
export type ResourceName = Brand<string, 'ResourceName'>;

/**
 * Resource type branded type
 * Used for AWS resource types (e.g., "AWS::Lambda::Function")
 */
export type ResourceType = Brand<string, 'ResourceType'>;

/**
 * URL branded type
 * Ensures URLs are validated before use
 */
export type URL = Brand<string, 'URL'>;

/**
 * Git ref branded type
 * Used for Git references (branches, tags, commits)
 */
export type GitRef = Brand<string, 'GitRef'>;

/**
 * Validation error type for branded type creation
 */
export class BrandedTypeError extends Error {
  constructor(
    public readonly typeName: string,
    public readonly value: string,
    public readonly reason: string
  ) {
    super(`Invalid ${typeName}: ${reason} (value: "${value}")`);
    this.name = 'BrandedTypeError';
  }
}

/**
 * Stage name validation and creation utilities
 */
export const StageName = {
  /**
   * Create a validated stage name
   *
   * Validation rules:
   * - Cannot be empty
   * - Max 63 characters (AWS resource naming limit)
   * - Lowercase alphanumeric and hyphens only
   * - Cannot start or end with hyphen
   *
   * @param value Raw stage name string
   * @returns Validated StageName
   * @throws {BrandedTypeError} If validation fails
   */
  create(value: string): StageName {
    // Rule: Cannot be empty
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('StageName', value, 'cannot be empty');
    }

    const trimmed = value.trim();

    // Rule: Max 63 characters (AWS naming limit)
    if (trimmed.length > 63) {
      throw new BrandedTypeError(
        'StageName',
        value,
        `exceeds maximum length of 63 characters (got ${trimmed.length})`
      );
    }

    // Rule: Lowercase alphanumeric and hyphens only
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      throw new BrandedTypeError(
        'StageName',
        value,
        'must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Rule: Cannot start or end with hyphen
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      throw new BrandedTypeError(
        'StageName',
        value,
        'cannot start or end with a hyphen'
      );
    }

    return trimmed as StageName;
  },

  /**
   * Create a stage name without validation
   * Use only when you're certain the value is valid
   *
   * @param value Stage name string
   * @returns StageName without validation
   */
  unsafe(value: string): StageName {
    return value as StageName;
  },

  /**
   * Check if a string is a valid stage name without throwing
   *
   * @param value String to validate
   * @returns true if valid stage name
   */
  isValid(value: string): boolean {
    try {
      StageName.create(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Convert StageName back to regular string
   *
   * @param stageName Branded stage name
   * @returns Regular string
   */
  toString(stageName: StageName): string {
    return stageName as string;
  },
};

/**
 * Application name validation and creation utilities
 */
export const AppName = {
  /**
   * Create a validated application name
   *
   * @param value Raw app name string
   * @returns Validated AppName
   * @throws {BrandedTypeError} If validation fails
   */
  create(value: string): AppName {
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('AppName', value, 'cannot be empty');
    }

    const trimmed = value.trim();

    if (trimmed.length > 128) {
      throw new BrandedTypeError(
        'AppName',
        value,
        `exceeds maximum length of 128 characters (got ${trimmed.length})`
      );
    }

    return trimmed as AppName;
  },

  unsafe(value: string): AppName {
    return value as AppName;
  },

  isValid(value: string): boolean {
    try {
      AppName.create(value);
      return true;
    } catch {
      return false;
    }
  },

  toString(appName: AppName): string {
    return appName as string;
  },
};

/**
 * Resource name validation and creation utilities
 */
export const ResourceName = {
  create(value: string): ResourceName {
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('ResourceName', value, 'cannot be empty');
    }
    return value.trim() as ResourceName;
  },

  unsafe(value: string): ResourceName {
    return value as ResourceName;
  },

  toString(resourceName: ResourceName): string {
    return resourceName as string;
  },
};

/**
 * Resource type validation and creation utilities
 */
export const ResourceType = {
  /**
   * Create a validated resource type
   * Expects AWS resource type format (e.g., "AWS::Lambda::Function")
   */
  create(value: string): ResourceType {
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('ResourceType', value, 'cannot be empty');
    }

    const trimmed = value.trim();

    // Validate AWS resource type format (AWS::Service::Resource)
    if (!/^[A-Z][A-Za-z0-9]*::[A-Za-z0-9]+::[A-Za-z0-9]+$/.test(trimmed)) {
      throw new BrandedTypeError(
        'ResourceType',
        value,
        'must be in format "Provider::Service::Resource" (e.g., "AWS::Lambda::Function")'
      );
    }

    return trimmed as ResourceType;
  },

  unsafe(value: string): ResourceType {
    return value as ResourceType;
  },

  isValid(value: string): boolean {
    try {
      ResourceType.create(value);
      return true;
    } catch {
      return false;
    }
  },

  toString(resourceType: ResourceType): string {
    return resourceType as string;
  },
};

/**
 * URL validation and creation utilities
 */
export const URL = {
  /**
   * Create a validated URL
   */
  create(value: string): URL {
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('URL', value, 'cannot be empty');
    }

    const trimmed = value.trim();

    // Validate URL format
    if (!/^https?:\/\/.+/.test(trimmed)) {
      throw new BrandedTypeError(
        'URL',
        value,
        'must be a valid HTTP or HTTPS URL'
      );
    }

    return trimmed as URL;
  },

  unsafe(value: string): URL {
    return value as URL;
  },

  isValid(value: string): boolean {
    try {
      URL.create(value);
      return true;
    } catch {
      return false;
    }
  },

  toString(url: URL): string {
    return url as string;
  },
};

/**
 * Git ref validation and creation utilities
 */
export const GitRef = {
  create(value: string): GitRef {
    if (!value || value.trim() === '') {
      throw new BrandedTypeError('GitRef', value, 'cannot be empty');
    }
    return value.trim() as GitRef;
  },

  unsafe(value: string): GitRef {
    return value as GitRef;
  },

  toString(gitRef: GitRef): string {
    return gitRef as string;
  },
};

/**
 * Type guard to check if a value is a specific branded type
 * Note: This is a runtime check for TypeScript but helps with type narrowing
 */
export function isBrandedType<T extends Brand<string, string>>(
  value: unknown,
  validator: (v: string) => boolean
): value is T {
  return typeof value === 'string' && validator(value);
}

/**
 * Utility to extract the underlying string from any branded type
 */
export function unwrap<T extends Brand<string, string>>(branded: T): string {
  return branded as string;
}
