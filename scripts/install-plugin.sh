#!/usr/bin/env bash
# Symlinks the plugin/ folder of this repo into Resolve's Workflow Integration
# Plugins directory so iterating on plugin code doesn't require copying files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/plugin"
PLUGIN_NAME="davinci-mcp-fat"

case "$(uname -s)" in
  Darwin)
    DEST_ROOT="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
    ;;
  Linux)
    DEST_ROOT="$HOME/.local/share/DaVinciResolve/Workflow Integration Plugins"
    ;;
  *)
    echo "Unsupported OS. On Windows, copy plugin/ to:"
    echo "  %APPDATA%\\Blackmagic Design\\DaVinci Resolve\\Support\\Workflow Integration Plugins\\$PLUGIN_NAME"
    exit 1
    ;;
esac

DEST="$DEST_ROOT/$PLUGIN_NAME"
mkdir -p "$DEST_ROOT"

if [ -L "$DEST" ]; then
  echo "Removing existing symlink: $DEST"
  rm "$DEST"
elif [ -e "$DEST" ]; then
  echo "ERROR: $DEST exists and is not a symlink. Refusing to overwrite."
  echo "Move or delete it manually, then re-run."
  exit 1
fi

ln -s "$PLUGIN_SRC" "$DEST"
echo "✓ symlinked"
echo "    $PLUGIN_SRC"
echo "  → $DEST"
echo ""
echo "Next steps:"
echo "  1. Quit and reopen DaVinci Resolve"
echo "  2. In Resolve: Workspace → Workflow Integrations → davinci-mcp-fat"
echo "  3. A floating panel will open. The 'WebSocket server' row should say 'connected :9087'"
echo "     once you start the MCP server (npm run start --prefix mcp-server)."
