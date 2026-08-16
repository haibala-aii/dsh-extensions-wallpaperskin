import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { decodeSceneTexture, resolveSceneBaseTexture } from "../lib/scene-package.js";

function makeTex(payload) {
  const mipOffset = 64;
  const output = Buffer.alloc(mipOffset + 20 + payload.length);
  output.write("TEXV", 0, "ascii");
  output.writeUInt32LE(2, 0x22);
  output.writeUInt32LE(2, 0x26);
  output.write("TEXB", 48, "ascii");
  output.writeUInt32LE(2, mipOffset);
  output.writeUInt32LE(2, mipOffset + 4);
  output.writeUInt32LE(payload.length, mipOffset + 16);
  payload.copy(output, mipOffset + 20);
  return output;
}

function makeModernTex(payload) {
  const stored = Buffer.concat([Buffer.from([payload.length << 4]), payload]);
  const output = Buffer.alloc(87 + stored.length);
  output.write("TEXV0005\0", 0, "binary");
  output.write("TEXI0001\0", 9, "binary");
  output.writeUInt32LE(0, 18);
  output.writeUInt32LE(4, 26);
  output.writeUInt32LE(4, 30);
  output.writeUInt32LE(2, 34);
  output.writeUInt32LE(2, 38);
  output.write("TEXB0003\0", 46, "binary");
  output.writeUInt32LE(1, 55);
  output.writeUInt32LE(1, 59);
  output.writeUInt32LE(1, 63);
  output.writeUInt32LE(4, 67);
  output.writeUInt32LE(4, 71);
  output.writeUInt32LE(1, 75);
  output.writeInt32LE(payload.length, 79);
  output.writeInt32LE(stored.length, 83);
  stored.copy(output, 87);
  return output;
}

function makePackage(entries) {
  const version = Buffer.from("PKGV0024");
  const directoryParts = [];
  let payloadOffset = 0;
  for (const [path, data] of entries) {
    const name = Buffer.from(path);
    const header = Buffer.alloc(4 + name.length + 8);
    header.writeUInt32LE(name.length, 0);
    name.copy(header, 4);
    header.writeUInt32LE(payloadOffset, 4 + name.length);
    header.writeUInt32LE(data.length, 8 + name.length);
    directoryParts.push(header);
    payloadOffset += data.length;
  }
  const prefix = Buffer.alloc(4 + version.length + 4);
  prefix.writeUInt32LE(version.length, 0);
  version.copy(prefix, 4);
  prefix.writeUInt32LE(entries.length, 4 + version.length);
  return Buffer.concat([prefix, ...directoryParts, ...entries.map((entry) => entry[1])]);
}

test("resolves and decodes the primary scene texture", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wallpaperskin-scene-"));
  try {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const entries = [
      ["scene.json", Buffer.from(JSON.stringify({ objects: [{ image: "models/base.json" }] }))],
      ["models/base.json", Buffer.from(JSON.stringify({ material: "materials/base.json" }))],
      ["materials/base.json", Buffer.from(JSON.stringify({ passes: [{ textures: ["wallpaper"] }] }))],
      ["materials/wallpaper.tex", makeTex(png)]
    ];
    const packagePath = join(directory, "scene.pkg");
    await writeFile(packagePath, makePackage(entries));
    const resolved = await resolveSceneBaseTexture(packagePath);
    assert.equal(resolved.texturePath, "materials/wallpaper.tex");
    const decoded = await decodeSceneTexture(resolved.packageInfo, resolved.texturePath);
    assert.equal(decoded.mime, "image/png");
    assert.deepEqual(decoded.data, png);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unsafe package entry paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wallpaperskin-scene-"));
  try {
    const packagePath = join(directory, "scene.pkg");
    await writeFile(packagePath, makePackage([["../outside.json", Buffer.from("{}")]]));
    await assert.rejects(resolveSceneBaseTexture(packagePath), /unsafe scene package path/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("decodes TEXV0005 textures when allocated and real dimensions differ", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wallpaperskin-scene-"));
  try {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const entries = [
      ["scene.json", Buffer.from(JSON.stringify({ objects: [{ image: "models/base.json" }] }))],
      ["models/base.json", Buffer.from(JSON.stringify({ material: "materials/base.json" }))],
      ["materials/base.json", Buffer.from(JSON.stringify({ passes: [{ textures: ["wallpaper"] }] }))],
      ["materials/wallpaper.tex", makeModernTex(png)]
    ];
    const packagePath = join(directory, "scene.pkg");
    await writeFile(packagePath, makePackage(entries));
    const resolved = await resolveSceneBaseTexture(packagePath);
    const decoded = await decodeSceneTexture(resolved.packageInfo, resolved.texturePath);
    assert.equal(decoded.mime, "image/png");
    assert.deepEqual(decoded.data, png);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects legacy textures whose decoded pixels exceed the memory limit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wallpaperskin-scene-"));
  try {
    const texture = makeTex(Buffer.from([0]));
    texture.writeUInt32LE(16_384, 0x22);
    texture.writeUInt32LE(16_384, 0x26);
    texture.writeUInt32LE(16_384, 64);
    texture.writeUInt32LE(16_384, 68);
    const entries = [
      ["scene.json", Buffer.from(JSON.stringify({ objects: [{ image: "models/base.json" }] }))],
      ["models/base.json", Buffer.from(JSON.stringify({ material: "materials/base.json" }))],
      ["materials/base.json", Buffer.from(JSON.stringify({ passes: [{ textures: ["wallpaper"] }] }))],
      ["materials/wallpaper.tex", texture]
    ];
    const packagePath = join(directory, "scene.pkg");
    await writeFile(packagePath, makePackage(entries));
    const resolved = await resolveSceneBaseTexture(packagePath);
    await assert.rejects(
      decodeSceneTexture(resolved.packageInfo, resolved.texturePath),
      /scene texture output is too large/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
