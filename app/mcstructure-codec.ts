import { Int32, TAG, TAG_TYPE, read as readNbt, write as writeNbt } from "nbtify";
type BlockStateValue = string | number | boolean;

export type StructureVariant = {
  name: string;
  states: Record<string, BlockStateValue>;
};

export type StructureModel = {
  width: number;
  height: number;
  depth: number;
  blocks: (StructureVariant | null)[][]; // layers, row-major X/Z cells
};

function typedNbtList<T>(values: T[], type: TAG) {
  Object.defineProperty(values, TAG_TYPE, { value:type, enumerable:false });
  return values;
}

function primitive(value: unknown, key = ""): BlockStateValue | undefined {
  const unwrapped = value && typeof value === "object" && "valueOf" in value ? value.valueOf() : value;
  if (/_bit$/.test(key) && (unwrapped === 0 || unwrapped === 1)) return Boolean(unwrapped);
  return typeof unwrapped === "string" || typeof unwrapped === "number" || typeof unwrapped === "boolean" ? unwrapped : undefined;
}

function typedStates(states: Record<string, BlockStateValue>) {
  return Object.fromEntries(Object.entries(states).map(([key, value]) => [key, typeof value === "number" ? new Int32(value) : value]));
}

export async function encodeMcstructure(model: StructureModel) {
  const palette: StructureVariant[] = [{ name:"minecraft:air", states:{} }];
  const indices = new Map<string, number>([["minecraft:air|{}", 0]]);
  const paletteIndex = (variant: StructureVariant | null) => {
    if (!variant) return 0;
    const signature = `${variant.name}|${JSON.stringify(Object.entries(variant.states).sort(([a], [b]) => a.localeCompare(b)))}`;
    const known = indices.get(signature);
    if (known !== undefined) return known;
    const next = palette.length;
    palette.push(variant);
    indices.set(signature, next);
    return next;
  };
  const primary: Int32[] = [];
  const secondary: Int32[] = [];
  for (let x = 0; x < model.width; x++) {
    for (let y = 0; y < model.height; y++) {
      for (let z = 0; z < model.depth; z++) {
        primary.push(new Int32(paletteIndex(model.blocks[y]?.[z * model.width + x] ?? null)));
        secondary.push(new Int32(-1));
      }
    }
  }
  const root = {
    format_version:new Int32(1),
    size:[new Int32(model.width), new Int32(model.height), new Int32(model.depth)],
    structure:{
      block_indices:[primary, secondary],
      entities:typedNbtList<Record<string, unknown>>([], TAG.COMPOUND),
      palette:{ default:{
        block_palette:palette.map(entry => ({ name:entry.name, states:typedStates(entry.states), version:new Int32(18168865) })),
        block_position_data:{},
      } },
    },
    structure_world_origin:[new Int32(0), new Int32(0), new Int32(0)],
  };
  return writeNbt(root, { endian:"little", compression:null, rootName:"" });
}

export async function decodeMcstructure(binary: ArrayBuffer | Uint8Array): Promise<StructureModel> {
  const parsed = await readNbt(binary, { endian:"little", compression:null });
  const root = parsed.data as unknown as Record<string, unknown>;
  const size = root.size as unknown[];
  const structure = root.structure as Record<string, unknown>;
  const defaultPalette = ((structure?.palette as Record<string, unknown>)?.default ?? {}) as Record<string, unknown>;
  const rawPalette = defaultPalette.block_palette as Record<string, unknown>[];
  const blockIndices = structure?.block_indices as unknown[][];
  if (!Array.isArray(size) || size.length !== 3 || !Array.isArray(rawPalette) || !Array.isArray(blockIndices?.[0])) {
    throw new Error("This file does not contain a supported Bedrock structure.");
  }
  const [width, height, depth] = size.map(Number);
  if (![width, height, depth].every(value => Number.isInteger(value) && value > 0)) throw new Error("The structure dimensions are invalid.");
  const palette = rawPalette.map(entry => ({
    name:String(entry.name ?? ""),
    states:Object.fromEntries(Object.entries((entry.states ?? {}) as Record<string, unknown>)
      .map(([key, value]) => [key, primitive(value, key)]).filter((entry): entry is [string, BlockStateValue] => entry[1] !== undefined)),
  }));
  const primary = Array.from(blockIndices[0], Number);
  if (primary.length < width * height * depth) throw new Error("The structure block data is incomplete.");
  const blocks: (StructureVariant | null)[][] = Array.from({ length:height }, () => Array(width * depth).fill(null));
  for (let index = 0; index < width * height * depth; index++) {
    const x = Math.floor(index / (depth * height));
    const y = Math.floor(index / depth) % height;
    const z = index % depth;
    const variant = palette[primary[index]];
    if (variant && !/^minecraft:(?:air|cave_air|void_air|structure_void)$/.test(variant.name)) blocks[y][z * width + x] = variant;
  }
  return { width, height, depth, blocks };
}
