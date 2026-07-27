import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const samples = process.argv[2];
if (!samples) throw new Error("Pass the bedrock-samples resource_pack path.");

const atlasPath = path.join(samples, "textures", "terrain_texture.json");
const blocksPath = path.join(samples, "blocks.json");
const outDir = path.resolve("public", "bedrock");
const outManifest = path.resolve("public", "bedrock-blocks.json");

function readJsonWithComments(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8").replace(/^\s*\/\/.*$/gm, ""));
}

const atlas = readJsonWithComments(atlasPath);
const blockDefinitions = readJsonWithComments(blocksPath);

function allPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allPaths);
  if (value && typeof value === "object") {
    if (typeof value.path === "string") return [value.path];
    if ("textures" in value) return allPaths(value.textures);
  }
  return [];
}

function category(id) {
  if (/(planks|log|wood|stem|hyphae|bamboo|shelf)/.test(id)) return "Wood";
  if (/(stone|brick|cobble|granite|diorite|andesite|deepslate|tuff|calcite|quartz|sandstone|concrete|terracotta)/.test(id)) return "Stone & Masonry";
  if (/(wool|carpet|glazed|stained_glass)/.test(id)) return "Color";
  if (/(grass|dirt|sand|gravel|mud|clay|snow|ice|leaves|flower|moss|vine|coral|kelp|crop|sapling|cactus|mushroom)/.test(id)) return "Nature";
  if (/(nether|basalt|blackstone|soul|nylium|wart|shroomlight|magma|crimson|warped)/.test(id)) return "Nether";
  if (/(end_|purpur|chorus|endstone)/.test(id)) return "The End";
  if (/(redstone|piston|observer|dispenser|dropper|repeater|comparator|rail|target|lever|pressure|sculk)/.test(id)) return "Redstone";
  if (/(door|trapdoor|furnace|crafting|bookshelf|chest|barrel|anvil|lantern|torch|ladder|glass|bed|table|copper|ore)/.test(id)) return "Building & Utility";
  return "Other";
}

function title(id) {
  return id.split("_").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

fs.mkdirSync(outDir, { recursive:true });
const sourceUrls = new Map();
const hashUrls = new Map();

function fileHash(filename) {
  return createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

for (const filename of fs.readdirSync(outDir).filter(name => name.endsWith(".png")).sort((a, b) => {
  const generatedDifference = Number(a.startsWith("blocks__")) - Number(b.startsWith("blocks__"));
  return generatedDifference || a.localeCompare(b);
})) {
  const fullPath = path.join(outDir, filename);
  const hash = fileHash(fullPath);
  if (!hashUrls.has(hash)) hashUrls.set(hash, `./bedrock/${filename}`);
}

function sourceFile(texturePath) {
  const normalized = texturePath.replace(/^textures\//, "");
  const withoutExtension = normalized.replace(/\.(?:png|tga)$/i, "");
  for (const extension of [".png", ".tga"]) {
    const candidate = path.join(samples, "textures", `${withoutExtension}${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function publicUrl(texturePath) {
  const source = sourceFile(texturePath);
  if (!source || path.extname(source).toLowerCase() !== ".png") return null;
  if (sourceUrls.has(source)) return sourceUrls.get(source);
  const hash = fileHash(source);
  if (hashUrls.has(hash)) {
    const existingUrl = hashUrls.get(hash);
    sourceUrls.set(source, existingUrl);
    return existingUrl;
  }
  const relative = path.relative(path.join(samples, "textures"), source)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "__");
  const filename = `${relative}.png`;
  fs.copyFileSync(source, path.join(outDir, filename));
  const url = `./bedrock/${filename}`;
  sourceUrls.set(source, url);
  hashUrls.set(hash, url);
  return url;
}

function atlasUrls(reference) {
  const definition = atlas.texture_data[reference];
  if (!definition) return [];
  return [...new Set(allPaths(definition).map(publicUrl).filter(Boolean))];
}

const faces = new Set(["up", "down", "north", "south", "east", "west", "side"]);
const entries = [];
for (const [id, definition] of Object.entries(blockDefinitions)) {
  if (!definition || typeof definition !== "object" || !("textures" in definition)) continue;
  const rawTextures = definition.textures;
  const references = typeof rawTextures === "string"
    ? { side:rawTextures }
    : Object.fromEntries(Object.entries(rawTextures).filter(([face, value]) => faces.has(face) && typeof value === "string"));
  const textures = {};
  const textureRefs = {};
  const textureVariants = {};
  for (const [face, reference] of Object.entries(references)) {
    const urls = atlasUrls(reference);
    if (!urls.length) continue;
    textures[face] = urls[0];
    textureRefs[face] = reference;
    urls.forEach((url, index) => { textureVariants[`${reference}#${index}`] = url; });
  }
  const textureUrl = textures.up ?? textures.side ?? textures.north ?? Object.values(textures)[0];
  entries.push({
    id:`bedrock:${id}`,
    name:title(id),
    category:category(id),
    textureUrl,
    textures,
    textureRefs,
    textureVariants,
    minecraftName:`minecraft:${id}`,
  });
}

entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
fs.writeFileSync(outManifest, `${JSON.stringify({
  source:"Mojang/bedrock-samples resource_pack blocks.json + terrain_texture.json",
  blocks:entries,
}, null, 2)}\n`);
const referencedUrls = new Set(sourceUrls.values());
for (const filename of fs.readdirSync(outDir).filter(name => name.startsWith("blocks__") && name.endsWith(".png"))) {
  if (!referencedUrls.has(`./bedrock/${filename}`)) fs.rmSync(path.join(outDir, filename));
}
console.log(`Generated ${entries.length} block mappings using ${sourceUrls.size} PNG texture assets.`);
