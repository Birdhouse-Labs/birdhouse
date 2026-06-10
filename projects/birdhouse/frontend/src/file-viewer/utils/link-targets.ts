// ABOUTME: Parses markdown href targets that should open the shared local file viewer.
// ABOUTME: Normalizes file:// and plain local paths into the same file target shape.

export interface LocalFileLinkTarget {
  path: string;
  line: number | null;
}

function parseLineFragment(fragment: string | null): number | null {
  if (!fragment) {
    return null;
  }

  const match = fragment.match(/^L(\d+)$/i);
  if (!match) {
    return null;
  }

  const line = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(line) && line > 0 ? line : null;
}

function isPlainLocalPath(path: string): boolean {
  if (!path || path.startsWith("#") || path.startsWith("//")) {
    return false;
  }

  if (path.startsWith("/")) {
    return true;
  }

  return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path);
}

export function parseLocalFileLinkTarget(href: string): LocalFileLinkTarget | null {
  if (!href) {
    return null;
  }

  if (href.startsWith("file://")) {
    try {
      const url = new URL(href);
      const path = decodeURIComponent(url.pathname);
      if (!path.startsWith("/")) {
        return null;
      }

      return {
        path,
        line: parseLineFragment(url.hash ? url.hash.slice(1) : null),
      };
    } catch {
      return null;
    }
  }

  const [rawPath, rawFragment] = href.split("#", 2);
  let path: string;
  try {
    path = decodeURIComponent(rawPath ?? "");
  } catch {
    return null;
  }

  if (!isPlainLocalPath(path)) {
    return null;
  }

  return {
    path,
    line: parseLineFragment(rawFragment ?? null),
  };
}
