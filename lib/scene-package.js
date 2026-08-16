/**
 * Bounds-checked readers for Wallpaper Engine scene packages and textures.
 * The renderer uses the scene's primary texture without executing package scripts.
 */
import { open } from "node:fs/promises";

const MAX_STRING_BYTES = 1024 * 1024;
const MAX_ENTRY_COUNT = 100_000;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_TEXTURE_BYTES = 256 * 1024 * 1024;
const MAX_TEXTURE_DIMENSION = 16_384;

async function readExact(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new Error("truncated scene package");
  return buffer;
}

async function readUInt32(handle, cursor) {
  const bytes = await readExact(handle, cursor.offset, 4);
  cursor.offset += 4;
  return bytes.readUInt32LE(0);
}

async function readString(handle, cursor) {
  const length = await readUInt32(handle, cursor);
  if (length === 0 || length > MAX_STRING_BYTES) throw new Error("invalid scene package string");
  const bytes = await readExact(handle, cursor.offset, length);
  cursor.offset += length;
  return bytes.toString("utf8").replace(/\0+$/, "");
}

function normalizeEntryPath(path) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || parts.includes("..")) {
    throw new Error("unsafe scene package path");
  }
  return normalized;
}

/**
 * Read and validate a Wallpaper Engine PKGV package directory.
 * @param {string} packagePath Absolute path to `scene.pkg`.
 * @returns {Promise<{packagePath: string, version: string, payloadOffset: number, size: number, mtimeMs: number, entries: Map<string, {path: string, offset: number, length: number}>}>} Validated package metadata.
 */
export async function parseScenePackage(packagePath) {
  const handle = await open(packagePath, "r");
  try {
    const { size, mtimeMs } = await handle.stat();
    const cursor = { offset: 0 };
    const version = await readString(handle, cursor);
    if (!version.startsWith("PKGV")) throw new Error("unsupported scene package header");
    const count = await readUInt32(handle, cursor);
    if (count > MAX_ENTRY_COUNT) throw new Error("scene package contains too many entries");

    const entries = new Map();
    for (let index = 0; index < count; index += 1) {
      const path = normalizeEntryPath(await readString(handle, cursor));
      const offset = await readUInt32(handle, cursor);
      const length = await readUInt32(handle, cursor);
      entries.set(path.toLowerCase(), { path, offset, length });
    }

    const payloadOffset = cursor.offset;
    for (const entry of entries.values()) {
      if (entry.offset > size - payloadOffset || entry.length > size - payloadOffset - entry.offset) {
        throw new Error("scene package entry exceeds file size");
      }
    }
    return { packagePath, version, payloadOffset, size, mtimeMs, entries };
  } finally {
    await handle.close();
  }
}

async function readEntry(packageInfo, path, maxBytes) {
  const normalized = normalizeEntryPath(path);
  const entry = packageInfo.entries.get(normalized.toLowerCase());
  if (!entry) throw new Error(`scene package entry not found: ${normalized}`);
  if (entry.length > maxBytes) throw new Error(`scene package entry is too large: ${normalized}`);
  const handle = await open(packageInfo.packagePath, "r");
  try {
    return await readExact(handle, packageInfo.payloadOffset + entry.offset, entry.length);
  } finally {
    await handle.close();
  }
}

async function readJsonEntry(packageInfo, path) {
  const bytes = await readEntry(packageInfo, path, MAX_JSON_BYTES);
  return JSON.parse(bytes.toString("utf8"));
}

/**
 * Resolve the primary scene texture through scene, model, and material metadata.
 * @param {string} packagePath Absolute path to `scene.pkg`.
 * @returns {Promise<{packageInfo: Awaited<ReturnType<typeof parseScenePackage>>, texturePath: string}>} Package metadata and primary texture path.
 */
export async function resolveSceneBaseTexture(packagePath) {
  const packageInfo = await parseScenePackage(packagePath);
  const scene = await readJsonEntry(packageInfo, "scene.json");
  const imageObject = Array.isArray(scene.objects) ? scene.objects.find((object) => typeof object.image === "string") : null;
  if (!imageObject) throw new Error("scene has no base image object");
  const model = await readJsonEntry(packageInfo, imageObject.image);
  if (typeof model.material !== "string") throw new Error("scene image has no material");
  const material = await readJsonEntry(packageInfo, model.material);
  const textureName = material?.passes?.[0]?.textures?.[0];
  if (typeof textureName !== "string") throw new Error("scene material has no base texture");
  const texturePath = normalizeEntryPath(`materials/${textureName}.tex`);
  if (!packageInfo.entries.has(texturePath.toLowerCase())) throw new Error("scene base texture is missing");
  return { packageInfo, texturePath };
}

function decompressRle(data, expectedSize) {
  const output = Buffer.alloc(expectedSize);
  let inputOffset = 0;
  let outputOffset = 0;
  while (inputOffset < data.length && outputOffset < expectedSize) {
    let count = data[inputOffset];
    inputOffset += 1;
    if ((count & 0x80) !== 0) {
      count = (count & 0x7f) + 1;
      if (inputOffset >= data.length) break;
      output.fill(data[inputOffset], outputOffset, Math.min(expectedSize, outputOffset + count));
      inputOffset += 1;
      outputOffset += count;
    } else {
      count += 1;
      const available = Math.min(count, data.length - inputOffset, expectedSize - outputOffset);
      data.copy(output, outputOffset, inputOffset, inputOffset + available);
      inputOffset += available;
      outputOffset += available;
      if (available !== count) break;
    }
  }
  if (outputOffset < expectedSize) throw new Error("truncated scene texture data");
  return output;
}

function createBmp(width, height, pixels) {
  const imageSize = width * height * 4;
  const output = Buffer.alloc(54 + imageSize);
  output.write("BM", 0, "ascii");
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(-height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(32, 28);
  output.writeUInt32LE(imageSize, 34);
  pixels.copy(output, 54);
  return output;
}

function detectBrowserImage(data, width, height) {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { data, mime: "image/png", width, height };
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { data, mime: "image/jpeg", width, height };
  }
  if (data[0] === 0x42 && data[1] === 0x4d) {
    return { data, mime: "image/bmp", width, height };
  }
  return null;
}

function decodeLz4Block(source, outputSize) {
  const output = Buffer.alloc(outputSize);
  let sourceOffset = 0;
  let outputOffset = 0;
  const extendedLength = (initial) => {
    let length = initial;
    if (initial !== 15) return length;
    while (sourceOffset < source.length) {
      const value = source[sourceOffset];
      sourceOffset += 1;
      length += value;
      if (value !== 255) return length;
    }
    throw new Error("truncated LZ4 length");
  };

  while (sourceOffset < source.length) {
    const token = source[sourceOffset];
    sourceOffset += 1;
    const literalLength = extendedLength(token >> 4);
    if (sourceOffset + literalLength > source.length || outputOffset + literalLength > output.length) {
      throw new Error("invalid LZ4 literal length");
    }
    source.copy(output, outputOffset, sourceOffset, sourceOffset + literalLength);
    sourceOffset += literalLength;
    outputOffset += literalLength;
    if (sourceOffset === source.length) break;
    if (sourceOffset + 2 > source.length) throw new Error("truncated LZ4 match offset");
    const matchOffset = source.readUInt16LE(sourceOffset);
    sourceOffset += 2;
    if (matchOffset === 0 || matchOffset > outputOffset) throw new Error("invalid LZ4 match offset");
    const matchLength = extendedLength(token & 0x0f) + 4;
    if (outputOffset + matchLength > output.length) throw new Error("invalid LZ4 match length");
    for (let index = 0; index < matchLength; index += 1) {
      output[outputOffset + index] = output[outputOffset - matchOffset + index];
    }
    outputOffset += matchLength;
  }
  if (outputOffset !== outputSize) throw new Error("LZ4 output size mismatch");
  return output;
}

function rgbaToBgra(data) {
  const output = Buffer.from(data);
  for (let offset = 0; offset < output.length; offset += 4) {
    const red = output[offset];
    output[offset] = output[offset + 2];
    output[offset + 2] = red;
  }
  return output;
}

function decodeModernTexture(bytes) {
  if (bytes.subarray(0, 9).toString("binary") !== "TEXV0005\0" || bytes.subarray(9, 18).toString("binary") !== "TEXI0001\0") {
    return null;
  }
  if (bytes.length < 83) throw new Error("truncated TEXV0005 texture");
  const format = bytes.readUInt32LE(18);
  const container = bytes.subarray(46, 55).toString("binary");
  if (container !== "TEXB0003\0" && container !== "TEXB0002\0") throw new Error("unsupported TEXB container");
  let offset = 55;
  const imageCount = bytes.readUInt32LE(offset);
  offset += 4;
  if (imageCount === 0) throw new Error("scene texture has no images");
  let freeImageFormat = 0;
  if (container === "TEXB0003\0") {
    freeImageFormat = bytes.readUInt32LE(offset);
    offset += 4;
  }
  const mipCount = bytes.readUInt32LE(offset);
  offset += 4;
  if (mipCount === 0 || offset + 20 > bytes.length) throw new Error("scene texture has no mip levels");
  const width = bytes.readUInt32LE(offset);
  const height = bytes.readUInt32LE(offset + 4);
  const compression = bytes.readUInt32LE(offset + 8);
  let uncompressedSize = bytes.readInt32LE(offset + 12);
  const storedSize = bytes.readInt32LE(offset + 16);
  offset += 20;
  if (width === 0 || height === 0 || width > MAX_TEXTURE_DIMENSION || height > MAX_TEXTURE_DIMENSION || storedSize <= 0 || offset + storedSize > bytes.length) {
    throw new Error("invalid scene texture mip level");
  }
  if (compression === 0) uncompressedSize = storedSize;
  if (uncompressedSize <= 0 || uncompressedSize > MAX_TEXTURE_BYTES) throw new Error("invalid scene texture output size");
  const stored = bytes.subarray(offset, offset + storedSize);
  const decoded = compression === 1 ? decodeLz4Block(stored, uncompressedSize) : compression === 0 ? stored : null;
  if (!decoded) throw new Error("unsupported scene texture compression");
  const browserImage = detectBrowserImage(decoded, width, height);
  if (freeImageFormat !== 0 && freeImageFormat !== 0xffffffff) {
    if (!browserImage) throw new Error("unsupported embedded scene image");
    return browserImage;
  }
  if (browserImage) return browserImage;
  if (format !== 0 || decoded.length !== width * height * 4) throw new Error(`unsupported scene texture format: ${format}`);
  return { data: createBmp(width, height, rgbaToBgra(decoded)), mime: "image/bmp", width, height };
}

/**
 * Decode the largest mip level of a Wallpaper Engine TEX entry.
 * @param {ReturnType<typeof parseScenePackage> extends Promise<infer T> ? T : never} packageInfo Validated package metadata.
 * @param {string} texturePath Package-relative TEX path.
 * @returns {Promise<{data: Buffer, mime: string, width: number, height: number}>} Browser-readable image bytes.
 */
export async function decodeSceneTexture(packageInfo, texturePath) {
  const bytes = await readEntry(packageInfo, texturePath, MAX_TEXTURE_BYTES);
  if (bytes.length < 64 || bytes.toString("ascii", 0, 4) !== "TEXV") throw new Error("invalid scene texture header");
  const modern = decodeModernTexture(bytes);
  if (modern) return modern;
  const width = bytes.readUInt32LE(0x22);
  const height = bytes.readUInt32LE(0x26);
  if (width === 0 || height === 0 || width > MAX_TEXTURE_DIMENSION || height > MAX_TEXTURE_DIMENSION) {
    throw new Error("invalid scene texture dimensions");
  }
  const texbOffset = bytes.indexOf(Buffer.from("TEXB"));
  if (texbOffset < 0) throw new Error("scene texture has no TEXB section");
  const dimensions = Buffer.alloc(8);
  dimensions.writeUInt32LE(width, 0);
  dimensions.writeUInt32LE(height, 4);
  const mipOffset = bytes.indexOf(dimensions, texbOffset);
  if (mipOffset < 0 || mipOffset + 20 > bytes.length) throw new Error("scene texture has no base mip level");
  const dataSize = bytes.readUInt32LE(mipOffset + 16);
  const dataOffset = mipOffset + 20;
  if (dataSize === 0 || dataOffset + dataSize > bytes.length) throw new Error("invalid scene texture data size");
  const texture = bytes.subarray(dataOffset, dataOffset + dataSize);
  const browserImage = detectBrowserImage(texture, width, height);
  if (browserImage) return browserImage;
  const expectedSize = width * height * 4;
  if (expectedSize > MAX_TEXTURE_BYTES) throw new Error("scene texture output is too large");
  const pixels = texture.length === expectedSize ? texture : decompressRle(texture, expectedSize);
  return { data: createBmp(width, height, pixels), mime: "image/bmp", width, height };
}
