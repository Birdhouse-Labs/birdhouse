#!/usr/bin/env bash
# ABOUTME: Public install script for Birdhouse CLI
# ABOUTME: Downloads the latest release from GitHub and installs to ~/.birdhouse/
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/birdhouselabs/birdhouse/main/install.sh | bash
#   install.sh                        # fetch latest release from GitHub
#   install.sh /path/to/tarball.tar.gz  # install from a local tarball (skips download + checksum)

set -euo pipefail

REPO="birdhouse-labs/birdhouse"
INSTALL_DIR="$HOME/.birdhouse"
BIN_DIR="$HOME/.birdhouse/bin"
BINARY_NAME="birdhouse"
LOCAL_TARBALL="${1:-}"

# ---------------------------------------------------------------------------
# Color helpers (only when stdout is a tty)
# ---------------------------------------------------------------------------

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED=''
  GREEN=''
  DIM=''
  RESET=''
fi

error() {
  printf "${RED}error:${RESET} %s\n" "$1" >&2
  exit 1
}

info() {
  printf "${DIM}%s${RESET}\n" "$1"
}

success() {
  printf "${GREEN}%s${RESET}\n" "$1"
}

# ---------------------------------------------------------------------------
# Temp dir cleanup
# ---------------------------------------------------------------------------

TMPDIR_WORK=""

cleanup() {
  if [ -n "$TMPDIR_WORK" ] && [ -d "$TMPDIR_WORK" ]; then
    rm -rf "$TMPDIR_WORK"
  fi
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Platform check
# ---------------------------------------------------------------------------

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Darwin" ]; then
  error "Birdhouse currently only supports macOS. Detected OS: $OS"
fi

case "$ARCH" in
  arm64)
    ARCH_SUFFIX="arm64"
    ;;
  x86_64)
    ARCH_SUFFIX="x64"
    ;;
  *)
    error "Unsupported architecture: $ARCH. Birdhouse supports macOS on arm64 and x86_64."
    ;;
esac

# ---------------------------------------------------------------------------
# Resolve tarball — either local or download from GitHub
# ---------------------------------------------------------------------------

TMPDIR_WORK="$(mktemp -d)"
TARBALL_NAME="birdhouse-darwin-${ARCH_SUFFIX}.tar.gz"

if [ -n "$LOCAL_TARBALL" ]; then
  # Local mode: used by install-cli.sh during development
  [ -f "$LOCAL_TARBALL" ] || error "Local tarball not found: $LOCAL_TARBALL"
  TARBALL_PATH="$(cd "$(dirname "$LOCAL_TARBALL")" && pwd)/$(basename "$LOCAL_TARBALL")"
  TAG="local"
  info "Installing from local tarball: $TARBALL_PATH"
else
  # Remote mode: fetch latest release from GitHub
  info "Fetching latest release..."

  TAG="$(curl --fail --location --silent \
    "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

  [ -n "$TAG" ] || error "Could not determine latest release tag from GitHub API."

  info "Latest release: $TAG"

  BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

  info "Downloading $TARBALL_NAME..."
  curl --fail --location --progress-bar \
    "${BASE_URL}/${TARBALL_NAME}" \
    --output "${TMPDIR_WORK}/${TARBALL_NAME}"

  info "Downloading checksums.txt..."
  curl --fail --location --progress-bar \
    "${BASE_URL}/checksums.txt" \
    --output "${TMPDIR_WORK}/checksums.txt"

  info "Verifying checksum..."
  if ! (cd "$TMPDIR_WORK" && grep "$TARBALL_NAME" checksums.txt | shasum -a 256 --check --status); then
    error "Checksum verification failed for $TARBALL_NAME."
  fi
  success "Checksum verified."

  TARBALL_PATH="${TMPDIR_WORK}/${TARBALL_NAME}"
fi

# ---------------------------------------------------------------------------
# Analytics
#
# Hey — if you're reading this, you're exactly the kind of person we built
# Birdhouse for. Thanks for taking the time to look.
#
# On install, we send one anonymous ping: your OS architecture and the version
# you just installed. No IP address, no machine ID, nothing personal.
# It helps us know Birdhouse is actually being used, which helps us keep
# building it.
# ---------------------------------------------------------------------------

POSTHOG_KEY="phc_LwyUqyfUjlP28aI98eE2K7jA6mdTboPZYRuKotWsoYI"
SUPABASE_URL="https://hzqxwcbohrtxyvmmamsn.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_qNuDf5Rh9PIh1hUvWT2GWA_PHi8V_QF"

send_analytics() {
  local distinct_id="$1" tag="$2" arch="$3"

  curl --silent --max-time 5 --output /dev/null \
    -X POST "https://us.i.posthog.com/i/v0/e" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\":\"$POSTHOG_KEY\",\"event\":\"install\",\"distinct_id\":\"$distinct_id\",\"properties\":{\"version\":\"$tag\",\"arch\":\"$arch\"}}" \
    &

  curl --silent --max-time 5 --output /dev/null \
    -X POST "$SUPABASE_URL/rest/v1/telemetry_installs" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Prefer: return=minimal" \
    -d "{\"arch\":\"$arch\",\"version\":\"$tag\"}" \
    &
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

if [ -d "$INSTALL_DIR" ]; then
  info "Removing existing installation at $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"

info "Extracting to $INSTALL_DIR..."
tar -xzf "$TARBALL_PATH" -C "$INSTALL_DIR"

chmod +x "$INSTALL_DIR/bin/$BINARY_NAME"

# ---------------------------------------------------------------------------
# Add to PATH via shell profile
# ---------------------------------------------------------------------------

PATH_LINE="export PATH=\"\$HOME/.birdhouse/bin:\$PATH\""
ADDED_TO_PROFILE=false
PROFILE=""
REFRESH_CMD=""

case "$(basename "$SHELL")" in
  zsh)
    PROFILE="$HOME/.zshrc"
    if grep -q '.birdhouse/bin' "$PROFILE" 2>/dev/null; then
      ADDED_TO_PROFILE=true
    elif [ -w "$PROFILE" ]; then
      printf '\n# birdhouse\n%s\n' "$PATH_LINE" >> "$PROFILE"
      ADDED_TO_PROFILE=true
      REFRESH_CMD="source $PROFILE"
    fi
    ;;
  bash)
    for PROFILE in "$HOME/.bash_profile" "$HOME/.bashrc"; do
      if grep -q '.birdhouse/bin' "$PROFILE" 2>/dev/null; then
        ADDED_TO_PROFILE=true
        break
      elif [ -w "$PROFILE" ]; then
        printf '\n# birdhouse\n%s\n' "$PATH_LINE" >> "$PROFILE"
        ADDED_TO_PROFILE=true
        REFRESH_CMD="source $PROFILE"
        break
      fi
    done
    ;;
  fish)
    PROFILE="$HOME/.config/fish/config.fish"
    FISH_LINE="set --export PATH \"\$HOME/.birdhouse/bin\" \$PATH"
    if grep -q '.birdhouse/bin' "$PROFILE" 2>/dev/null; then
      ADDED_TO_PROFILE=true
    elif [ -w "$PROFILE" ]; then
      printf '\n# birdhouse\n%s\n' "$FISH_LINE" >> "$PROFILE"
      ADDED_TO_PROFILE=true
      REFRESH_CMD="source $PROFILE"
    fi
    ;;
esac

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

printf "\n"
success "Birdhouse $TAG installed to $BIN_DIR"
printf "\n"

ANALYTICS_DISTINCT_ID="install-script"
if [ -n "$LOCAL_TARBALL" ]; then
  ANALYTICS_DISTINCT_ID="local-tarball"
fi
send_analytics "$ANALYTICS_DISTINCT_ID" "$TAG" "$ARCH_SUFFIX"

if [ "$ADDED_TO_PROFILE" = true ]; then
  info "Added $BIN_DIR to PATH in $PROFILE"
  if [ -n "$REFRESH_CMD" ]; then
    info "To use birdhouse now, run: $REFRESH_CMD"
  fi
else
  info "Manually add this to your shell profile:"
  printf "\n"
  printf "  %s\n" "$PATH_LINE"
fi

printf "\n"
info "Then run \`birdhouse ui\` in any project directory to get started."
printf "\n"
