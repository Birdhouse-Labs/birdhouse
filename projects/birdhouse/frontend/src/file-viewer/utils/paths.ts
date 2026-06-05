// ABOUTME: Path helpers for file viewer consumers that need an absolute file path.
// ABOUTME: Resolves a sibling file path from a known file location and a relative child path.

export function resolveSiblingFilePath(baseFilePath: string, relativeFilePath: string): string {
  const lastSlashIndex = Math.max(baseFilePath.lastIndexOf("/"), baseFilePath.lastIndexOf("\\"));
  const separator = baseFilePath.includes("\\") ? "\\" : "/";
  const baseDirectory = lastSlashIndex >= 0 ? baseFilePath.slice(0, lastSlashIndex) : baseFilePath;
  const normalizedRelativePath = separator === "\\" ? relativeFilePath.replaceAll("/", "\\") : relativeFilePath;
  return `${baseDirectory}${separator}${normalizedRelativePath}`;
}
