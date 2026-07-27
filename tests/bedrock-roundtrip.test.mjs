import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateAwareCatalog,
  catalogNameForImportedBlock,
  matchCatalogBlock,
  rotateBlockStates,
  rotationFromBlockStates,
  statesEqual,
  textureForFace,
  variantId,
} from "../app/bedrock-catalog.ts";
import { decodeMcstructure, encodeMcstructure } from "../app/mcstructure-codec.ts";

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
  };
  const binary = await encodeMcstructure(source);
  const decoded = await decodeMcstructure(binary);
  assert.deepEqual(decoded, source);
});
