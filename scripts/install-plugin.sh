#!/usr/bin/env bash
# Installs the plugin/ folder of this repo into Resolve's Workflow Integration
# Plugins directory. Requires sudo on macOS because the dir lives under /Library.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/plugin"
PLUGIN_NAME="davinci-mcp-fat"

case "$(uname -s)" in
  Darwin)
    # System-wide path. Resolve does NOT read user-Library ~/Library — confirmed.
    DEST_ROOT="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
    SUDO="sudo"
    ;;
  Linux)
    # Linux Resolve uses a per-user path; sudo not required.
    DEST_ROOT="$HOME/.local/share/DaVinciResolve/Fusion/Workflow Integration Plugins"
    SUDO=""
    ;;
  *)
    echo "Unsupported OS. On Windows, copy plugin/ to:"
    echo "  %PROGRAMDATA%\\Blackmagic Design\\DaVinci Resolve\\Support\\Workflow Integration Plugins\\$PLUGIN_NAME"
    exit 1
    ;;
esac

DEST="$DEST_ROOT/$PLUGIN_NAME"

echo "Installing plugin"
echo "  src: $PLUGIN_SRC"
echo "  dst: $DEST"
echo ""

$SUDO mkdir -p "$DEST_ROOT"

if [ -e "$DEST" ] || [ -L "$DEST" ]; then
  echo "Removing existing install at $DEST"
  $SUDO rm -rf "$DEST"
fi

$SUDO cp -R "$PLUGIN_SRC" "$DEST"
echo "✓ installed"
echo ""
echo "Next:"
echo "  1. Resolve Preferences (⌘,) → System → General →"
echo "     set 'External scripting using' to Local, click Save."
echo "  2. ⌘Q to quit Resolve fully, then reopen."
echo "  3. Workspace → Workflow Integrations → davinci-mcp-fat"
echo ""
echo "  npm run start --prefix mcp-server   # starts the WS bridge"
