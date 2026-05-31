// bridge.ts — HTTP client that talks to the WI plugin's local HTTP server.
import http from "node:http";

export interface BridgeOptions {
  port: number;
  host?: string;
}

export class PluginBridge {
  private host: string;
  private port: number;

  constructor(opts: BridgeOptions) {
    this.host = opts.host ?? "127.0.0.1";
    this.port = opts.port;
  }

  private request<T = unknown>(path: string, method: string, body?: unknown, timeoutMs = 8000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          host: this.host,
          port: this.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let parsed: any;
            try { parsed = JSON.parse(text); }
            catch { return reject(new Error(`non-JSON response: ${text.slice(0, 200)}`)); }
            if (res.statusCode === 200) return resolve(parsed as T);
            reject(new Error(parsed?.error ?? `HTTP ${res.statusCode}`));
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async status(): Promise<{
    plugin_id: string; version: string; resolve_bound: boolean;
    last_request_at: number | null; commands: string[];
  }> {
    return this.request("/status", "GET");
  }

  async ping(): Promise<unknown> {
    const r = await this.request<{ ok: boolean; result?: unknown; error?: string }>(
      "/command", "POST", { command: "ping" });
    if (!r.ok) throw new Error(r.error ?? "command failed");
    return r.result;
  }

  async command<T = unknown>(name: string, params?: unknown): Promise<T> {
    const r = await this.request<{ ok: boolean; result?: T; error?: string }>(
      "/command", "POST", { command: name, params: params ?? {} });
    if (!r.ok) throw new Error(r.error ?? "command failed");
    return r.result as T;
  }

  async isReachable(): Promise<boolean> {
    try { await this.status(); return true; } catch { return false; }
  }
}
