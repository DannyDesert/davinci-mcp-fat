# Phase plan

## ✅ Phase 1 — Scaffold (shipped v0.1.0, May 31 2026)

- [x] WI plugin manifest + Electron main.js + preload.js + index.html
- [x] Correct `<BlackmagicDesign><Plugin>` manifest schema
- [x] WorkflowIntegration.node native binding wired
- [x] HTTP server on 127.0.0.1:9087 (Node stdlib, zero runtime deps)
- [x] MCP server (TS) with HTTP bridge to plugin
- [x] Tools: `bridge_status`, `ping`, `resolve_info`, `timeline_info`
- [x] Plugin stays alive when window closes (hide-not-quit)
- [x] EADDRINUSE retry + status polling fallback
- [x] `install-plugin.sh` at the correct system-wide `/Library/...` path
- [x] **Verified end-to-end:** Claude MCP → TS server → HTTP → plugin → Resolve

## 🚧 Phase 2 — Gap-closing features

Things the standalone BMD scripting API blocks that the in-process plugin can do via the inspector / clip property surface:

- [ ] `set_clip_volume_db(track_index, item_index, db)`
- [ ] `set_clip_pan(...)`
- [ ] `set_clip_opacity_keyframes([{frame, opacity}])` — enables faux fade-transitions without UI
- [ ] `set_inspector_field(field, value)`
- [ ] `subscribe_timeline_events()` — push events to MCP clients on playhead/selection/timeline change

## 🚧 Phase 3 — AppleScript bridge (macOS-only)

Things even the in-process plugin can't do — UI gestures:

- [ ] `add_video_transition(track, item, name, duration, alignment)` — drag Effects panel → cut point
- [ ] `apply_title_template_to_v2(template, frame, duration, text)` — drag template onto V2
- [ ] `keyboard_shortcut(combo)` — generic UI driver

## 🚧 Phase 4 — Polish & ship

- [ ] Demo video (record a Claude session driving Resolve end-to-end)
- [ ] CI: lint TS, smoke-test plugin file structure
- [ ] Brew formula / npm install one-liner
- [ ] Docs site
- [ ] v0.2.0 release with the first phase-2 feature
