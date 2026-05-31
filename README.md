# davinci-mcp-fat

A "fat" Model Context Protocol server for DaVinci Resolve that goes beyond what the standalone Blackmagic Scripting API exposes.

## Why

The official Blackmagic DaVinci Resolve Scripting API (Python/Lua) — and every MCP server that wraps it — leaves out essential operations that exist in the UI:

- Per-clip audio volume / pan
- Adding video & audio transitions on edit points
- Setting text on most Fusion Title templates
- Switching between Insert / Overwrite / Replace edit modes
- Moving titles & generators between tracks
- Drag-and-drop ergonomics for templates
- Live event subscriptions (timeline changes, playhead, selection)

This project closes those gaps by combining three layers:

```
Claude / any MCP client
       │
       │ stdio
       ▼
┌──────────────────────┐
│  MCP server (TS)     │  ← thin protocol layer
└──────────────────────┘
       │
       │ localhost:9000 WebSocket
       ▼
┌──────────────────────┐
│  Workflow Integration │  ← runs inside Resolve, in-process API access
│  plugin (JS)         │
└──────────────────────┘
       │
       ├─→ DaVinciResolveScript (same scripting API, in-process)
       ├─→ Resolve Inspector / UI surface (extra access)
       └─→ AppleScript bridge (for UI-only gestures)
```

The WI plugin gets us in-process access (clip volume, opacity keyframes, inspector fields, event hooks). The AppleScript bridge handles the truly UI-only stuff (drag-drop a template, add a Cross Dissolve on a cut). Together they cover ~95% of what a working editor does.

## Status

🚧 **Phase 1 — Scaffolding**

| Feature | Status |
|---|---|
| WI plugin loads in Resolve | 🚧 |
| WS bridge MCP ↔ plugin | 🚧 |
| Per-clip volume | ⏳ |
| Opacity keyframes (faux transitions) | ⏳ |
| AppleScript drag template | ⏳ |
| AppleScript add Cross Dissolve | ⏳ |

## Install

> Requires DaVinci Resolve **Studio 18+** on macOS. Free DaVinci Resolve doesn't ship the Workflow Integration runtime.

```bash
git clone git@github.com:DannyDesert/davinci-mcp-fat.git
cd davinci-mcp-fat
./scripts/install-plugin.sh   # copies plugin/ into Resolve's plugin dir (needs sudo on macOS)
npm install --prefix mcp-server
npm run build --prefix mcp-server
```

Plugin install path on macOS is **system-wide** (`/Library/...`, not `~/Library/...`).
Resolve does not scan the user-library path — verified empirically against
Resolve Studio 20.3.

Then launch Resolve and enable: **Workspace → Workflow Integrations → davinci-mcp-fat**.

Configure your MCP client to launch:
```bash
node /Users/<you>/Developer/davinci-mcp-fat/mcp-server/dist/index.js
```

## License

MIT
