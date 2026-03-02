// ABOUTME: Type definitions for code samples
// ABOUTME: Shared interface used by all sample files

export interface CodeSample {
  id: string;
  name: string;
  language: string; // Shiki syntax highlighter language ID
  code: string;
  description: string;
}
