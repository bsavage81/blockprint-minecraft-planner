import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateAwareCatalog,
  catalogNameForImportedBlock,
  matchCatalogBlock,
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
