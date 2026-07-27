export type BlockStateValue = string | number | boolean;

export type BlockStateDefinition = {
  name: string;
  values: BlockStateValue[];
};

export type CatalogBlock = {
  id: string;
  name: string;
  category: string;
  color?: string;
  texture?: string;
  textureUrl?: string;
  textures?: Partial<Record<"up" | "down" | "north" | "south" | "east" | "west" | "side", string>>;
  textureVariants?: Record<string, string>;
  textureRefs?: Partial<Record<"up" | "down" | "north" | "south" | "east" | "west" | "side", string>>;
  minecraftName?: string;
  minecraftStates?: Record<string, BlockStateValue>;
  stateDefinitions?: BlockStateDefinition[];
  sourceRotation?: number;
  legacyAlias?: boolean;
  officialStates?: string[];
  textureMatch?: "exact" | "material" | "missing";
};

export type OfficialBlock = { name: string; states: string[] };

const FACE_SUFFIXES: [RegExp, keyof NonNullable<CatalogBlock["textures"]>][] = [
  [/_upper$/, "side"],
  [/_lower$/, "side"],
  [/_top(?:_\w+)?$/, "up"],
  [/_bottom(?:_\w+)?$/, "down"],
  [/_front(?:_\w+)?$/, "north"],
  [/_back(?:_\w+)?$/, "south"],
  [/_side(?:\d|_\w+)?$/, "side"],
];

const NON_BLOCK_SUFFIXES = /_(?:on|off|lit|powered|open|closed|carried)$/;

export function canonicalNameFromTexture(textureId: string) {
  let name = textureId.replace(/^[^:]+:/, "");
  for (const [pattern] of FACE_SUFFIXES) name = name.replace(pattern, "");
  name = name.replace(NON_BLOCK_SUFFIXES, "");
  name = name
    .replace(/^(soul_)?campfire_(?:log|fire)$/, "$1campfire")
    .replace(/^(calibrated_)?sculk_sensor_(?:tendril_active|tendril_inactive|amethyst|input_side)$/, "$1sculk_sensor")
    .replace(/^cauldron_(?:water|lava|powder_snow|inner)$/, "cauldron");
  const aliases: Record<string, string> = {
    brick: "bricks",
    concrete: "white_concrete",
    cobblestone_mossy: "mossy_cobblestone",
    endstone: "end_stone",
    door: "wooden_door",
    grass: "grass_block",
    log_oak: "oak_log",
    planks: "oak_planks",
    still_lava: "lava",
    flowing_lava: "lava",
    still_water: "water",
    flowing_water: "water",
  };
  return aliases[name] ?? name;
}

function fallbackColor(name: string) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 22% 48%)`;
}

function materialCandidates(localName: string) {
  const candidates = [localName];
  const withoutLit = localName.replace(/^lit_/, "");
  if (withoutLit !== localName) candidates.push(withoutLit);
  const base = withoutLit.replace(
    /_(?:double_slab|slab|stairs|wall|button|pressure_plate|fence_gate|fence|standing_sign|wall_sign|hanging_sign)$/,
    "",
  );
  if (base !== withoutLit) candidates.push(base, `${base}_planks`);
  const wood = localName.match(/^(acacia|bamboo|birch|cherry|crimson|dark_oak|jungle|mangrove|oak|pale_oak|spruce|warped)_/);
  if (wood) candidates.push(`${wood[1]}_planks`);
  if (/^wooden_(?:button|door|pressure_plate)$/.test(localName)) candidates.push("oak_planks");
  if (localName === "white_concrete_powder") candidates.push("white_concrete");
  return [...new Set(candidates)];
}

function faceFromTexture(textureId: string): keyof NonNullable<CatalogBlock["textures"]> {
  const local = textureId.replace(/^[^:]+:/, "");
  for (const [pattern, face] of FACE_SUFFIXES) if (pattern.test(local)) return face;
  return "side";
}

function title(value: string) {
  return value.split("_").map(word => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

export const CATALOG_CATEGORY_ORDER = [
  "Entities",
  "Wood",
  "Stone",
  "Nature",
  "Ores & Minerals",
  "Color",
  "Glass",
  "Nether & End",
  "Redstone",
  "Utility",
  "Other",
] as const;

export function categoryForBlockName(name: string) {
  const localName = name.replace(/^minecraft:/, "");
  if (
    /^(?:acacia|bamboo|birch|cherry|crimson|dark_oak|jungle|mangrove|oak|pale_oak|spruce|warped)_/.test(localName) ||
    /(?:^|_)(?:wood|wooden|log|planks|stem|hyphae|bamboo_mosaic)(?:_|$)/.test(localName)
  ) return "Wood";
  if (/(?:concrete|terracotta|wool|carpet|glazed|candle|banner|shulker_box|bed$)/.test(localName)) return "Color";
  if (/(?:glass|stained_glass)/.test(localName)) return "Glass";
  if (
    /(?:_ore$|coal|iron|copper|gold|diamond|emerald|lapis|redstone_block|amethyst|raw_|ancient_debris|netherite)/.test(localName)
  ) return "Ores & Minerals";
  if (/(?:nether|end_|purpur|chorus|soul_|magma|glowstone|crying_obsidian)/.test(localName)) return "Nether & End";
  if (
    /(?:redstone|repeater|comparator|observer|piston|dispenser|dropper|hopper|lever|button|pressure_plate|tripwire|daylight_detector|target|crafter|rail|sculk_sensor)/.test(localName)
  ) return "Redstone";
  if (
    /(?:stone|cobble|deepslate|granite|diorite|andesite|tuff|calcite|dripstone|brick|quartz|sandstone|mud_brick|terracotta|concrete|prismarine|obsidian|basalt|blackstone|bedrock)/.test(localName)
  ) return "Stone";
  if (
    /(?:grass|dirt|mud|sand|gravel|clay|snow|ice|water|lava|leaves|sapling|flower|bush|fern|vine|moss|azalea|mushroom|fungus|roots|crop|wheat|carrot|potato|beetroot|cactus|sugar_cane|kelp|coral|sponge|lily|seagrass|bamboo|pumpkin|melon|gourd|hay|podzol|mycelium|nylium|sculk|egg)/.test(localName)
  ) return "Nature";
  if (
    /(?:door|trapdoor|fence|gate|wall|slab|stairs|sign|ladder|torch|lantern|chest|barrel|furnace|smoker|blast_furnace|crafting|table|anvil|grindstone|loom|stonecutter|cartography|smithing|brewing|cauldron|bookshelf|lectern|enchanting|beacon|conduit|campfire|bell|chain|lightning_rod|scaffolding|flower_pot|skull|head|frame|painting|jukebox|note_block|tnt)/.test(localName)
  ) return "Utility";
  return "Other";
}

export function stateDefinitionsFor(name: string): BlockStateDefinition[] {
  if (/(?:_log|_wood|_stem|_hyphae|pillar|bone_block|basalt)$/.test(name)) {
    return [{ name: "pillar_axis", values: ["y", "x", "z"] }];
  }
  if (/_stairs$/.test(name)) {
    return [
      { name: "minecraft:corner", values: ["none", "inner_left", "inner_right", "outer_left", "outer_right"] },
      { name: "weirdo_direction", values: [0, 1, 2, 3] },
      { name: "upside_down_bit", values: [false, true] },
    ];
  }
  if (/_door$/.test(name)) {
    return [
      { name: "minecraft:cardinal_direction", values: ["north", "east", "south", "west"] },
      { name: "open_bit", values: [false, true] },
      { name: "door_hinge_bit", values: [false, true] },
      { name: "upper_block_bit", values: [false, true] },
    ];
  }
  if (/_trapdoor$/.test(name)) {
    return [
      { name: "direction", values: [0, 1, 2, 3] },
      { name: "open_bit", values: [false, true] },
      { name: "upside_down_bit", values: [false, true] },
    ];
  }
  if (/(?:^|_)campfire$/.test(name)) {
    return [
      { name:"minecraft:cardinal_direction", values:["north", "east", "south", "west"] },
      { name:"extinguished", values:[false, true] },
    ];
  }
  if (name === "sculk_sensor") {
    return [{ name:"sculk_sensor_phase", values:["inactive", "active", "cooldown"] }];
  }
  if (name === "calibrated_sculk_sensor") {
    return [
      { name:"minecraft:cardinal_direction", values:["north", "east", "south", "west"] },
      { name:"sculk_sensor_phase", values:["inactive", "active", "cooldown"] },
    ];
  }
  if (name === "cauldron") {
    return [
      { name:"cauldron_liquid", values:["water", "lava", "powder_snow"] },
      { name:"fill_level", values:[0, 1, 2, 3, 4, 5, 6] },
    ];
  }
  if (/(?:beehive|bee_nest)$/.test(name)) {
    return [
      { name:"direction", values:[0, 1, 2, 3] },
      { name:"honey_level", values:[0, 1, 2, 3, 4, 5] },
    ];
  }
  if (name === "bed") {
    return [
      { name:"direction", values:[0, 1, 2, 3] },
      { name:"head_piece_bit", values:[false, true] },
      { name:"occupied_bit", values:[false, true] },
    ];
  }
  if (/(?:furnace|observer|dispenser|dropper|piston|chest|barrel)$/.test(name)) {
    return [{ name: "minecraft:cardinal_direction", values: ["north", "east", "south", "west"] }];
  }
  return [];
}

function defaultStates(definitions: BlockStateDefinition[]) {
  return Object.fromEntries(definitions.map(definition => [definition.name, definition.values[0]]));
}

function officialStateDefinitions(
  localName: string,
  officialStates: string[],
  textureBlock?: CatalogBlock,
) {
  const definitions = stateDefinitionsFor(localName);
  const known = new Set(definitions.map(definition => definition.name));
  const add = (name: string, values: BlockStateValue[]) => {
    if (officialStates.includes(name) && !known.has(name)) {
      definitions.push({ name, values });
      known.add(name);
    }
  };
  const variantIndices = Object.keys(textureBlock?.textureVariants ?? {})
    .map(key => Number(key.match(/#(\d+)$/)?.[1]))
    .filter(Number.isFinite);
  const variantMax = Math.max(0, ...variantIndices);
  add("growth", Array.from({ length:Math.max(8, variantMax + 1) }, (_, index) => index));
  add("age", Array.from({ length:16 }, (_, index) => index));
  add("bite_counter", Array.from({ length:7 }, (_, index) => index));
  add("honey_level", Array.from({ length:6 }, (_, index) => index));
  for (const state of ["upper_block_bit", "head_piece_bit", "occupied_bit", "lit", "active", "open_bit"]) {
    add(state, [false, true]);
  }
  return definitions;
}

export function buildStateAwareCatalog(textureBlocks: CatalogBlock[], officialBlocks: OfficialBlock[] = []) {
  const canonical = new Map<string, CatalogBlock>();
  for (const textureBlock of textureBlocks) {
    const localName = textureBlock.minecraftName?.replace(/^minecraft:/, "") ?? canonicalNameFromTexture(textureBlock.id);
    if (!localName || /(?:placeholder|missing|debug|destroy_stage|breaking|particle)/.test(localName)) continue;
    const minecraftName = `minecraft:${localName}`;
    const existing = canonical.get(minecraftName);
    const face = faceFromTexture(textureBlock.id);
    const textureId = textureBlock.id.replace(/^[^:]+:/, "");
    if (existing) {
      Object.assign(existing.textures ??= {}, textureBlock.textures ?? (textureBlock.textureUrl ? { [face]:textureBlock.textureUrl } : {}));
      Object.assign(existing.textureVariants ??= {}, textureBlock.textureVariants ?? (textureBlock.textureUrl ? { [textureId]:textureBlock.textureUrl } : {}));
      Object.assign(existing.textureRefs ??= {}, textureBlock.textureRefs ?? {});
      continue;
    }
    const stateDefinitions = stateDefinitionsFor(localName);
    canonical.set(minecraftName, {
      ...textureBlock,
      id: minecraftName,
      name: title(localName),
      minecraftName,
      minecraftStates: defaultStates(stateDefinitions),
      stateDefinitions,
      textures:textureBlock.textures ?? (textureBlock.textureUrl ? { [face]:textureBlock.textureUrl } : undefined),
      textureVariants:textureBlock.textureVariants ?? (textureBlock.textureUrl ? { [textureId]:textureBlock.textureUrl } : undefined),
      textureRefs:textureBlock.textureRefs,
    });
  }

  const textureCanonicalBlocks = [...canonical.values()].map(block => ({
    ...block,
    textureUrl: textureForFace(block, "up"),
  }));
  const byName = new Map(textureCanonicalBlocks.map(block => [block.minecraftName, block]));
  const canonicalBlocks = officialBlocks.length ? officialBlocks.map(official => {
    const localName = official.name.replace(/^minecraft:/, "");
    const exact = byName.get(official.name);
    const material = exact ?? materialCandidates(localName)
      .map(candidate => byName.get(`minecraft:${candidate}`))
      .find(Boolean);
    const stateDefinitions = officialStateDefinitions(localName, official.states, material);
    return {
      ...(material ?? {}),
      id:official.name,
      name:title(localName),
      category:categoryForBlockName(localName),
      color:material?.color ?? fallbackColor(localName),
      minecraftName:official.name,
      minecraftStates:defaultStates(stateDefinitions),
      stateDefinitions,
      officialStates:official.states,
      legacyAlias:false,
      textureMatch:exact ? "exact" as const : material ? "material" as const : "missing" as const,
      textureUrl:material ? textureForFace(material, "up") : undefined,
    };
  }) : textureCanonicalBlocks;
  const officialByName = new Map(canonicalBlocks.map(block => [block.minecraftName, block]));
  const aliases = textureBlocks.map(block => {
    const inferredName = `minecraft:${canonicalNameFromTexture(block.id)}`;
    const target = officialByName.get(inferredName) ?? byName.get(inferredName);
    return target ? {
      ...target,
      ...block,
      minecraftName:target.minecraftName,
      minecraftStates:target.minecraftStates,
      stateDefinitions:target.stateDefinitions,
      textures:target.textures,
      textureVariants:target.textureVariants,
      textureRefs:target.textureRefs,
      legacyAlias:true,
    } : { ...block, legacyAlias:true };
  });
  return [...canonicalBlocks, ...aliases];
}

export function textureForFace(block: CatalogBlock | undefined, face: "up" | "down" | "north" | "south" | "east" | "west" = "up") {
  if (!block) return undefined;
  const localName = block.minecraftName?.replace(/^minecraft:/, "") ?? canonicalNameFromTexture(block.id);
  const states = block.minecraftStates ?? {};
  const variants = block.textureVariants ?? {};
  const firstVariant = (...names: string[]) => {
    for (const name of names) {
      if (!name) continue;
      if (variants[name]) return variants[name];
      if (variants[`${name}#0`]) return variants[`${name}#0`];
    }
    return undefined;
  };
  const stagedValue = states.growth ?? states.age ?? states.bite_counter ?? states.fill_level;
  const stagedRef = block.textureRefs?.[face] ?? block.textureRefs?.side ?? block.textureRefs?.up;
  if (stagedRef && typeof stagedValue === "number") {
    const available = Object.keys(variants)
      .filter(key => key.startsWith(`${stagedRef}#`))
      .map(key => Number(key.slice(stagedRef.length + 1)))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (available.length > 1) {
      const index = Math.min(Math.max(0, stagedValue), available[available.length - 1]);
      const stagedTexture = variants[`${stagedRef}#${index}`];
      if (stagedTexture) return stagedTexture;
    }
  }
  if (/_door$/.test(localName)) {
    const upper = Boolean(states.upper_block_bit);
    const stateTexture = upper
      ? block.textures?.side ?? firstVariant(`${localName}_top`, `${localName}_upper`, localName === "wooden_door" ? "door_upper" : "")
      : block.textures?.up ?? block.textures?.down ?? firstVariant(`${localName}_bottom`, `${localName}_lower`, localName === "wooden_door" ? "door_lower" : "");
    if (stateTexture) return stateTexture;
  }
  if (/(?:^|_)campfire$/.test(localName)) {
    const stateTexture = Boolean(states.extinguished)
      ? firstVariant(`${localName}_log`)
      : firstVariant(`${localName}_log_lit`);
    if (stateTexture) return stateTexture;
  }
  if (localName === "sculk_sensor" || localName === "calibrated_sculk_sensor") {
    const phase = String(states.sculk_sensor_phase ?? "inactive");
    const stateTexture = firstVariant(`${localName}_tendril_${phase === "inactive" ? "inactive" : "active"}`);
    if (stateTexture) return stateTexture;
  }
  if (localName === "cauldron" && Number(states.fill_level ?? 0) > 0) {
    const stateTexture = firstVariant(`cauldron_${String(states.cauldron_liquid ?? "water")}`);
    if (stateTexture) return stateTexture;
  }
  const textures = block.textures;
  if (!textures) return block.textureUrl;
  const axis = String(block.minecraftStates?.pillar_axis ?? block.minecraftStates?.axis ?? "y");
  if ((axis === "x" || axis === "z") && face === "up") return textures.side ?? textures.north ?? block.textureUrl;
  return textures[face] ?? (face === "up" ? textures.up : undefined) ?? textures.side ?? textures.north ?? Object.values(textures)[0] ?? block.textureUrl;
}

export function variantId(minecraftName: string, states: Record<string, BlockStateValue>) {
  const stateKey = Object.entries(states).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`).join(",");
  return `${minecraftName}[${stateKey}]`;
}

export function statesEqual(
  left: Record<string, BlockStateValue> = {},
  right: Record<string, BlockStateValue> = {},
) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

export function catalogNameForImportedBlock(
  minecraftName: string,
  states: Record<string, BlockStateValue> = {},
) {
  const localName = minecraftName.replace(/^minecraft:/, "");
  const woodType = String(states.wood_type ?? states.old_log_type ?? states.new_log_type ?? "");
  const color = String(states.color ?? "");
  if ((localName === "log" || localName === "log2") && woodType) return `minecraft:${woodType}_log`;
  if (localName === "planks" && woodType) return `minecraft:${woodType}_planks`;
  if (["wool", "carpet", "concrete", "concrete_powder", "stained_glass"].includes(localName) && color) {
    return `minecraft:${color}_${localName}`;
  }
  const stoneType = String(states.stone_type ?? "");
  if (localName === "stone" && stoneType && stoneType !== "stone") return `minecraft:${stoneType}`;
  return minecraftName.startsWith("minecraft:") ? minecraftName : `minecraft:${localName}`;
}

export function matchCatalogBlock(
  catalog: CatalogBlock[],
  minecraftName: string,
  states: Record<string, BlockStateValue> = {},
) {
  const catalogName = catalogNameForImportedBlock(minecraftName, states);
  return catalog.find(block => !block.legacyAlias && block.minecraftName === catalogName);
}

export function rotationFromBlockStates(states: Record<string, BlockStateValue>) {
  const cardinal = String(
    states.cardinal_direction ??
    states.minecraft_cardinal_direction ??
    states["minecraft:cardinal_direction"] ??
    "",
  ).toLowerCase();
  const cardinalRotations: Record<string, number> = { north:0, east:90, south:180, west:270 };
  if (cardinal in cardinalRotations) return cardinalRotations[cardinal];
  const facing = Number(states.facing_direction);
  if (Number.isFinite(facing)) return ({ 2:0, 5:90, 3:180, 4:270 } as Record<number, number>)[facing] ?? 0;
  const direction = Number(states.direction);
  if (Number.isFinite(direction)) return ({ 0:180, 1:270, 2:0, 3:90 } as Record<number, number>)[direction] ?? 0;
  const stairDirection = Number(states.weirdo_direction);
  if (Number.isFinite(stairDirection)) return ({ 0:90, 1:270, 2:180, 3:0 } as Record<number, number>)[stairDirection] ?? 0;
  const signDirection = Number(states.ground_sign_direction);
  if (Number.isFinite(signDirection)) return (signDirection % 16) * 22.5;
  return String(states.pillar_axis ?? states.axis ?? "").toLowerCase() === "x" ? 90 : 0;
}

export function rotateBlockStates(states: Record<string, BlockStateValue>, degrees: number) {
  const rotated = { ...states };
  const steps = ((degrees % 360) + 360) % 360 / 90;
  if (!Number.isInteger(steps)) return rotated;
  const rotateValue = <T extends string | number>(key: string, values: T[]) => {
    const value = rotated[key];
    const start = values.indexOf(value as T);
    if (start >= 0) rotated[key] = values[(start + steps) % values.length];
  };
  rotateValue("cardinal_direction", ["north", "east", "south", "west"]);
  rotateValue("minecraft_cardinal_direction", ["north", "east", "south", "west"]);
  rotateValue("minecraft:cardinal_direction", ["north", "east", "south", "west"]);
  rotateValue("facing_direction", [2, 5, 3, 4]);
  rotateValue("direction", [2, 3, 0, 1]);
  rotateValue("weirdo_direction", [3, 0, 2, 1]);
  const axisKey = "pillar_axis" in rotated ? "pillar_axis" : "axis" in rotated ? "axis" : null;
  if (axisKey && steps % 2 === 1 && (rotated[axisKey] === "x" || rotated[axisKey] === "z")) {
    rotated[axisKey] = rotated[axisKey] === "x" ? "z" : "x";
  }
  return rotated;
}
