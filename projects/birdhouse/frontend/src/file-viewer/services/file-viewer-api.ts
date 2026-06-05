// ABOUTME: API client for loading file contents into the generic file viewer.
// ABOUTME: Keeps the backend contract stable while adapting snake_case fields into frontend types.

import { API_ENDPOINT_BASE } from "../../config/api";
import type { FileViewerFile } from "../types";

interface FileViewerResponse {
  path: string;
  name: string;
  content: string;
  language: string;
  is_markdown: boolean;
}

export async function fetchFileViewerContent(workspaceId: string, path: string): Promise<FileViewerFile> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/files/view?path=${encodeURIComponent(path)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load file: ${response.statusText} - ${text}`);
  }

  const data = (await response.json()) as FileViewerResponse;
  return {
    path: data.path,
    name: data.name,
    content: data.content,
    language: data.language,
    isMarkdown: data.is_markdown,
  };
}
