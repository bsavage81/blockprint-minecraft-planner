import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const resourcePack = process.argv[2];
if (!resourcePack) throw new Error("Pass the Bedrock resource_pack directory.");

const atlasPath = join(resourcePack, "textures", "item_texture.json");
const source = (await readFile(atlasPath, "utf8")).replace(/^\s*\/\/.*$/gm, "");
const atlas = JSON.parse(source);
const outputDirectory = resolve("public", "bedrock", "items");
await mkdir(outputDirectory, { recursive:true });

const items = {};
for (const [id, definition] of Object.entries(atlas.texture_data ?? {})) {
  const textures = Array.isArray(definition.textures) ? definition.textures : [definition.textures];
  const urls = [];
  for (const texture of textures.filter(Boolean)) {
    const sourcePath = join(resourcePack, `${texture}.png`);
    const filename = `${basename(texture)}.png`;
    try {
      await copyFile(sourcePath, join(outputDirectory, filename));
      const url = `./bedrock/items/${filename}`;
      urls.push(url);
      const textureName = basename(texture);
      items[textureName] ??= [url];
      items[textureName.replace(/^wood_/, "wooden_").replace(/^gold_/, "golden_")] ??= [url];
    } catch {
      // Some atlas entries intentionally reference textures supplied elsewhere.
    }
  }
  if (urls.length) items[id] = urls;
}

await writeFile(
  resolve("public", "bedrock-items.json"),
  `${JSON.stringify({ generatedFrom:atlasPath, items }, null, 2)}\n`,
);
console.log(`Generated ${Object.keys(items).length} item texture entries.`);
