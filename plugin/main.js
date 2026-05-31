// davinci-mcp-fat — Workflow Integration plugin
// Runs inside Resolve, exposes a WebSocket the MCP server talks to.

const PORT = 9087;
const VERSION = "0.1.0";

function log(msg, cls = "") {
  const el = document.getElementById("log");
  if (!el) return;
  const line = document.createElement("div");
  line.className = "line " + cls;
  const ts = new Date().toTimeString().slice(0, 8);
  line.textContent = `[${ts}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setStatus(id, text, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "val " + (ok === true ? "ok" : ok === false ? "err" : "");
}

// Resolve injects `WorkflowIntegration` (legacy) and / or `bmd` globals.
// The actual scripting API surface lives behind `app` or a fetch helper.
// We try common ones.
function getResolve() {
  if (typeof bmd !== "undefined" && bmd && bmd.scriptapp) {
    return bmd.scriptapp("Resolve");
  }
  if (typeof WorkflowIntegration !== "undefined" && WorkflowIntegration && WorkflowIntegration.GetResolve) {
    return WorkflowIntegration.GetResolve();
  }
  return null;
}

const resolve = getResolve();
if (resolve) {
  setStatus("api", "✓ connected", true);
  log("Resolve API bound");
} else {
  setStatus("api", "not found", false);
  log("Resolve API global not found (running outside Resolve?)", "err");
}

// ─── Command dispatch ──────────────────────────────────────────────
// Each command receives (params) → returns plain JSON. Errors throw.
const commands = {
  ping: async () => ({ pong: true, version: VERSION, ts: Date.now() }),

  get_resolve_info: async () => {
    if (!resolve) throw new Error("Resolve API unavailable");
    return {
      product_name: resolve.GetProductName?.() ?? null,
      version: resolve.GetVersionString?.() ?? null,
      current_page: resolve.GetCurrentPage?.() ?? null,
    };
  },

  get_timeline_info: async () => {
    if (!resolve) throw new Error("Resolve API unavailable");
    const pm = resolve.GetProjectManager?.();
    const project = pm?.GetCurrentProject?.();
    const tl = project?.GetCurrentTimeline?.();
    if (!tl) return { timeline: null };
    return {
      name: tl.GetName?.(),
      start_frame: tl.GetStartFrame?.(),
      end_frame: tl.GetEndFrame?.(),
      v_tracks: tl.GetTrackCount?.("video"),
      a_tracks: tl.GetTrackCount?.("audio"),
    };
  },

  // === Things the standalone API can't do — phase 1 stubs ===
  set_clip_volume_db: async (_params) => {
    // params: { track_index, item_index, db }
    // TODO: reach into Resolve's Inspector surface; the in-process WI plugin
    // can access properties the external scripting API hides.
    throw new Error("not_implemented: set_clip_volume_db (phase 1)");
  },

  add_video_transition: async (_params) => {
    // params: { track_index, item_index, transition_name, duration_frames, alignment }
    // TODO: dispatch to AppleScript bridge for UI-only operation.
    throw new Error("not_implemented: add_video_transition (phase 1)");
  },
};

// ─── WebSocket server ──────────────────────────────────────────────
// In a browser context we cannot create a TCP server; we open a WS client
// to the MCP server's bridge port instead. The MCP server runs a tiny WS
// hub that any side can dial.
let ws = null;
let retryTimer = null;

function connect() {
  setStatus("ws", `dial ws://127.0.0.1:${PORT}/plugin`);
  try {
    ws = new WebSocket(`ws://127.0.0.1:${PORT}/plugin`);
  } catch (e) {
    log("ws construct failed: " + e.message, "err");
    schedule();
    return;
  }
  ws.onopen = () => {
    setStatus("ws", `connected :${PORT}`, true);
    log("ws open");
    ws.send(JSON.stringify({ type: "hello", role: "plugin", version: VERSION }));
  };
  ws.onclose = () => {
    setStatus("ws", "disconnected", false);
    setStatus("mcp", "waiting", null);
    log("ws closed");
    schedule();
  };
  ws.onerror = (e) => log("ws error", "err");
  ws.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === "mcp_connected") {
      setStatus("mcp", "✓ connected", true);
      log("mcp client connected via bridge");
      return;
    }
    if (msg.type === "mcp_disconnected") {
      setStatus("mcp", "waiting", null);
      log("mcp client disconnected");
      return;
    }
    if (msg.type === "request") {
      const { id, command, params } = msg;
      const fn = commands[command];
      if (!fn) {
        ws.send(JSON.stringify({ type: "response", id, ok: false, error: "unknown command: " + command }));
        return;
      }
      try {
        const result = await fn(params || {});
        ws.send(JSON.stringify({ type: "response", id, ok: true, result }));
      } catch (e) {
        ws.send(JSON.stringify({ type: "response", id, ok: false, error: String(e.message || e) }));
      }
    }
  };
}

function schedule() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, 2500);
}

connect();
