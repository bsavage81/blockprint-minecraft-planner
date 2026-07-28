import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultNbtForEntity, ENTITY_FORMAT_REFERENCE } from "./entity-default-nbt.mjs";

const filename = resolve("public", "bedrock-entities.json");
const catalog = JSON.parse(await readFile(filename, "utf8"));
catalog.references = [...new Set([...(catalog.references ?? []), ENTITY_FORMAT_REFERENCE])];
catalog.entities = (catalog.entities ?? []).map(entity => ({
  ...entity,
  defaultNbt:defaultNbtForEntity(entity.id, Boolean(entity.mob), entity.defaultNbt),
}));
await writeFile(filename, `${JSON.stringify(catalog, null, 2)}\n`);
