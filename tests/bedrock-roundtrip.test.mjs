import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Float32, Int8, Int16, Int32, read as readNbt, write as writeNbt } from "nbtify";
import {
  buildStateAwareCatalog,
  categoryForBlockName,
  catalogNameForImportedBlock,
  dedupeCatalogEntries,
  matchCatalogBlock,
  migrateImportedBlock,
  rotateBlockStates,
  rotationFromBlockStates,
  statesEqual,
  textureForFace,
  variantId,
} from "../app/bedrock-catalog.ts";
import { decodeMcstructure, encodeMcstructure } from "../app/mcstructure-codec.ts";
import { defaultNbtForEntity } from "../scripts/entity-default-nbt.mjs";

test("contains every official Bedrock identifier, including white concrete", () => {
  const textures = JSON.parse(readFileSync(new URL("../public/bedrock-blocks.json", import.meta.url), "utf8"));
  const official = JSON.parse(readFileSync(new URL("../public/bedrock-block-states.json", import.meta.url), "utf8"));
  const catalog = buildStateAwareCatalog(textures.blocks, official.blocks);
  const visible = catalog.filter(block => !block.legacyAlias);
  assert.equal(visible.length, official.blocks.length);
  assert.deepEqual(
    new Set(visible.map(block => block.id)),
    new Set(official.blocks.map(block => block.name)),
  );
  const whiteConcrete = visible.find(block => block.id === "minecraft:white_concrete");
  assert.ok(whiteConcrete, "white concrete is present");
  assert.equal(whiteConcrete.textureMatch, "exact");
  assert.match(whiteConcrete.textureUrl, /concrete(?:_white)?\.png$/);
  const whitePowder = visible.find(block => block.id === "minecraft:white_concrete_powder");
  assert.equal(whitePowder.textureMatch, "exact");
  assert.match(whitePowder.textureUrl, /(?:concrete_powder_white|concretePowder)\.png$/);
  const wheat = visible.find(block => block.id === "minecraft:wheat");
  assert.notEqual(
    textureForFace({ ...wheat, minecraftStates:{ growth:0 } }),
    textureForFace({ ...wheat, minecraftStates:{ growth:7 } }),
    "growth states select different atlas-array textures",
  );
  assert.ok(wheat.stateDefinitions.some(definition => definition.name === "growth"));
});

test("groups blocks into practical material categories", () => {
  for (const block of ["oak_planks", "spruce_log", "mangrove_door", "bamboo_fence"]) {
    assert.equal(categoryForBlockName(block), "Wood", block);
  }
  assert.equal(categoryForBlockName("polished_deepslate_stairs"), "Stone");
  assert.equal(categoryForBlockName("flowering_azalea_leaves"), "Nature");
  assert.equal(categoryForBlockName("diamond_ore"), "Ores & Minerals");
  assert.equal(categoryForBlockName("redstone_repeater"), "Redstone");
});

test("deduplicates project palette entries before category filtering", () => {
  const catalog = [
    { id:"minecraft:bed", category:"Color", source:"catalog" },
    { id:"minecraft:stone", category:"Stone", source:"catalog" },
  ];
  const project = [
    { id:"minecraft:bed", category:"Color", source:"project" },
    { id:"minecraft:decorated_pot", category:"Other", source:"project" },
  ];
  const merged = dedupeCatalogEntries(catalog, project);
  assert.equal(merged.filter(block => block.id === "minecraft:bed").length, 1);
  assert.equal(merged.find(block => block.id === "minecraft:bed").source, "project");
  assert.deepEqual(
    merged.filter(block => block.category === "Stone").map(block => block.id),
    ["minecraft:stone"],
  );
});

test("builds canonical blocks while retaining legacy texture aliases", () => {
  const catalog = buildStateAwareCatalog([
    { id:"bedrock:oak_log_side", name:"Oak Log Side", category:"Wood", textureUrl:"side.png" },
    { id:"bedrock:oak_log_top", name:"Oak Log Top", category:"Wood", textureUrl:"top.png" },
  ]);
  const block = catalog.find(entry => entry.id === "minecraft:oak_log");
  assert.equal(block.minecraftName, "minecraft:oak_log");
  assert.deepEqual(block.minecraftStates, { pillar_axis:"y" });
  assert.equal(textureForFace(block, "up"), "top.png");
  assert.equal(textureForFace({ ...block, minecraftStates:{ pillar_axis:"x" } }, "up"), "side.png");
  const legacy = catalog.find(entry => entry.id === "bedrock:oak_log_top");
  assert.ok(legacy.legacyAlias);
  assert.equal(legacy.textureUrl, "top.png", "old project IDs retain their exact texture");
  assert.equal(variantId("minecraft:oak_log", { pillar_axis:"x" }), "minecraft:oak_log[pillar_axis=x]");
});

test("gives slabs editable bottom and top vertical-half states", () => {
  const catalog = buildStateAwareCatalog(
    [{ id:"oak_planks", name:"Oak Planks", category:"Wood", textureUrl:"oak.png" }],
    [{ name:"minecraft:oak_slab", states:["minecraft:vertical_half"] }],
  );
  const slab = catalog.find(block => block.id === "minecraft:oak_slab");
  assert.deepEqual(slab.minecraftStates, { "minecraft:vertical_half":"bottom" });
  assert.deepEqual(slab.stateDefinitions, [
    { name:"minecraft:vertical_half", values:["bottom", "top"] },
  ]);
});

test("provides format-correct defaults for every entity category", () => {
  const base = defaultNbtForEntity("minecraft:painting");
  assert.deepEqual(base.Motion, [0, 0, 0]);
  assert.equal(base.OnGround, 1);
  assert.equal(base.Motive, "Kebab");

  const mob = defaultNbtForEntity("minecraft:pig", true);
  assert.equal(mob.Air, 300);
  assert.equal(mob.LeasherID, -1);
  assert.equal(mob.Persistent, 1);

  const item = defaultNbtForEntity("minecraft:item");
  assert.deepEqual(item.Item, { Name:"minecraft:stone", Count:1, Damage:0 });
  assert.equal(item.Health, 5);

  const catalog = JSON.parse(readFileSync(new URL("../public/bedrock-entities.json", import.meta.url), "utf8"));
  assert.ok(catalog.entities.length > 100);
  for (const entity of catalog.entities) {
    assert.deepEqual(entity.defaultNbt.Motion, [0, 0, 0], `${entity.id} has default motion`);
    assert.equal(entity.defaultNbt.OnGround, 1, `${entity.id} has an on-ground flag`);
    assert.equal(entity.defaultNbt.PortalCooldown, 0, `${entity.id} has a portal cooldown`);
    if (entity.mob) assert.equal(entity.defaultNbt.Air, 300, `${entity.id} has mob defaults`);
  }
});

test("selects state-specific textures and rotates official Bedrock direction states", () => {
  const catalog = buildStateAwareCatalog([
    { id:"bedrock:door_lower", name:"Door Lower", category:"Utility", textureUrl:"door-lower.png" },
    { id:"bedrock:door_upper", name:"Door Upper", category:"Utility", textureUrl:"door-upper.png" },
    { id:"bedrock:campfire_log", name:"Campfire Log", category:"Utility", textureUrl:"campfire-off.png" },
    { id:"bedrock:campfire_log_lit", name:"Campfire Log Lit", category:"Utility", textureUrl:"campfire-on.png" },
  ]);
  const door = catalog.find(entry => entry.id === "minecraft:wooden_door");
  assert.equal(textureForFace({ ...door, minecraftStates:{ ...door.minecraftStates, upper_block_bit:false } }), "door-lower.png");
  assert.equal(textureForFace({ ...door, minecraftStates:{ ...door.minecraftStates, upper_block_bit:true } }), "door-upper.png");
  const campfire = catalog.find(entry => entry.id === "minecraft:campfire");
  assert.equal(textureForFace({ ...campfire, minecraftStates:{ extinguished:false } }), "campfire-on.png");
  assert.equal(textureForFace({ ...campfire, minecraftStates:{ extinguished:true } }), "campfire-off.png");

  assert.equal(rotationFromBlockStates({ "minecraft:cardinal_direction":"east" }), 90);
  assert.equal(rotationFromBlockStates({ pillar_axis:"x" }), 90);
  assert.equal(rotationFromBlockStates({ pillar_axis:"z" }), 0);
  assert.deepEqual(
    rotateBlockStates({ "minecraft:cardinal_direction":"north", pillar_axis:"x" }, 90),
    { "minecraft:cardinal_direction":"east", pillar_axis:"z" },
  );
  assert.deepEqual(rotateBlockStates({ direction:2 }, 90), { direction:3 });
});

test("matches imported palette entries to canonical catalog blocks", () => {
  const catalog = buildStateAwareCatalog([
    { id:"bedrock:stone", name:"Stone", category:"Stone", textureUrl:"stone.png" },
    { id:"bedrock:oak_log_side", name:"Oak Log Side", category:"Wood", textureUrl:"side.png" },
    { id:"bedrock:oak_log_top", name:"Oak Log Top", category:"Wood", textureUrl:"top.png" },
  ]);
  const stone = matchCatalogBlock(catalog, "minecraft:stone", {});
  assert.equal(stone.id, "minecraft:stone");
  assert.ok(statesEqual(stone.minecraftStates, {}), "default-state imports reuse the catalog ID");

  assert.equal(catalogNameForImportedBlock("minecraft:log", { old_log_type:"oak" }), "minecraft:oak_log");
  const legacyLog = matchCatalogBlock(catalog, "minecraft:log", { old_log_type:"oak", pillar_axis:"y" });
  assert.equal(legacyLog.id, "minecraft:oak_log");
  assert.deepEqual(
    migrateImportedBlock("minecraft:log2", { new_log_type:"acacia", pillar_axis:"z" }),
    { name:"minecraft:acacia_log", states:{ pillar_axis:"z" } },
  );
  assert.deepEqual(
    migrateImportedBlock("minecraft:coral", { coral_color:"pink", dead_bit:0 }),
    { name:"minecraft:brain_coral", states:{} },
  );
  assert.deepEqual(
    migrateImportedBlock("minecraft:coral_block", { coral_color:"red", dead_bit:1 }),
    { name:"minecraft:dead_fire_coral_block", states:{} },
  );
  assert.deepEqual(
    migrateImportedBlock("minecraft:stained_hardened_clay", { color:"lime" }),
    { name:"minecraft:lime_terracotta", states:{} },
  );
  assert.deepEqual(
    migrateImportedBlock("minecraft:seaLantern", {}),
    { name:"minecraft:sea_lantern", states:{} },
  );
  assert.equal(
    variantId("minecraft:log", { old_log_type:"oak", pillar_axis:"y" }),
    "minecraft:log[old_log_type=oak,pillar_axis=y]",
    "non-default imported states remain a configured variant for lossless export",
  );
});

test("round-trips Bedrock identifiers, states, coordinates, and empty cells", async () => {
  const source = {
    width:2, height:2, depth:2,
    blocks:[
      [
        { name:"minecraft:oak_log", states:{ pillar_axis:"x" } },
        null,
        { name:"minecraft:oak_stairs", states:{ weirdo_direction:2, upside_down_bit:true } },
        null,
      ],
      [
        null,
        { name:"minecraft:barrel", states:{ cardinal_direction:"east" } },
        null,
        { name:"my_pack:glowing_crate", states:{ powered:true } },
      ],
    ],
    containers:{
      "0:0":{
        id:"Chest",
        items:[
          {
            slot:0,
            name:"minecraft:diamond_pickaxe",
            count:1,
            damage:0,
            nbt:{
              WasPickedUp:0,
              tag:{
                Damage:236,
                display:{ Name:"Treasure" },
                ench:[{ id:17, lvl:3 }, { id:15, lvl:5 }],
              },
            },
          },
        ],
        nbt:{ CustomName:"Supply Chest" },
      },
    },
    entities:[
      {
        identifier:"my_pack:helper",
        x:1.5,
        y:0,
        z:0.5,
        rotation:[90, 0],
        nbt:{
          CustomName:"Blueprint Pig",
          Persistent:1,
          Air:300,
          FallDistance:0,
          Fire:0,
          LeasherID:-1,
          OnGround:1,
          Motion:[0.25, 0, -0.5],
          Flags:[true, false],
          Scores:[7, 11],
        },
      },
      {
        identifier:"minecraft:item",
        x:0.5,
        y:1,
        z:1.5,
        rotation:[0, 0],
        nbt:{
          Item:{
            Name:"minecraft:diamond_pickaxe",
            Count:1,
            Damage:0,
            tag:{ ench:[{ id:17, lvl:3 }] },
          },
        },
      },
    ],
  };
  const binary = await encodeMcstructure(source);
  const decoded = await decodeMcstructure(binary);
  const expected = structuredClone(source);
  expected.entities[0].nbt.Flags = [1, 0];
  assert.deepEqual(decoded, expected);

  const parsed = await readNbt(binary, { endian:"little", compression:null });
  const exportedItem = parsed.data.structure.palette.default.block_position_data["0"].block_entity_data.Items[0];
  assert.ok(exportedItem.tag.ench[0].id instanceof Int16, "enchantment ids export as Bedrock shorts");
  assert.ok(exportedItem.tag.ench[0].lvl instanceof Int16, "enchantment levels export as Bedrock shorts");
  const droppedItem = parsed.data.structure.entities[1].Item;
  assert.ok(droppedItem.tag.ench[0].id instanceof Int16, "dropped-item enchantment ids export as Bedrock shorts");
  assert.ok(droppedItem.tag.ench[0].lvl instanceof Int16, "dropped-item enchantment levels export as Bedrock shorts");
  const exportedEntity = parsed.data.structure.entities[0];
  assert.ok(exportedEntity.Air instanceof Int16, "mob air exports as a Bedrock short");
  assert.ok(exportedEntity.Fire instanceof Int16, "entity fire ticks export as a Bedrock short");
  assert.ok(exportedEntity.FallDistance instanceof Float32, "fall distance exports as a Bedrock float");
  assert.ok(exportedEntity.OnGround instanceof Int8, "entity flags export as Bedrock bytes");
  assert.equal(typeof exportedEntity.LeasherID, "bigint", "entity IDs export as Bedrock longs");
  assert.ok(exportedEntity.Motion.every(value => value instanceof Float32), "motion exports as a float list");
  const origin = [-427, 64, 307];
  parsed.data.structure_world_origin.forEach((_, index) => { parsed.data.structure_world_origin[index] = new Int32(origin[index]); });
  parsed.data.structure.entities.forEach(rawEntity => {
    rawEntity.Pos.forEach((value, index) => { rawEntity.Pos[index] = new Float32(Number(value) + origin[index]); });
  });
  const absoluteBinary = await writeNbt(parsed.data, { endian:"little", compression:null, rootName:"" });
  assert.deepEqual(
    await decodeMcstructure(absoluteBinary),
    expected,
    "absolute entity positions are normalized by structure_world_origin",
  );
});
