import fs from "node:fs";
import path from "node:path";

const SOURCE_URL = "https://raw.githubusercontent.com/MicrosoftDocs/minecraft-creator/main/creator/Reference/Content/VanillaListingsReference/Blocks.md";
const manifest = JSON.parse(fs.readFileSync(path.resolve("public/bedrock-blocks.json"), "utf8"));
const textureIds = new Set(manifest.blocks.map(block => block.id.replace(/^bedrock:/, "")));
const markdown = await fetch(SOURCE_URL).then(response => {
  if (!response.ok) throw new Error(`Could not download official block list (${response.status}).`);
  return response.text();
});
const officialBlocks = markdown.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\|\s*(minecraft:[a-z0-9_]+)\s*\|\s*(.*?)\s*\|$/);
  if (!match) return [];
  return [{ name:match[1], states:match[2].split(",").map(value => value.trim()).filter(Boolean) }];
});

function hasAny(candidates) {
  return candidates.some(candidate => textureIds.has(candidate));
}

function requirement(block, state, label, groups) {
  const missing = groups.filter(group => !hasAny(group.candidates));
  if (!missing.length) return null;
  return {
    block:block.name,
    state,
    label,
    missing:missing.map(group => `${group.label}: ${group.candidates.join(" / ")}`).join("; "),
  };
}

const missing = [];
for (const block of officialBlocks) {
  const local = block.name.replace(/^minecraft:/, "");
  const states = new Set(block.states);
  if (states.has("upper_block_bit")) {
    const genericDoor = local === "wooden_door";
    missing.push(requirement(block, "upper_block_bit", "upper/lower texture", [
      { label:"lower", candidates:genericDoor ? ["door_lower"] : [`${local}_bottom`, `${local}_lower`] },
      { label:"upper", candidates:genericDoor ? ["door_upper"] : [`${local}_top`, `${local}_upper`] },
    ]));
  }
  if (states.has("pillar_axis") && /(?:_log|_wood|_stem|_hyphae|bamboo_block|basalt|bone_block|deepslate|quartz)/.test(local)) {
    missing.push(requirement(block, "pillar_axis", "end/side faces", [
      { label:"end", candidates:[`${local}_top`, local.replace(/_(?:wood|hyphae)$/, "_log_top"), local] },
      { label:"side", candidates:[`${local}_side`, local.replace(/_(?:wood|hyphae)$/, "_log_side"), local] },
    ]));
  }
  if (states.has("extinguished")) {
    missing.push(requirement(block, "extinguished", "lit/unlit logs", [
      { label:"unlit", candidates:[`${local}_log`] },
      { label:"lit", candidates:[`${local}_log_lit`] },
    ]));
  }
  if (states.has("sculk_sensor_phase")) {
    missing.push(requirement(block, "sculk_sensor_phase", "active/inactive tendrils", [
      { label:"inactive", candidates:[`${local}_tendril_inactive`] },
      { label:"active", candidates:[`${local}_tendril_active`] },
    ]));
  }
  if (states.has("cauldron_liquid")) {
    missing.push(requirement(block, "cauldron_liquid", "liquid surfaces", [
      { label:"water", candidates:["cauldron_water"] },
      { label:"lava", candidates:["cauldron_lava"] },
      { label:"powder snow", candidates:["cauldron_powder_snow"] },
    ]));
  }
  if (states.has("head_piece_bit")) {
    missing.push(requirement(block, "head_piece_bit", "bed head/foot", [
      { label:"head", candidates:["bed_head_top", "bed_head"] },
      { label:"foot", candidates:["bed_feet_top", "bed_foot_top", "bed_feet"] },
    ]));
  }
  if (states.has("honey_level")) {
    missing.push(requirement(block, "honey_level", "honey-filled front", [
      { label:"honey", candidates:[`${local}_front_honey`, `${local}_honey`] },
    ]));
  }
  if (states.has("lit") && /copper_bulb$/.test(local)) {
    missing.push(requirement(block, "lit", "lit/unlit bulb", [
      { label:"unlit", candidates:[local] },
      { label:"lit", candidates:[`${local}_lit`, `${local}_on`] },
    ]));
  }
  const stagedState = block.states.find(state => /^(?:growth|bite_counter|books_stored|powered_shelf_type)$/.test(state));
  if (stagedState) {
    const variants = [...textureIds].filter(id => id === local || id.startsWith(`${local}_`));
    if (variants.length < 2) {
      missing.push({
        block:block.name,
        state:stagedState,
        label:"staged appearance",
        missing:`Only ${variants.length} local texture variant${variants.length === 1 ? "" : "s"} found`,
      });
    }
  }
}

const rows = missing.filter(Boolean).sort((a, b) => a.block.localeCompare(b.block) || a.state.localeCompare(b.state));
const report = `# Missing Bedrock state textures

Generated from the [official Microsoft Bedrock block/state listing](${SOURCE_URL}) and \`public/bedrock-blocks.json\`.

- Official blocks audited: ${officialBlocks.length}
- Local texture IDs audited: ${textureIds.size}
- State-sensitive gaps: ${rows.length}

Directional, hinge, open/closed, connection, slab-half, and stair-corner states are geometry/rotation concerns and are intentionally not reported as missing bitmap assets.

| Block | State | Appearance | Missing local texture evidence |
| --- | --- | --- | --- |
${rows.map(row => `| \`${row.block}\` | \`${row.state}\` | ${row.label} | ${row.missing} |`).join("\n")}
`;

fs.writeFileSync(path.resolve("MISSING_TEXTURES.md"), report);
console.log(`Audited ${officialBlocks.length} official blocks; wrote ${rows.length} gaps to MISSING_TEXTURES.md.`);
