// davinci-mcp-fat — Workflow Integration plugin Electron main process.
//
// Hosts a tiny HTTP server on 127.0.0.1:9087. The MCP server speaks to it
// via plain HTTP/JSON. We don't ship ws or any node_modules — only Node's
// stdlib + WorkflowIntegration.node (BMD's native binding).
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const WorkflowIntegration = require('./WorkflowIntegration.node');

const PLUGIN_ID = 'com.dannydesert.davinci-mcp-fat';
const PLUGIN_VERSION = '0.1.0';
const HTTP_PORT = Number(process.env.DAVINCI_MCP_FAT_PORT || 9087);

let mainWindow = null;
let resolveObj = null;
let httpServer = null;
const status = { resolveBound: false, httpListening: false, lastRequestAt: null };

// ─── Resolve bridge ─────────────────────────────────────────────────
async function getResolve() {
    if (resolveObj) return resolveObj;
    const ok = await WorkflowIntegration.Initialize(PLUGIN_ID);
    if (!ok) return null;
    resolveObj = await WorkflowIntegration.GetResolve();
    status.resolveBound = Boolean(resolveObj);
    pushStatus();
    return resolveObj;
}

async function cleanupResolve() {
    try { WorkflowIntegration.CleanUp(); } catch (_) {}
    resolveObj = null;
    status.resolveBound = false;
}

// ─── Command dispatch ──────────────────────────────────────────────
const commands = {
    ping: async () => ({ pong: true, version: PLUGIN_VERSION, ts: Date.now() }),

    resolve_info: async () => {
        const r = await getResolve();
        if (!r) throw new Error('resolve unavailable');
        return {
            product_name: await r.GetProductName(),
            version: await r.GetVersionString(),
            current_page: await r.GetCurrentPage(),
        };
    },

    timeline_info: async () => {
        const r = await getResolve();
        if (!r) throw new Error('resolve unavailable');
        const pm = await r.GetProjectManager();
        const proj = pm ? await pm.GetCurrentProject() : null;
        const tl = proj ? await proj.GetCurrentTimeline() : null;
        if (!tl) return { timeline: null };
        return {
            name: await tl.GetName(),
            start_frame: await tl.GetStartFrame(),
            end_frame: await tl.GetEndFrame(),
            v_tracks: await tl.GetTrackCount('video'),
            a_tracks: await tl.GetTrackCount('audio'),
        };
    },

    // Phase 2 stubs — proving the gap-closing surface compiles.
    set_clip_volume_db: async (_params) => {
        throw new Error('not_implemented: set_clip_volume_db (phase 2)');
    },
    add_video_transition: async (_params) => {
        throw new Error('not_implemented: add_video_transition (phase 3)');
    },
};

// ─── HTTP server ────────────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function startHttp() {
    httpServer = http.createServer(async (req, res) => {
        // simple CORS for localhost MCP clients
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

        if (req.method === 'GET' && req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                plugin_id: PLUGIN_ID, version: PLUGIN_VERSION,
                resolve_bound: status.resolveBound,
                last_request_at: status.lastRequestAt,
                commands: Object.keys(commands),
            }));
        }

        if (req.method === 'POST' && req.url === '/command') {
            status.lastRequestAt = Date.now();
            pushStatus();
            try {
                const body = await readBody(req);
                const fn = commands[body.command];
                if (!fn) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ ok: false, error: 'unknown command: ' + body.command }));
                }
                const result = await fn(body.params || {});
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: true, result }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
            }
        }

        res.writeHead(404); res.end();
    });
    httpServer.on('error', (e) => { console.error('http server error', e); });
    httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
        status.httpListening = true;
        pushStatus();
        console.log(`[davinci-mcp-fat] http listening on 127.0.0.1:${HTTP_PORT}`);
    });
}

// ─── Renderer status push ──────────────────────────────────────────
function pushStatus() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status', {
            plugin_id: PLUGIN_ID,
            version: PLUGIN_VERSION,
            http_port: HTTP_PORT,
            ...status,
        });
    }
}

ipcMain.handle('status:get', () => ({
    plugin_id: PLUGIN_ID, version: PLUGIN_VERSION, http_port: HTTP_PORT, ...status,
}));

// ─── Lifecycle ──────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 520,
        height: 380,
        useContentSize: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js') },
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('close', () => app.quit());
}

app.whenReady().then(async () => {
    createWindow();
    startHttp();
    // Initialize Resolve binding lazily on first command, but try once at boot.
    try { await getResolve(); } catch (_) {}
});

app.on('window-all-closed', async () => {
    if (httpServer) httpServer.close();
    await cleanupResolve();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
