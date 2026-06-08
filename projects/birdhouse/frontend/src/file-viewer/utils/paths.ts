// ABOUTME: Path helpers for file viewer consumers that need an absolute file path.
// ABOUTME: Resolves a sibling file path from a known file location and a relative child path.

export function resolveSiblingFilePath(baseFilePath: string, relativeFilePath: string): string {
  const lastSlashIndex = Math.max(baseFilePath.lastIndexOf("/"), baseFilePath.lastIndexOf("\\"));
  const separator = baseFilePath.includes("\\") ? "\\" : "/";
  const baseDirectory = lastSlashIndex >= 0 ? baseFilePath.slice(0, lastSlashIndex) : baseFilePath;
  const normalizedRelativePath = separator === "\\" ? relativeFilePath.replaceAll("/", "\\") : relativeFilePath;
  return `${baseDirectory}${separator}${normalizedRelativePath}`;
}

export function getFileNameFromPath(filePath: string): string {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const parts = normalizedPath.split("/").filter((part) => part.length > 0);
  return parts.at(-1) ?? filePath;
}

export function resolveWorkspaceFilePath(workspaceDirectory: string, filePath: string): string {
  if (filePath.startsWith("/")) {
    return filePath;
  }

  const normalizedWorkspaceDirectory = workspaceDirectory.endsWith("/")
    ? workspaceDirectory.slice(0, -1)
    : workspaceDirectory;
  const workspaceBase = `${normalizedWorkspaceDirectory}/`;
  const resolvedPath = decodeURIComponent(new URL(filePath, `file://${workspaceBase}`).pathname);

  if (resolvedPath === normalizedWorkspaceDirectory || resolvedPath.startsWith(`${normalizedWorkspaceDirectory}/`)) {
    return resolvedPath;
  }

  throw new Error("File path must stay within the workspace root");
}
