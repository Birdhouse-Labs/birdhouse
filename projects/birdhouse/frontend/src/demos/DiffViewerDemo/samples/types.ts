// ABOUTME: Type definitions for diff samples
// ABOUTME: Shared interface used by all diff sample files

export interface DiffSample {
  id: string;
  name: string;
  filePath: string; // File path for syntax highlighting
  before: string; // Content before edit
  after: string; // Content after edit
  description: string;
}
