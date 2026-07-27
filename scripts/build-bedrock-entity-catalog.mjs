import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const resourcePack = process.argv[2];
if (!resourcePack) throw new Error("Pass the Bedrock resource_pack directory.");

const sourceDirectory = join(resourcePack, "entity");
const outputDirectory = resolve("public", "bedrock", "entities");
await mkdir(outputDirectory, { recursive:true });

const mobExceptions = new Set([
  "minecraft:ender_dragon", "minecraft:iron_golem", "minecraft:snow_golem",
  "minecraft:warden", "minecraft:wither",
]);
const entities = new Map();

for (const filename of await readdir(sourceDirectory)) {
  if (!filename.endsWith(".json") || filename.includes(".v1.")) continue;
  const source = JSON.parse(await readFile(join(sourceDirectory, filename), "utf8"));
  const description = source["minecraft:client_entity"]?.description;
  const identifier = description?.identifier;
  if (!identifier || entities.has(identifier)) continue;
  const texturePath = Object.values(description.textures ?? {}).find(value => typeof value === "string");
  let image;
  if (texturePath) {
    const candidates = [`${texturePath}.png`, `${texturePath}.tga`];
    for (const candidate of candidates) {
      const sourcePath = join(resourcePack, candidate);
      try {
        if (!(await stat(sourcePath)).isFile()) continue;
        const outputName = `${identifier.replace(/^minecraft:/, "").replace(/[^a-z0-9_-]/g, "_")}.png`;
        if (candidate.endsWith(".tga")) await sharp(sourcePath).png().toFile(join(outputDirectory, outputName));
        else await copyFile(sourcePath, join(outputDirectory, outputName));
        image = `./bedrock/entities/${outputName}`;
        break;
      } catch {}
    }
  }
  const localName = identifier.replace(/^minecraft:/, "");
  if (!image) {
    for (const fallbackName of [`spawn_egg_${localName}.png`, `egg_${localName}.png`]) {
      const spawnEgg = join(resourcePack, "textures", "items", fallbackName);
      try {
        if ((await stat(spawnEgg)).isFile()) {
          const outputName = `${localName.replace(/[^a-z0-9_-]/g, "_")}.png`;
          await copyFile(spawnEgg, join(outputDirectory, outputName));
          image = `./bedrock/entities/${outputName}`;
          break;
        }
      } catch {}
    }
  }
  if (!image) {
    const specialFallbacks = {
      "minecraft:ender_dragon":"textures/items/dragon_fireball.png",
      "minecraft:magma_cube":"textures/items/egg_lava_slime.png",
      "minecraft:trial_spawner":"textures/blocks/trial_spawner_side.png",
    };
    const fallback = specialFallbacks[identifier];
    if (fallback) {
      try {
        const outputName = `${localName.replace(/[^a-z0-9_-]/g, "_")}.png`;
        await copyFile(join(resourcePack, fallback), join(outputDirectory, outputName));
        image = `./bedrock/entities/${outputName}`;
      } catch {}
    }
  }
  entities.set(identifier, {
    id:identifier,
    name:localName.split("_").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" "),
    category:"Entities",
    kind:"entity",
    image,
    mob:Boolean(description.spawn_egg) || mobExceptions.has(identifier),
    defaultNbt:{ CustomName:"", Persistent:1 },
  });
}

const manualEntities = [
  ["minecraft:item", "Item", "textures/items/bundle.png"],
  ["minecraft:item_frame", "Item Frame", "textures/items/item_frame.png"],
  ["minecraft:glow_item_frame", "Glow Item Frame", "textures/items/glow_item_frame.png"],
  ["minecraft:painting", "Painting", "textures/painting/backyard.png"],
  ["minecraft:falling_block", "Falling Block", "textures/blocks/sand.png"],
  ["minecraft:primed_tnt", "Primed TNT", "textures/blocks/tnt_side.png"],
  ["minecraft:lightning_bolt", "Lightning Bolt", "textures/items/fireball.png"],
];
for (const [id, name, texture] of manualEntities) {
  if (entities.has(id)) continue;
  const outputName = `${id.replace(/^minecraft:/, "")}.png`;
  let image;
  try {
    await copyFile(join(resourcePack, texture), join(outputDirectory, outputName));
    image = `./bedrock/entities/${outputName}`;
  } catch {}
  entities.set(id, { id, name, category:"Entities", kind:"entity", image, mob:false, defaultNbt:{} });
}

await writeFile(
  resolve("public", "bedrock-entities.json"),
  `${JSON.stringify({ generatedFrom:sourceDirectory, references:["https://minecraft.wiki/w/Entity", "https://minecraft.wiki/w/Mob"], entities:[...entities.values()] }, null, 2)}\n`,
);
console.log(`Generated ${entities.size} Bedrock entities (${[...entities.values()].filter(entity => entity.mob).length} mobs).`);
