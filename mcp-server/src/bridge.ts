// bridge.ts — WebSocket hub linking the WI plugin and the MCP server.
// The plugin dials in (ws://127.0.0.1:9087/plugin). The MCP server (this
// process) hosts the WS server, sends command requests, and awaits responses.
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

export interface BridgeOptions {
  port: number;
  onPluginConnect?: () => void;
  onPluginDisconnect?: () => void;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class PluginBridge {
  private wss: WebSocketServer;
  private plugin: WebSocket | null = null;
  private pending = new Map<string, Pending>();

  constructor(private opts: BridgeOptions) {
    this.wss = new WebSocketServer({ port: opts.port, host: "127.0.0.1" });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req.url ?? ""));
  }

  private handleConnection(ws: WebSocket, url: string) {
    // Only one plugin connection at a time.
    if (this.plugin) {
      try { this.plugin.close(); } catch {}
    }
    this.plugin = ws;
    ws.on("message", (data) => this.onMessage(data.toString()));
    ws.on("close", () => {
      if (this.plugin === ws) {
        this.plugin = null;
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(new Error("plugin disconnected"));
        }
        this.pending.clear();
        this.opts.onPluginDisconnect?.();
      }
    });
    this.opts.onPluginConnect?.();
  }

  private onMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "hello") return;
    if (msg.type === "response") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error ?? "plugin error"));
    }
  }

  isPluginConnected(): boolean {
    return this.plugin !== null && this.plugin.readyState === WebSocket.OPEN;
  }

  /** Notify the plugin that an MCP client connected/disconnected. */
  notifyMcpStatus(connected: boolean) {
    if (!this.plugin || this.plugin.readyState !== WebSocket.OPEN) return;
    this.plugin.send(JSON.stringify({ type: connected ? "mcp_connected" : "mcp_disconnected" }));
  }

  /** Send a command to the plugin and await its response. */
  async request<T = unknown>(command: string, params?: unknown, timeoutMs = 8000): Promise<T> {
    if (!this.plugin || this.plugin.readyState !== WebSocket.OPEN) {
      throw new Error("plugin not connected — open Resolve → Workspace → Workflow Integrations → davinci-mcp-fat");
    }
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`plugin request timed out: ${command}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject, timer });
      this.plugin!.send(JSON.stringify({ type: "request", id, command, params: params ?? {} }));
    });
  }

  close() {
    this.wss.close();
    if (this.plugin) try { this.plugin.close(); } catch {}
  }
}
