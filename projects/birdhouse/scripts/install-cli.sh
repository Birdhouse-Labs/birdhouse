#!/bin/bash
# ABOUTME: Local dev install script - builds tarball from cli-dist and runs install.sh
# ABOUTME: Exercises the exact same install path customers use, just with a local tarball

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIST="$(cd "$SCRIPT_DIR/../cli-dist" && pwd)"
INSTALL_SH="$(cd "$SCRIPT_DIR/../../.." && pwd)/install.sh"
ARCH="$(uname -m)"

case "$ARCH" in
  arm64)   ARCH_SUFFIX="arm64" ;;
  x86_64)  ARCH_SUFFIX="x64" ;;
  *)        echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

TARBALL="$CLI_DIST/../birdhouse-darwin-${ARCH_SUFFIX}.tar.gz"

echo "Packaging tarball for $ARCH_SUFFIX..."
cd "$CLI_DIST"
tar -czf "$TARBALL" \
  bin/birdhouse \
  "dist/birdhouse-darwin-${ARCH_SUFFIX}" \
  "dist/server-darwin-${ARCH_SUFFIX}" \
  "dist/opencode/darwin-${ARCH_SUFFIX}" \
  dist/frontend \
  version.json

echo "Running install.sh with local tarball..."
bash "$INSTALL_SH" "$TARBALL"
