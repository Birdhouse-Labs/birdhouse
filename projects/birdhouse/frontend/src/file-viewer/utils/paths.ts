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

function normalizeWorkspaceDirectory(workspaceDirectory: string): string {
  const slashNormalizedWorkspaceDirectory = workspaceDirectory.replaceAll("\\", "/");
  if (/^[A-Za-z]:\/+$/i.test(slashNormalizedWorkspaceDirectory)) {
    return `/${slashNormalizedWorkspaceDirectory.slice(0, 2)}`;
  }

  const normalizedWorkspaceDirectory = slashNormalizedWorkspaceDirectory.replace(/\/+$/, "");

  return /^[A-Za-z]:\//.test(normalizedWorkspaceDirectory)
    ? `/${normalizedWorkspaceDirectory}`
    : normalizedWorkspaceDirectory;
}

function decodeFilePathname(pathname: string): string {
  const escapedLiteralPercents = pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");

  try {
    return decodeURIComponent(escapedLiteralPercents);
  } catch {
    return pathname;
  }
}

export function resolveWorkspaceFilePath(workspaceDirectory: string, filePath: string): string {
  if (filePath.startsWith("/")) {
    return filePath;
  }

  const normalizedWorkspaceDirectory = normalizeWorkspaceDirectory(workspaceDirectory);
  const resolvedPath = decodeFilePathname(new URL(filePath, `file://${normalizedWorkspaceDirectory}/`).pathname);

  if (resolvedPath === normalizedWorkspaceDirectory || resolvedPath.startsWith(`${normalizedWorkspaceDirectory}/`)) {
    return resolvedPath;
  }

  throw new Error("File path must stay within the workspace root");
}
