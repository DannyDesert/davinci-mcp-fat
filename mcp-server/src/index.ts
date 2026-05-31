#!/usr/bin/env node
// davinci-mcp-fat MCP server — phase 1 scaffold.
//
// Starts a WS bridge for the WI plugin to dial in, and exposes a small set
// of MCP tools that proxy through the bridge into Resolve.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PluginBridge } from "./bridge.js";

const PORT = Number(process.env.DAVINCI_MCP_FAT_PORT ?? 9087);

const bridge = new PluginBridge({
  port: PORT,
  onPluginConnect: () => {
    process.stderr.write(`[davinci-mcp-fat] plugin connected on :${PORT}\n`);
    bridge.notifyMcpStatus(true);
  },
  onPluginDisconnect: () => {
    process.stderr.write(`[davinci-mcp-fat] plugin disconnected\n`);
  },
});

const server = new Server(
  { name: "davinci-mcp-fat", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ─── tool catalog ─────────────────────────────────────────────────
const TOOLS = [
  {
    name: "bridge_status",
    description: "Returns whether the WI plugin is connected. Use this first if anything else times out.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ping",
    description: "Round-trip ping into the WI plugin. Returns {pong:true, version, ts}.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "resolve_info",
    description: "Product name, version, and currently-open Resolve page.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "timeline_info",
    description: "Name + start/end frame + track counts for the current timeline.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_clip_volume_db",
    description: "[phase 2] Set a timeline-item's volume in dB. Currently throws not_implemented.",
    inputSchema: {
      type: "object",
      properties: {
        track_index: { type: "number", description: "1-based audio track index" },
        item_index: { type: "number", description: "0-based item index within the track" },
        db: { type: "number", description: "Gain in dB, e.g. -18 for -18 dB" },
      },
      required: ["track_index", "item_index", "db"],
      additionalProperties: false,
    },
  },
  {
    name: "add_video_transition",
    description: "[phase 2] Add a video transition at a cut point. Routes to AppleScript bridge.",
    inputSchema: {
      type: "object",
      properties: {
        track_index: { type: "number" },
        item_index: { type: "number" },
        transition_name: { type: "string", description: "e.g. 'Cross Dissolve'" },
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

  if (name === "bridge_status") {
    return {
      content: [
        { type: "text", text: JSON.stringify({ plugin_connected: bridge.isPluginConnected(), port: PORT }, null, 2) },
      ],
    };
  }

  // Map tool name → plugin command (1:1 for now)
  const commandMap: Record<string, string> = {
    ping: "ping",
    resolve_info: "get_resolve_info",
    timeline_info: "get_timeline_info",
    set_clip_volume_db: "set_clip_volume_db",
    add_video_transition: "add_video_transition",
  };
  const command = commandMap[name];
  if (!command) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }

  try {
    const result = await bridge.request(command, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: String((e as Error).message) }], isError: true };
  }
});

// ─── lifecycle ────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[davinci-mcp-fat] mcp server up, bridge on ws://127.0.0.1:${PORT}/plugin\n`);
