import { Float32, Int8, Int16, Int32, TAG, TAG_TYPE, read as readNbt, write as writeNbt } from "nbtify";
type BlockStateValue = string | number | boolean;

export type StructureVariant = {
  name: string;
  states: Record<string, BlockStateValue>;
};

export type ContainerItem = {
  slot: number;
  name: string;
  count: number;
  damage?: number;
  nbt?: Record<string, unknown>;
};

export type ContainerData = {
  id?: string;
  items: ContainerItem[];
  nbt?: Record<string, unknown>;
};

export type StructureEntity = {
  identifier: string;
  x: number;
  y: number;
  z: number;
  rotation?: [number, number];
  nbt?: Record<string, unknown>;
};

export type StructureModel = {
  width: number;
  height: number;
  depth: number;
  blocks: (StructureVariant | null)[][]; // layers, row-major X/Z cells
  containers?: Record<string, ContainerData>; // "layer:cell"
  entities?: StructureEntity[];
};

function typedNbtList<T>(values: T[], type: TAG) {
  Object.defineProperty(values, TAG_TYPE, { value:type, enumerable:false });
  return values;
}

function primitive(value: unknown, key = ""): BlockStateValue | undefined {
  const unwrapped = value && typeof value === "object" && "valueOf" in value ? value.valueOf() : value;
  if (value instanceof Int8 && (unwrapped === 0 || unwrapped === 1)) return Boolean(unwrapped);
  if (/_bit$/.test(key) && (unwrapped === 0 || unwrapped === 1)) return Boolean(unwrapped);
  return typeof unwrapped === "string" || typeof unwrapped === "number" || typeof unwrapped === "boolean" ? unwrapped : undefined;
}

function typedStates(states: Record<string, BlockStateValue>) {
  return Object.fromEntries(Object.entries(states).map(([key, value]) => [key, typeof value === "number" ? new Int32(value) : value]));
}

function plainNbt(value: unknown): unknown {
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  if (Array.isArray(value)) return value.map(plainNbt);
  if (value && typeof value === "object") {
    if ("valueOf" in value && value.valueOf() !== value && typeof value.valueOf() !== "object") return value.valueOf();
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, plainNbt(child)]));
  }
  return value;
}

function editableNbt(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result = value.map(editableNbt);
    if (result.length) {
      const first = result[0];
      const type = typeof first === "string" ? TAG.STRING : typeof first === "number" ? TAG.INT : TAG.COMPOUND;
      return typedNbtList(result, type);
    }
    return typedNbtList(result, TAG.COMPOUND);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, editableNbt(child)]));
  }
  return typeof value === "number" ? new Int32(value) : value;
}

function positionIndex(width: number, height: number, depth: number, layer: number, cell: number) {
  const x = cell % width;
  const z = Math.floor(cell / width);
  return x * depth * height + layer * depth + z;
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
  const blockPositionData = Object.fromEntries(Object.entries(model.containers ?? {}).map(([key, container]) => {
    const [layer, cell] = key.split(":").map(Number);
    const items = container.items.map(item => ({
      ...(editableNbt(item.nbt ?? {}) as Record<string, unknown>),
      Name:item.name,
      Count:new Int8(Math.max(1, Math.min(64, item.count))),
      Damage:new Int16(item.damage ?? 0),
      Slot:new Int8(item.slot),
    }));
    const blockEntityData = {
      ...(editableNbt(container.nbt ?? {}) as Record<string, unknown>),
      id:container.id ?? "Chest",
      Items:typedNbtList(items, TAG.COMPOUND),
    };
    return [String(positionIndex(model.width, model.height, model.depth, layer, cell)), { block_entity_data:blockEntityData }];
  }));
  const root = {
    format_version:new Int32(1),
    size:[new Int32(model.width), new Int32(model.height), new Int32(model.depth)],
    structure:{
      block_indices:[primary, secondary],
      entities:typedNbtList((model.entities ?? []).map((entity, index) => {
        const rotation = entity.rotation ?? [0, 0];
        const pos = [new Float32(entity.x), new Float32(entity.y), new Float32(entity.z)];
        return {
          blockPos:typedNbtList([new Int32(Math.floor(entity.x)), new Int32(Math.floor(entity.y)), new Int32(Math.floor(entity.z))], TAG.INT),
          pos:typedNbtList(pos, TAG.FLOAT),
          nbt:{
            ...(editableNbt(entity.nbt ?? {}) as Record<string, unknown>),
            identifier:entity.identifier,
            Pos:typedNbtList(pos, TAG.FLOAT),
            Rotation:typedNbtList([new Float32(rotation[0]), new Float32(rotation[1])], TAG.FLOAT),
            UniqueID:BigInt(-(index + 1)),
          },
        };
      }), TAG.COMPOUND),
      palette:{ default:{
        block_palette:palette.map(entry => ({ name:entry.name, states:typedStates(entry.states), version:new Int32(18168865) })),
        block_position_data:blockPositionData,
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
  const containers: Record<string, ContainerData> = {};
  for (let index = 0; index < width * height * depth; index++) {
    const x = Math.floor(index / (depth * height));
    const y = Math.floor(index / depth) % height;
    const z = index % depth;
    const variant = palette[primary[index]];
    if (variant && !/^minecraft:(?:air|cave_air|void_air|structure_void)$/.test(variant.name)) blocks[y][z * width + x] = variant;
  }
  const positionData = (defaultPalette.block_position_data ?? {}) as Record<string, Record<string, unknown>>;
  for (const [rawIndex, entry] of Object.entries(positionData)) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= width * height * depth) continue;
    const x = Math.floor(index / (depth * height));
    const y = Math.floor(index / depth) % height;
    const z = index % depth;
    const blockEntity = (entry.block_entity_data ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(blockEntity.Items) ? blockEntity.Items as Record<string, unknown>[] : [];
    const items = rawItems.map(item => ({
      slot:Number(item.Slot ?? 0),
      name:String(item.Name ?? "minecraft:air"),
      count:Number(item.Count ?? 1),
      damage:Number(item.Damage ?? 0),
      nbt:plainNbt(Object.fromEntries(Object.entries(item).filter(([key]) => !["Slot", "Name", "Count", "Damage"].includes(key)))) as Record<string, unknown>,
    }));
    containers[`${y}:${z * width + x}`] = {
      id:String(blockEntity.id ?? "Chest"),
      items,
      nbt:plainNbt(Object.fromEntries(Object.entries(blockEntity).filter(([key]) => !["id", "Items", "x", "y", "z"].includes(key)))) as Record<string, unknown>,
    };
  }
  const rawEntities = Array.isArray(structure.entities) ? structure.entities as Record<string, unknown>[] : [];
  const entities = rawEntities.flatMap(entry => {
    const nbt = (entry.nbt ?? {}) as Record<string, unknown>;
    const rawPos = (Array.isArray(entry.pos) ? entry.pos : nbt.Pos) as unknown[] | undefined;
    if (!Array.isArray(rawPos) || rawPos.length < 3) return [];
    const rotation = Array.isArray(nbt.Rotation) ? nbt.Rotation.map(Number) : [0, 0];
    return [{
      identifier:String(nbt.identifier ?? ""),
      x:Number(rawPos[0]),
      y:Number(rawPos[1]),
      z:Number(rawPos[2]),
      rotation:[rotation[0] ?? 0, rotation[1] ?? 0] as [number, number],
      nbt:plainNbt(Object.fromEntries(Object.entries(nbt).filter(([key]) => !["identifier", "Pos", "Rotation", "UniqueID"].includes(key)))) as Record<string, unknown>,
    }];
  });
  return { width, height, depth, blocks, containers, entities };
}
