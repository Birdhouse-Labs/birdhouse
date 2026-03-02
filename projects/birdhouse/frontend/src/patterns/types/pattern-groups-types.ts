// ABOUTME: UI-friendly pattern types for pattern-groups API consumers
// ABOUTME: Transformed from pattern-groups API types with camelCase and computed display fields

/**
 * Pattern metadata for UI consumption (pattern-groups version)
 * Dates are parsed to Date objects with pre-computed display strings
 */
export interface PatternGroupsMetadata {
  id: string;
  title: string;
  description?: string;
  triggerPhrases: string[];
  createdAt: Date;
  createdAtDisplay: string;
  updatedAt: Date;
  updatedAtDisplay: string;
}

/**
 * Full pattern with content for UI consumption (pattern-groups version)
 */
export interface PatternGroupsPattern extends PatternGroupsMetadata {
  groupId: string;
  prompt: string;
  readonly: boolean;
}
