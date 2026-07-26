import fs from "node:fs";
import path from "node:path";

const samples = process.argv[2];
if (!samples) throw new Error("Pass the bedrock-samples resource_pack path.");

const atlasPath = path.join(samples, "textures", "terrain_texture.json");
const blockDir = path.join(samples, "textures", "blocks");
const outDir = path.resolve("public", "bedrock");
const outManifest = path.resolve("public", "bedrock-blocks.json");
const raw = fs.readFileSync(atlasPath, "utf8").replace(/^\s*\/\/.*$/gm, "");
const atlas = JSON.parse(raw);

function firstPath(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstPath(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    if (typeof value.path === "string") return value.path;
    if ("textures" in value) return firstPath(value.textures);
  }
  return null;
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

fs.mkdirSync(outDir, { recursive: true });
const seenPaths = new Set();
const entries = [];
for (const [id, definition] of Object.entries(atlas.texture_data)) {
  const texturePath = firstPath(definition);
  if (!texturePath?.startsWith("textures/blocks/")) continue;
  if (/(placeholder|missing|debug|destroy_stage|breaking|particle)/.test(id)) continue;
  const relative = texturePath.replace("textures/blocks/", "");
  const source = path.join(blockDir, `${relative}.png`);
  if (!fs.existsSync(source) || seenPaths.has(source)) continue;
  const filename = `${id.replace(/[^a-z0-9_-]/gi, "-")}.png`;
  fs.copyFileSync(source, path.join(outDir, filename));
  seenPaths.add(source);
  entries.push({ id: `bedrock:${id}`, name: title(id), category: category(id), textureUrl: `./bedrock/${filename}` });
}
entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
fs.writeFileSync(outManifest, JSON.stringify({ source: "Mojang/bedrock-samples", blocks: entries }, null, 2));
console.log(`Generated ${entries.length} Bedrock palette entries.`);
