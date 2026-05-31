#!/usr/bin/env node
// davinci-mcp-fat MCP server — phase 1.
//
// Speaks HTTP/JSON to the WI plugin's localhost server (default :9087)
// and exposes the result as MCP tools.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PluginBridge } from "./bridge.js";

const PORT = Number(process.env.DAVINCI_MCP_FAT_PORT ?? 9087);
const bridge = new PluginBridge({ port: PORT });

const server = new Server(
  { name: "davinci-mcp-fat", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "bridge_status",
    description: "Returns the WI plugin's status (resolve_bound, version, available commands). Call this first if anything else fails.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ping",
    description: "Round-trip ping into the WI plugin running inside Resolve. Returns {pong, version, ts}.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "resolve_info",
    description: "DaVinci Resolve product_name, version, and currently-open page (edit/cut/color/fusion/fairlight/deliver).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "timeline_info",
    description: "Name, start_frame, end_frame, video track count, and audio track count of the current timeline.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_clip_volume_db",
    description: "[phase 2 — placeholder] Set a timeline item's audio volume in dB. The standalone scripting API blocks this; the WI plugin will reach Resolve's in-process inspector surface.",
    inputSchema: {
      type: "object",
      properties: {
        track_index: { type: "number" },
        item_index: { type: "number" },
        db: { type: "number" },
      },
      required: ["track_index", "item_index", "db"],
      additionalProperties: false,
    },
  },
  {
    name: "add_video_transition",
    description: "[phase 3 — placeholder] Add a video transition (e.g. Cross Dissolve) at a cut point. Routes to the AppleScript bridge.",
    inputSchema: {
      type: "object",
      properties: {
        track_index: { type: "number" },
        item_index: { type: "number" },
        transition_name: { type: "string" },
        duration_frames: { type: "number" },
        alignment: { type: "string", enum: ["start", "center", "end"], default: "center" },
      },
      required: ["track_index", "item_index"],
      additionalProperties: false,
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "bridge_status") {
      const reachable = await bridge.isReachable();
      if (!reachable) {
        return {
          content: [{
            type: "text", text: JSON.stringify({
              reachable: false,
              hint: `plugin not reachable on http://127.0.0.1:${PORT}. Open Resolve → Workspace → Workflow Integrations → davinci-mcp-fat`,
            }, null, 2),
          }],
        };
      }
      const s = await bridge.status();
      return { content: [{ type: "text", text: JSON.stringify({ reachable: true, ...s }, null, 2) }] };
    }

    const commandMap: Record<string, string> = {
      ping: "ping",
      resolve_info: "resolve_info",
      timeline_info: "timeline_info",
      set_clip_volume_db: "set_clip_volume_db",
      add_video_transition: "add_video_transition",
    };
    const command = commandMap[name];
    if (!command) {
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    const result = await bridge.command(command, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: String((e as Error).message) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[davinci-mcp-fat] mcp server up; talking to plugin on http://127.0.0.1:${PORT}\n`);
