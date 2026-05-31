# Phase plan

## Phase 1 — Scaffold (this commit)

- [x] WI plugin manifest + main.html + main.js with status panel
- [x] WS bridge between plugin and MCP server (auto-reconnect)
- [x] MCP server (TS) with tool catalog skeleton
- [x] `bridge_status`, `ping`, `resolve_info`, `timeline_info` tools
- [x] `install-plugin.sh` symlink script
- [x] README, LICENSE, .gitignore
- [ ] Verify plugin loads in real Resolve session
- [ ] Verify MCP↔plugin round trip works end-to-end

## Phase 2 — Gap-closing features

Things the standalone BMD API blocks that the in-process plugin can do:

- [ ] `set_clip_volume_db(track_index, item_index, db)` — via plugin's access to Resolve's audio inspector
- [ ] `set_clip_pan(...)`
- [ ] `set_clip_opacity_keyframes([{frame, opacity}])` — enables faux fade-transitions without UI
- [ ] `subscribe_timeline_events()` — push events to MCP clients on playhead/selection/timeline change

## Phase 3 — AppleScript / accessibility bridge (macOS-only)

Things even the in-process plugin can't do — UI gestures:

- [ ] `add_video_transition(track, item, name, duration, alignment)` — drives Effects panel drag → cut point
- [ ] `apply_title_template_to_v2(template_name, frame_position, duration, text)` — drag from Effects panel onto V2
- [ ] `set_inspector_field(field_name, value)` — for inspector fields not exposed in scripting
- [ ] `keyboard_shortcut(combo)` — generic UI driver

The AppleScript bridge runs as a child process spawned by the MCP server; it
returns OK/error and the MCP server reports success to the client.

## Phase 4 — Polish & ship

- [ ] Brew formula / npm install one-liner
- [ ] Demo video (record a Claude session driving Resolve end-to-end)
- [ ] CI: lint TS, smoke-test plugin file structure
- [ ] License headers, contributor guide
- [ ] Initial release tag v0.2.0
