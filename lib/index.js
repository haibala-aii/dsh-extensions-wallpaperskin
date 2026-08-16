/**
 * @haibala-aii/dsh-extensions-wallpaperskin — Node half (Host 半区).
 *
 * 静态图片版：
 *  - 自动发现本地 Steam / Wallpaper Engine 壁纸库
 *  - 扫描创意工坊 (workshop/content/431960) 与本地项目 (projects)
 *  - 提供静态预览图 / 背景图服务
 *  - 持久化当前选择到 $DSH_HOME/wallpaperskin.json
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const name = "wallpaperskin";
const inject = ["webServer"];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif"
};
const CACHE_TTL_MS = 30_000;

let scanCache = null;

/* ------------------------------------------------------------------ */
/* 配置持久化                                                          */
/* ------------------------------------------------------------------ */

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

function configPath() {
  return join(dshHome(), "wallpaperskin.json");
}

function readConfig() {
  try {
    const raw = readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeConfig(patch) {
  const next = Object.assign({}, readConfig(), patch);
  await mkdir(dshHome(), { recursive: true });
  await writeFile(configPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

/* ------------------------------------------------------------------ */
/* Steam / Wallpaper Engine 路径发现                                    */
/* ------------------------------------------------------------------ */

function findSteamRootCandidates() {
  const candidates = [];
  const envSteam = process.env.STEAM_PATH;
  if (envSteam) candidates.push(envSteam.replace(/\\+$/, ""));

  try {
    const out = execFileSync(
      "reg",
      ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"],
      { encoding: "utf8", windowsHide: true, timeout: 3000 }
    );
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) candidates.push(m[1].trim().replace(/\\+$/, ""));
  } catch {
    /* 注册表不可用时继续尝试常见路径 */
  }

  for (const drive of ["C", "D", "E", "F", "G"]) {
    for (const p of [
      `${drive}:\\Program Files (x86)\\Steam`,
      `${drive}:\\Program Files\\Steam`,
      `${drive}:\\Steam`,
      `${drive}:\\SteamLibrary`
    ]) {
      candidates.push(p);
    }
  }
  return candidates;
}

/** 返回所有包含 steamapps 的 Steam 库根目录（按 Windows 不区分大小写去重）。 */
function discoverLibraryRoots() {
  const roots = new Map();
  const addRoot = (p) => {
    if (!p) return;
    const resolved = resolve(p);
    roots.set(resolved.toLowerCase(), resolved);
  };
  for (const base of findSteamRootCandidates()) {
    if (!base || !existsSync(join(base, "steamapps"))) continue;
    addRoot(base);
    const vdf = join(base, "steamapps", "libraryfolders.vdf");
    if (existsSync(vdf)) {
      try {
        const text = readFileSync(vdf, "utf8");
        const re = /"path"\s+"([^"]+)"/g;
        let m;
        while ((m = re.exec(text))) {
          const p = m[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"');
          if (p && existsSync(join(p, "steamapps"))) addRoot(p);
        }
      } catch {
        /* 解析失败不影响已有根 */
      }
    }
  }
  return [...roots.values()];
}

/* ------------------------------------------------------------------ */
/* 壁纸扫描                                                            */
/* ------------------------------------------------------------------ */

async function readdirSafe(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function hasImageFileSync(dir) {
  try {
    return readdirSync(dir).some((f) => IMAGE_EXT.test(f));
  } catch {
    return false;
  }
}

async function readProjectMeta(dirPath) {
  const pj = join(dirPath, "project.json");
  const meta = { type: "unknown", file: "", title: basename(dirPath), preview: "" };
  if (!existsSync(pj)) return meta;

  let raw = "";
  try {
    raw = await readFile(pj, "utf8");
  } catch {
    return meta;
  }

  try {
    const json = JSON.parse(raw);
    if (json.type) meta.type = String(json.type).toLowerCase();
    if (json.file) meta.file = String(json.file);
    if (json.title) meta.title = String(json.title);
    if (json.preview) meta.preview = String(json.preview);
    return meta;
  } catch {
    const t = raw.match(/"type"\s*:\s*"([^"]+)"/i);
    if (t) meta.type = t[1].toLowerCase();
    const f = raw.match(/"file"\s*:\s*"([^"]+)"/i);
    if (f) meta.file = f[1];
    const title = raw.match(/"title"\s*:\s*"([^"]*)"/i);
    if (title) meta.title = title[1];
    const p = raw.match(/"preview"\s*:\s*"([^"]*)"/i);
    if (p) meta.preview = p[1];
    return meta;
  }
}

async function scanWallpapers() {
  const libraryRoots = discoverLibraryRoots();
  const wallpapers = [];
  const byId = new Map();
  const seen = new Set();

  async function addProject(dirPath, source) {
    const resolved = resolve(dirPath);
    if (seen.has(resolved)) return;
    seen.add(resolved);

    const meta = await readProjectMeta(resolved);

    // 静态图片候选：preview 文件优先，其次是主图片文件，最后是目录内任意图片
    let previewPath = "";
    if (meta.preview) {
      const cand = join(resolved, meta.preview);
      if (existsSync(cand)) previewPath = cand;
    }
    let imagePath = previewPath;
    if (!imagePath && meta.file && IMAGE_EXT.test(meta.file)) {
      const cand = join(resolved, meta.file);
      if (existsSync(cand)) imagePath = cand;
    }
    if (!imagePath) {
      try {
        const entries = await readdir(resolved, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && IMAGE_EXT.test(e.name)) {
            imagePath = join(resolved, e.name);
            if (!previewPath) previewPath = imagePath;
            break;
          }
        }
      } catch {
        /* 忽略 */
      }
    }
    if (!imagePath) return;

    const id = source + "/" + basename(resolved);
    const entry = {
      id,
      title: meta.title,
      type: meta.type,
      source,
      file: meta.file,
      previewUrl: "/plugins/wallpaperskin/preview/" + encodeURIComponent(id),
      imageUrl: "/plugins/wallpaperskin/image/" + encodeURIComponent(id)
    };
    wallpapers.push(entry);
    byId.set(id, { ...entry, absolutePreviewPath: previewPath, absoluteImagePath: imagePath });
  }

  for (const libRoot of libraryRoots) {
    const workshop = join(libRoot, "steamapps", "workshop", "content", "431960");
    if (existsSync(workshop)) {
      for (const dirName of await readdirSafe(workshop)) {
        const full = join(workshop, dirName);
        if (existsSync(join(full, "project.json")) || hasImageFileSync(full)) {
          await addProject(full, "workshop");
        }
      }
    }

    const weRoot = join(libRoot, "steamapps", "common", "wallpaper_engine");
    if (existsSync(weRoot)) {
      const base = join(weRoot, "projects", "myprojects");
      if (existsSync(base)) {
        for (const dirName of await readdirSafe(base)) {
          const full = join(base, dirName);
          if (existsSync(join(full, "project.json")) || hasImageFileSync(full)) {
            await addProject(full, "myprojects");
          }
        }
      }
    }
  }

  return { libraryRoots, wallpapers, byId };
}

async function ensureScanned(force = false) {
  const now = Date.now();
  if (!force && scanCache && now - scanCache.scannedAt < CACHE_TTL_MS) {
    return scanCache;
  }
  const result = await scanWallpapers();
  result.scannedAt = now;
  scanCache = result;
  return result;
}

/* ------------------------------------------------------------------ */
/* HTTP 工具                                                           */
/* ------------------------------------------------------------------ */

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function sendFile(res, filePath) {
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "content-length": String(data.length),
      "cache-control": "no-cache"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
}

/* ------------------------------------------------------------------ */
/* 路由处理                                                            */
/* ------------------------------------------------------------------ */

async function handleList(req, res) {
  const cache = await ensureScanned(true);
  const wallpapers = cache.wallpapers.map(({ id, title, type, source, previewUrl, imageUrl }) => ({
    id, title, type, source, previewUrl, imageUrl
  }));
  sendJson(res, 200, {
    ok: true,
    wallpapers,
    libraryRoots: cache.libraryRoots,
    config: readConfig()
  });
}

async function handlePreview(req, res, id) {
  const cache = await ensureScanned();
  const entry = cache.byId.get(id);
  if (!entry || !entry.absolutePreviewPath) {
    sendJson(res, 404, { ok: false, error: "not found" });
    return;
  }
  await sendFile(res, entry.absolutePreviewPath);
}

async function handleImage(req, res, id) {
  const cache = await ensureScanned();
  const entry = cache.byId.get(id);
  if (!entry || !entry.absoluteImagePath) {
    sendJson(res, 404, { ok: false, error: "not found" });
    return;
  }
  await sendFile(res, entry.absoluteImagePath);
}

async function handleConfigGet(req, res) {
  sendJson(res, 200, { ok: true, config: readConfig() });
}

async function handleConfigPost(req, res) {
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("config must be a JSON object");
    }
    const config = await writeConfig(body);
    sendJson(res, 200, { ok: true, config });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: String((error && error.message) || error) });
  }
}

/* ------------------------------------------------------------------ */
/* Cordis 插件入口                                                     */
/* ------------------------------------------------------------------ */

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/plugins/wallpaperskin",
    handler: async (req, res) => {
      const url = new URL(req.url || "/", "http://x");
      const rest = url.pathname.split("/").filter(Boolean).slice(2);
      const head = rest[0];

      if (head === "list") return handleList(req, res);
      if (head === "config") {
        if (req.method === "GET" || req.method === "HEAD") return handleConfigGet(req, res);
        if (req.method === "POST") return handleConfigPost(req, res);
        res.writeHead(405);
        res.end();
        return;
      }
      if (head === "preview" || head === "image") {
        const rawId = rest.slice(1).map(decodeURIComponent).join("/");
        if (!rawId) {
          sendJson(res, 404, { ok: false, error: "not found" });
          return;
        }
        if (head === "preview") return handlePreview(req, res, rawId);
        return handleImage(req, res, rawId);
      }
      if (head === "health") {
        sendJson(res, 200, { ok: true, plugin: "dsh-extensions-wallpaperskin", mode: "static-image" });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not found" });
    }
  }), "dsh-extensions-wallpaperskin: routes");
}

export { apply, inject, name };
