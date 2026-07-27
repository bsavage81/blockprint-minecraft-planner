import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const api = "https://minecraft.wiki/api.php";
const headers = { "User-Agent":"Blockprint Minecraft planner/1.0 (local asset catalog)" };
const normalize = value => value.toLowerCase().replace(/^file:/, "").replace(/\.(?:png|gif|jpe?g|webp)$/i, "").replace(/face$/, "").replace(/[^a-z0-9]/g, "");
const aliases = {
  camel_husk:"camel",
  evocation_illager:"evoker",
  mooshroom:"redmooshroom",
  parched:"husk",
  sulfur_cube:"magmacube",
  tropicalfish:"tropicalfish",
  villager_v2:"villager",
  zombie_nautilus:"nautilus",
  zombie_pigman:"zombifiedpiglin",
  zombie_villager_v2:"zombievillager",
};
const directTitles = {
  agent:"File:AgentFace.png",
  cod:"File:Cod face.png",
  creaking:"File:CreakingFace.png",
  creeper:"File:CreeperFace.png",
  dolphin:"File:DolphinFace.png",
  goat:"File:GoatFace.png",
  guardian:"File:GuardianFace.png",
  hoglin:"File:HoglinFace.png",
  nautilus:"File:EntitySprite nautilus.png",
  npc:"File:NPCFace.png",
  salmon:"File:EntitySprite salmon.png",
  tropicalfish:"File:EntitySprite tropical-fish.png",
  zoglin:"File:ZoglinFace.png",
  zombie_nautilus:"File:EntitySprite zombie-nautilus.png",
};

async function wikiJson(parameters) {
  const url = new URL(api);
  Object.entries({ format:"json", origin:"*", ...parameters }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Minecraft Wiki API returned ${response.status}.`);
  return response.json();
}

const files = [];
let continuation;
do {
  const result = await wikiJson({
    action:"query",
    list:"categorymembers",
    cmtitle:"Category:Mob faces",
    cmtype:"file",
    cmlimit:"500",
    ...(continuation ? { cmcontinue:continuation } : {}),
  });
  files.push(...result.query.categorymembers.map(member => member.title));
  continuation = result.continue?.cmcontinue;
} while (continuation);

const fileByName = new Map(files.map(title => [normalize(title), title]));
const catalogPath = resolve("public", "bedrock-entities.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const matches = new Map();
for (const entity of catalog.entities.filter(entity => entity.mob)) {
  const localName = entity.id.replace(/^minecraft:/, "");
  const candidates = [localName, aliases[localName]].filter(Boolean).map(normalize);
  const title = candidates.map(candidate => fileByName.get(candidate)).find(Boolean) ?? directTitles[localName];
  if (title) matches.set(entity.id, title);
}

const imageUrls = new Map();
const titles = [...new Set(matches.values())];
for (let index = 0; index < titles.length; index += 50) {
  const result = await wikiJson({
    action:"query",
    prop:"imageinfo",
    iiprop:"url",
    iiurlwidth:"128",
    titles:titles.slice(index, index + 50).join("|"),
  });
  for (const page of Object.values(result.query.pages)) {
    const info = page.imageinfo?.[0];
    if (info) imageUrls.set(page.title, info.thumburl ?? info.url);
  }
}

let downloaded = 0;
for (const entity of catalog.entities) {
  const title = matches.get(entity.id);
  const url = title ? imageUrls.get(title) : undefined;
  if (!url) continue;
  const response = await fetch(url, { headers });
  if (!response.ok) continue;
  const output = resolve("public", "bedrock", "entities", `${entity.id.replace(/^minecraft:/, "")}.png`);
  await sharp(Buffer.from(await response.arrayBuffer())).png().toFile(output);
  entity.image = `./bedrock/entities/${entity.id.replace(/^minecraft:/, "")}.png`;
  entity.imageSource = `https://minecraft.wiki/w/File:${encodeURIComponent(title.replace(/^File:/, ""))}`;
  downloaded++;
}

catalog.references = [...new Set([...(catalog.references ?? []), "https://minecraft.wiki/w/Category:Mob_faces"])];
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Downloaded ${downloaded} wiki mob face images; ${catalog.entities.filter(entity => entity.mob).length - downloaded} mobs kept their vanilla fallback.`);
