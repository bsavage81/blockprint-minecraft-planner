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
  minecraftName?: string;
  minecraftStates?: Record<string, BlockStateValue>;
  stateDefinitions?: BlockStateDefinition[];
  sourceRotation?: number;
  legacyAlias?: boolean;
};

const FACE_SUFFIXES: [RegExp, keyof NonNullable<CatalogBlock["textures"]>][] = [
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
  const aliases: Record<string, string> = {
    brick: "bricks",
    cobblestone_mossy: "mossy_cobblestone",
    endstone: "end_stone",
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
      { name: "weirdo_direction", values: [0, 1, 2, 3] },
      { name: "upside_down_bit", values: [false, true] },
    ];
  }
  if (/_door$/.test(name)) {
    return [
      { name: "cardinal_direction", values: ["north", "east", "south", "west"] },
      { name: "open_bit", values: [false, true] },
      { name: "door_hinge_bit", values: [false, true] },
      { name: "upper_block_bit", values: [false, true] },
    ];
  }
  if (/_trapdoor$/.test(name)) {
    return [
      { name: "cardinal_direction", values: ["north", "east", "south", "west"] },
      { name: "open_bit", values: [false, true] },
      { name: "upside_down_bit", values: [false, true] },
    ];
  }
  if (/(?:furnace|observer|dispenser|dropper|piston|chest|barrel|beehive|bee_nest)$/.test(name)) {
    return [{ name: "cardinal_direction", values: ["north", "east", "south", "west"] }];
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
    if (existing) {
      if (textureBlock.textureUrl) existing.textures![face] = textureBlock.textureUrl;
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
      legacyAlias:true,
    } : { ...block, legacyAlias:true };
  });
  return [...canonicalBlocks, ...aliases];
}

export function textureForFace(block: CatalogBlock | undefined, face: "up" | "down" | "north" | "south" | "east" | "west" = "up") {
  if (!block) return undefined;
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
