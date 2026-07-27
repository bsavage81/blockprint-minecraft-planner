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
  minecraftName?: string;
  minecraftStates?: Record<string, BlockStateValue>;
  stateDefinitions?: BlockStateDefinition[];
  sourceRotation?: number;
  legacyAlias?: boolean;
};

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

function faceFromTexture(textureId: string): keyof NonNullable<CatalogBlock["textures"]> {
  const local = textureId.replace(/^[^:]+:/, "");
  for (const [pattern, face] of FACE_SUFFIXES) if (pattern.test(local)) return face;
  return "side";
}

function title(value: string) {
  return value.split("_").map(word => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
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

export function buildStateAwareCatalog(textureBlocks: CatalogBlock[]) {
  const canonical = new Map<string, CatalogBlock>();
  for (const textureBlock of textureBlocks) {
    const localName = canonicalNameFromTexture(textureBlock.id);
    if (!localName || /(?:placeholder|missing|debug|destroy_stage|breaking|particle)/.test(localName)) continue;
    const minecraftName = `minecraft:${localName}`;
    const existing = canonical.get(minecraftName);
    const face = faceFromTexture(textureBlock.id);
    const textureId = textureBlock.id.replace(/^[^:]+:/, "");
    if (existing) {
      if (textureBlock.textureUrl) existing.textures![face] = textureBlock.textureUrl;
      if (textureBlock.textureUrl) existing.textureVariants![textureId] = textureBlock.textureUrl;
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
      textures: textureBlock.textureUrl ? { [face]: textureBlock.textureUrl } : undefined,
      textureVariants:textureBlock.textureUrl ? { [textureId]:textureBlock.textureUrl } : undefined,
    });
  }

  const canonicalBlocks = [...canonical.values()].map(block => ({
    ...block,
    textureUrl: textureForFace(block, "up"),
  }));
  const byName = new Map(canonicalBlocks.map(block => [block.minecraftName, block]));
  const aliases = textureBlocks.map(block => {
    const target = byName.get(`minecraft:${canonicalNameFromTexture(block.id)}`);
    return target ? {
      ...target,
      ...block,
      minecraftName:target.minecraftName,
      minecraftStates:target.minecraftStates,
      stateDefinitions:target.stateDefinitions,
      textures:target.textures,
      textureVariants:target.textureVariants,
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
    for (const name of names) if (name && variants[name]) return variants[name];
    return undefined;
  };
  if (/_door$/.test(localName)) {
    const upper = Boolean(states.upper_block_bit);
    const stateTexture = upper
      ? firstVariant(`${localName}_top`, `${localName}_upper`, localName === "wooden_door" ? "door_upper" : "")
      : firstVariant(`${localName}_bottom`, `${localName}_lower`, localName === "wooden_door" ? "door_lower" : "");
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
