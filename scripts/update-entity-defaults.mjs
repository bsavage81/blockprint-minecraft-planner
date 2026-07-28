import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import JSON5 from "json5";
import { defaultNbtForEntity, ENTITY_FORMAT_REFERENCE, mobDefaultsFromBehavior } from "./entity-default-nbt.mjs";

const filename = resolve("public", "bedrock-entities.json");
const catalog = JSON.parse(await readFile(filename, "utf8"));
const behaviorDirectory = process.argv[2];
const behaviorById = new Map();
if (behaviorDirectory) {
  for (const relative of await readdir(behaviorDirectory, { recursive:true })) {
    if (!relative.endsWith(".json")) continue;
    try {
      const definition = JSON5.parse(await readFile(join(behaviorDirectory, relative), "utf8"));
      const identifier = definition["minecraft:entity"]?.description?.identifier;
      if (identifier) behaviorById.set(identifier, definition);
    } catch {}
  }
}
catalog.references = [...new Set([...(catalog.references ?? []), ENTITY_FORMAT_REFERENCE])];
catalog.entities = (catalog.entities ?? []).map(entity => ({
  ...entity,
  defaultNbt:defaultNbtForEntity(
    entity.id,
    Boolean(entity.mob),
    entity.mob && behaviorById.has(entity.id) ? mobDefaultsFromBehavior(entity.id, behaviorById.get(entity.id)) : {},
  ),
}));
await writeFile(filename, `${JSON.stringify(catalog, null, 2)}\n`);
