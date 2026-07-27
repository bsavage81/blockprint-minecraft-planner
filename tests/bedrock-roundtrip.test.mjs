import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildStateAwareCatalog,
  categoryForBlockName,
  catalogNameForImportedBlock,
  matchCatalogBlock,
  rotateBlockStates,
  rotationFromBlockStates,
  statesEqual,
  textureForFace,
  variantId,
} from "../app/bedrock-catalog.ts";
import { decodeMcstructure, encodeMcstructure } from "../app/mcstructure-codec.ts";

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
        { name:"minecraft:stone", states:{} },
      ],
    ],
    containers:{
      "0:0":{
        id:"Chest",
        items:[
          { slot:0, name:"minecraft:diamond", count:12, damage:0, nbt:{ display:{ Name:"Treasure" }, custom_value:7 } },
        ],
        nbt:{ CustomName:"Supply Chest" },
      },
    },
    entities:[
      {
        identifier:"minecraft:pig",
        x:1.5,
        y:0,
        z:0.5,
        rotation:[90, 0],
        nbt:{ CustomName:"Blueprint Pig", Persistent:1 },
      },
    ],
  };
  const binary = await encodeMcstructure(source);
  const decoded = await decodeMcstructure(binary);
  assert.deepEqual(decoded, source);
});
