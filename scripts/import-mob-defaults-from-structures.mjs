import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { read as readNbt } from "nbtify";

const structureFiles = process.argv.slice(2);
if (!structureFiles.length) throw new Error("Pass one or more in-game .mcstructure files.");

function plainNbt(value) {
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  if (Array.isArray(value)) return value.map(plainNbt);
  if (value && typeof value === "object") {
    if ("valueOf" in value && value.valueOf() !== value && typeof value.valueOf() !== "object") return value.valueOf();
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainNbt(child)]));
  }
  return value;
}

function completeness(value) {
  if (Array.isArray(value)) return 1 + value.reduce((total, child) => total + completeness(child), 0);
  if (value && typeof value === "object") {
    return 1 + Object.values(value).reduce((total, child) => total + completeness(child), 0);
  }
  return 1;
}

const templates = new Map();
for (const structureFile of structureFiles) {
  const parsed = await readNbt(await readFile(structureFile), { endian:"little", compression:null });
  const entities = parsed.data?.structure?.entities ?? [];
  for (const entry of entities) {
    const source = entry.nbt && typeof entry.nbt === "object" ? entry.nbt : entry;
    const identifier = String(source.identifier ?? "");
    if (!identifier) continue;
    const nbt = plainNbt(Object.fromEntries(Object.entries(source)
      .filter(([key]) => !["identifier", "Pos", "Rotation", "UniqueID"].includes(key))));
    nbt.Air = 300;
    nbt.Motion = [0, 0, 0];
    const candidate = { nbt, score:completeness(nbt), source:structureFile.split(/[\\/]/).at(-1) };
    if (!templates.has(identifier) || candidate.score > templates.get(identifier).score) templates.set(identifier, candidate);
  }
}

const catalogFilename = resolve("public", "bedrock-entities.json");
const catalog = JSON.parse(await readFile(catalogFilename, "utf8"));
let applied = 0;
catalog.entities = catalog.entities.map(entity => {
  const template = entity.mob ? templates.get(entity.id) : undefined;
  if (!template) return entity;
  applied++;
  return {
    ...entity,
    defaultNbt:template.nbt,
    defaultNbtSource:`in-game:${template.source}`,
  };
});
catalog.defaultNbtReferences = structureFiles.map(filename => filename.split(/[\\/]/).at(-1));
await writeFile(catalogFilename, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Applied in-game NBT defaults to ${applied} cataloged mobs from ${templates.size} entity identifiers.`);
