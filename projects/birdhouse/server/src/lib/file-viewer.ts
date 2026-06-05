// ABOUTME: Reads viewable text files, detects highlighting languages, and reveals files in the OS file manager.
// ABOUTME: Rejects invalid paths, directories, oversized files, and obvious binary content for the file viewer.

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname } from "node:path";

const MAX_FILE_VIEW_BYTES = 1024 * 1024;

const LANGUAGE_BY_FILENAME: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  html: "html",
  css: "css",
  scss: "scss",
  sql: "sql",
  xml: "xml",
  txt: "text",
  toml: "toml",
};

export interface ViewableFile {
  path: string;
  name: string;
  content: string;
  language: string;
  is_markdown: boolean;
}

export type ReadViewableFileErrorCode = "invalid_path" | "not_found" | "not_file" | "too_large" | "binary";

export class ReadViewableFileError extends Error {
  code: ReadViewableFileErrorCode;

  constructor(code: ReadViewableFileErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type SpawnLike = (
  command: string,
  args: string[],
  options: { detached: true; stdio: "ignore" },
) => Pick<ChildProcess, "unref">;

export function detectFileViewerLanguage(filePath: string): string {
  const filename = basename(filePath).toLowerCase();
  const extension = extname(filePath).slice(1).toLowerCase();

  return LANGUAGE_BY_FILENAME[filename] ?? LANGUAGE_BY_EXTENSION[extension] ?? "text";
}

export function readViewableFile(filePath: string): ViewableFile {
  if (!filePath || !filePath.startsWith("/")) {
    throw new ReadViewableFileError("invalid_path", "path must be an absolute file path");
  }

  if (!existsSync(filePath)) {
    throw new ReadViewableFileError("not_found", "File not found");
  }

  const fileStats = statSync(filePath);
  if (!fileStats.isFile()) {
    throw new ReadViewableFileError("not_file", "Only regular files can be viewed");
  }

  if (fileStats.size > MAX_FILE_VIEW_BYTES) {
    throw new ReadViewableFileError("too_large", `File exceeds ${MAX_FILE_VIEW_BYTES} byte limit`);
  }

  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) {
    throw new ReadViewableFileError("binary", "Only text files can be viewed");
  }

  const content = buffer.toString("utf-8");
  const language = detectFileViewerLanguage(filePath);

  return {
    path: filePath,
    name: basename(filePath),
    content,
    language,
    is_markdown: language === "markdown",
  };
}

export function revealFileInFileManager(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
  spawnProcess: SpawnLike = spawn,
): void {
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = ["-R", filePath];
  } else if (platform === "win32") {
    command = "explorer";
    args = ["/select,", filePath];
  } else {
    command = "xdg-open";
    args = [dirname(filePath)];
  }

  const child = spawnProcess(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
