/**
 * @haibala-aii/dsh-extensions-wallpaperskin — Node half (Host 半区).
 *
 * 本地媒体版：
 *  - 自动发现本地 Steam / Wallpaper Engine 壁纸库
 *  - 扫描创意工坊 (workshop/content/431960) 与本地项目 (projects)
 *  - 提供原图、视频流与 scene.pkg 主纹理
 *  - 持久化当前选择到 $DSH_HOME/wallpaperskin.json
 */
import { readFile, readdir, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename, extname, resolve, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { decodeSceneTexture, resolveSceneBaseTexture } from "./scene-package.js";

const name = "wallpaperskin";
const inject = ["webServer"];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|m4v|mov)$/i;
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime"
};
const CACHE_TTL_MS = 30_000;
const MAX_SCENE_CACHE_ENTRIES = 3;

let scanCache = null;
const sceneMediaCache = new Map();

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

function hasSupportedFileSync(dir) {
  try {
    return readdirSync(dir).some((file) => IMAGE_EXT.test(file) || VIDEO_EXT.test(file) || file.toLowerCase() === "scene.pkg");
  } catch {
    return false;
  }
}

function resolveProjectFile(projectDir, projectPath) {
  if (!projectPath) return "";
  const root = resolve(projectDir);
  const candidate = resolve(root, projectPath);
  const projectRelative = relative(root, candidate);
  if (!projectRelative || projectRelative.startsWith("..") || isAbsolute(projectRelative)) return "";
  return existsSync(candidate) ? candidate : "";
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

    const files = await readdir(resolved, { withFileTypes: true }).catch(() => []);
    const previewPath = resolveProjectFile(resolved, meta.preview)
      || resolveProjectFile(resolved, files.find((entry) => entry.isFile() && /^preview\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(entry.name))?.name);
    const declaredMediaPath = resolveProjectFile(resolved, meta.file);
    const fallbackImagePath = resolveProjectFile(resolved, files.find((entry) => entry.isFile() && IMAGE_EXT.test(entry.name))?.name);
    const fallbackVideoPath = resolveProjectFile(resolved, files.find((entry) => entry.isFile() && VIDEO_EXT.test(entry.name))?.name);

    let mediaKind = "preview";
    let mediaPath = previewPath || fallbackImagePath;
    let scene = null;
    if (declaredMediaPath && VIDEO_EXT.test(declaredMediaPath)) {
      mediaKind = "video";
      mediaPath = declaredMediaPath;
    } else if (declaredMediaPath && IMAGE_EXT.test(declaredMediaPath)) {
      mediaKind = "image";
      mediaPath = declaredMediaPath;
    } else if (meta.type === "video" && fallbackVideoPath) {
      mediaKind = "video";
      mediaPath = fallbackVideoPath;
    } else if (meta.type === "scene") {
      const packagePath = resolveProjectFile(resolved, "scene.pkg");
      if (packagePath) {
        try {
          scene = await resolveSceneBaseTexture(packagePath);
          mediaKind = "scene";
          mediaPath = packagePath;
        } catch {
          scene = null;
        }
      }
    } else if (meta.type === "web") {
      mediaKind = "preview";
    } else if (fallbackImagePath) {
      mediaKind = "image";
      mediaPath = fallbackImagePath;
    }
    if (!mediaPath) return;

    const thumbnailPath = previewPath || (mediaKind === "image" ? mediaPath : fallbackImagePath);
    const fallbackPath = thumbnailPath || (mediaKind === "image" ? mediaPath : "");

    const id = source + "/" + basename(resolved);
    const entry = {
      id,
      title: meta.title,
      type: meta.type,
      source,
      file: meta.file,
      mediaKind,
      previewUrl: thumbnailPath ? "/plugins/wallpaperskin/preview/" + encodeURIComponent(id) : null,
      imageUrl: fallbackPath ? "/plugins/wallpaperskin/image/" + encodeURIComponent(id) : null,
      mediaUrl: "/plugins/wallpaperskin/media/" + encodeURIComponent(id)
    };
    wallpapers.push(entry);
    byId.set(id, {
      ...entry,
      absolutePreviewPath: thumbnailPath,
      absoluteImagePath: fallbackPath,
      absoluteMediaPath: mediaPath,
      scene
    });
  }

  for (const libRoot of libraryRoots) {
    const workshop = join(libRoot, "steamapps", "workshop", "content", "431960");
    if (existsSync(workshop)) {
      for (const dirName of await readdirSafe(workshop)) {
        const full = join(workshop, dirName);
        if (existsSync(join(full, "project.json")) || hasSupportedFileSync(full)) {
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
          if (existsSync(join(full, "project.json")) || hasSupportedFileSync(full)) {
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

function sendBuffer(req, res, body, mime) {
  res.writeHead(200, {
    "content-type": mime,
    "content-length": String(body.length),
    "cache-control": "no-cache"
  });
  if (req.method === "HEAD") res.end();
  else res.end(body);
}

async function sendVideo(req, res, filePath) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    const range = req.headers.range;
    let start = 0;
    let end = info.size - 1;
    let status = 200;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { "content-range": `bytes */${info.size}` });
        res.end();
        return;
      }
      if (!match[1]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, info.size - suffixLength);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Number(match[2]);
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= info.size) {
        res.writeHead(416, { "content-range": `bytes */${info.size}` });
        res.end();
        return;
      }
      end = Math.min(end, info.size - 1);
      status = 206;
    }
    const headers = {
      "accept-ranges": "bytes",
      "content-type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      "content-length": String(end - start + 1),
      "cache-control": "no-cache"
    };
    if (status === 206) headers["content-range"] = `bytes ${start}-${end}/${info.size}`;
    res.writeHead(status, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(filePath, { start, end });
    stream.on("error", () => res.destroy());
    req.on("aborted", () => stream.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
}

async function sceneMedia(entry) {
  const packageInfo = entry.scene.packageInfo;
  const cacheKey = `${packageInfo.packagePath}:${packageInfo.size}:${packageInfo.mtimeMs}:${entry.scene.texturePath}`;
  const cached = sceneMediaCache.get(cacheKey);
  if (cached) return cached;
  const decoded = await decodeSceneTexture(packageInfo, entry.scene.texturePath);
  sceneMediaCache.set(cacheKey, decoded);
  while (sceneMediaCache.size > MAX_SCENE_CACHE_ENTRIES) {
    sceneMediaCache.delete(sceneMediaCache.keys().next().value);
  }
  return decoded;
}

/* ------------------------------------------------------------------ */
/* 路由处理                                                            */
/* ------------------------------------------------------------------ */

async function handleList(req, res) {
  const cache = await ensureScanned(true);
  const wallpapers = cache.wallpapers.map(({ id, title, type, source, mediaKind, previewUrl, imageUrl, mediaUrl }) => ({
    id, title, type, source, mediaKind, previewUrl, imageUrl, mediaUrl
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

async function handleMedia(req, res, id) {
  const cache = await ensureScanned();
  const entry = cache.byId.get(id);
  if (!entry || !entry.absoluteMediaPath) {
    sendJson(res, 404, { ok: false, error: "not found" });
    return;
  }
  if (entry.mediaKind === "video") {
    await sendVideo(req, res, entry.absoluteMediaPath);
    return;
  }
  if (entry.mediaKind === "scene" && entry.scene) {
    try {
      const decoded = await sceneMedia(entry);
      sendBuffer(req, res, decoded.data, decoded.mime);
    } catch (error) {
      sendJson(res, 415, { ok: false, error: String((error && error.message) || error) });
    }
    return;
  }
  await sendFile(res, entry.absoluteMediaPath);
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
      if (head === "preview" || head === "image" || head === "media") {
        const rawId = rest.slice(1).map(decodeURIComponent).join("/");
        if (!rawId) {
          sendJson(res, 404, { ok: false, error: "not found" });
          return;
        }
        if (head === "preview") return handlePreview(req, res, rawId);
        if (head === "media") return handleMedia(req, res, rawId);
        return handleImage(req, res, rawId);
      }
      if (head === "health") {
        sendJson(res, 200, { ok: true, plugin: "dsh-extensions-wallpaperskin", mode: "local-media" });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not found" });
    }
  }), "dsh-extensions-wallpaperskin: routes");
}

export { apply, inject, name };
