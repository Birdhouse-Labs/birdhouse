// ABOUTME: Shared types for the generic read-only file viewer feature.
// ABOUTME: Defines the payload returned from the server and rendered in the viewer dialog.

export interface FileViewerFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isMarkdown: boolean;
}
