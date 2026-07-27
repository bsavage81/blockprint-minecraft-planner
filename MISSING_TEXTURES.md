# Missing Bedrock state textures

Generated from the [official Microsoft Bedrock block/state listing](https://raw.githubusercontent.com/MicrosoftDocs/minecraft-creator/main/creator/Reference/Content/VanillaListingsReference/Blocks.md) and `public/bedrock-blocks.json`.

- Official blocks audited: 1414
- Local texture IDs audited: 943
- State-sensitive gaps: 71

Directional, hinge, open/closed, connection, slab-half, and stair-corner states are geometry/rotation concerns and are intentionally not reported as missing bitmap assets.

| Block | State | Appearance | Missing local texture evidence |
| --- | --- | --- | --- |
| `minecraft:acacia_door` | `upper_block_bit` | upper/lower texture | lower: acacia_door_bottom / acacia_door_lower; upper: acacia_door_top / acacia_door_upper |
| `minecraft:acacia_log` | `pillar_axis` | end/side faces | end: acacia_log_top / acacia_log / acacia_log; side: acacia_log_side / acacia_log / acacia_log |
| `minecraft:acacia_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:acacia_wood` | `pillar_axis` | end/side faces | end: acacia_wood_top / acacia_log_top / acacia_wood; side: acacia_wood_side / acacia_log_side / acacia_wood |
| `minecraft:bamboo_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:bed` | `head_piece_bit` | bed head/foot | head: bed_head_top / bed_head; foot: bed_feet_top / bed_foot_top / bed_feet |
| `minecraft:bee_nest` | `honey_level` | honey-filled front | honey: bee_nest_front_honey / bee_nest_honey |
| `minecraft:beehive` | `honey_level` | honey-filled front | honey: beehive_front_honey / beehive_honey |
| `minecraft:beetroot` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:birch_door` | `upper_block_bit` | upper/lower texture | lower: birch_door_bottom / birch_door_lower; upper: birch_door_top / birch_door_upper |
| `minecraft:birch_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:calibrated_sculk_sensor` | `sculk_sensor_phase` | active/inactive tendrils | inactive: calibrated_sculk_sensor_tendril_inactive; active: calibrated_sculk_sensor_tendril_active |
| `minecraft:carrots` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:cauldron` | `cauldron_liquid` | liquid surfaces | lava: cauldron_lava; powder snow: cauldron_powder_snow |
| `minecraft:cherry_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:copper_bulb` | `lit` | lit/unlit bulb | lit: copper_bulb_lit / copper_bulb_on |
| `minecraft:crimson_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:crimson_stem` | `pillar_axis` | end/side faces | end: crimson_stem_top / crimson_stem / crimson_stem; side: crimson_stem_side / crimson_stem / crimson_stem |
| `minecraft:dark_oak_door` | `upper_block_bit` | upper/lower texture | lower: dark_oak_door_bottom / dark_oak_door_lower; upper: dark_oak_door_top / dark_oak_door_upper |
| `minecraft:dark_oak_log` | `pillar_axis` | end/side faces | side: dark_oak_log_side / dark_oak_log / dark_oak_log |
| `minecraft:dark_oak_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:dark_oak_wood` | `pillar_axis` | end/side faces | side: dark_oak_wood_side / dark_oak_log_side / dark_oak_wood |
| `minecraft:exposed_copper_bulb` | `lit` | lit/unlit bulb | lit: exposed_copper_bulb_lit / exposed_copper_bulb_on |
| `minecraft:infested_deepslate` | `pillar_axis` | end/side faces | end: infested_deepslate_top / infested_deepslate / infested_deepslate; side: infested_deepslate_side / infested_deepslate / infested_deepslate |
| `minecraft:iron_door` | `upper_block_bit` | upper/lower texture | lower: iron_door_bottom / iron_door_lower; upper: iron_door_top / iron_door_upper |
| `minecraft:jungle_door` | `upper_block_bit` | upper/lower texture | lower: jungle_door_bottom / jungle_door_lower; upper: jungle_door_top / jungle_door_upper |
| `minecraft:jungle_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:large_fern` | `upper_block_bit` | upper/lower texture | lower: large_fern_bottom / large_fern_lower; upper: large_fern_top / large_fern_upper |
| `minecraft:leaf_litter` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:lilac` | `upper_block_bit` | upper/lower texture | lower: lilac_bottom / lilac_lower; upper: lilac_top / lilac_upper |
| `minecraft:mangrove_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:melon_stem` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:oak_log` | `pillar_axis` | end/side faces | end: oak_log_top / oak_log / oak_log; side: oak_log_side / oak_log / oak_log |
| `minecraft:oak_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:oak_wood` | `pillar_axis` | end/side faces | end: oak_wood_top / oak_log_top / oak_wood; side: oak_wood_side / oak_log_side / oak_wood |
| `minecraft:oxidized_copper_bulb` | `lit` | lit/unlit bulb | lit: oxidized_copper_bulb_lit / oxidized_copper_bulb_on |
| `minecraft:pale_moss_carpet` | `upper_block_bit` | upper/lower texture | lower: pale_moss_carpet_bottom / pale_moss_carpet_lower; upper: pale_moss_carpet_top / pale_moss_carpet_upper |
| `minecraft:pale_oak_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:pink_petals` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:poplar_door` | `upper_block_bit` | upper/lower texture | lower: poplar_door_bottom / poplar_door_lower; upper: poplar_door_top / poplar_door_upper |
| `minecraft:poplar_log` | `pillar_axis` | end/side faces | end: poplar_log_top / poplar_log / poplar_log; side: poplar_log_side / poplar_log / poplar_log |
| `minecraft:poplar_shelf` | `powered_shelf_type` | staged appearance | Only 0 local texture variants found |
| `minecraft:poplar_wood` | `pillar_axis` | end/side faces | end: poplar_wood_top / poplar_log_top / poplar_wood; side: poplar_wood_side / poplar_log_side / poplar_wood |
| `minecraft:potatoes` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:pumpkin_stem` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:shelf_mushroom` | `growth` | staged appearance | Only 0 local texture variants found |
| `minecraft:small_dripleaf_block` | `upper_block_bit` | upper/lower texture | lower: small_dripleaf_block_bottom / small_dripleaf_block_lower; upper: small_dripleaf_block_top / small_dripleaf_block_upper |
| `minecraft:smooth_quartz` | `pillar_axis` | end/side faces | end: smooth_quartz_top / smooth_quartz / smooth_quartz; side: smooth_quartz_side / smooth_quartz / smooth_quartz |
| `minecraft:soul_campfire` | `extinguished` | lit/unlit logs | unlit: soul_campfire_log |
| `minecraft:spruce_door` | `upper_block_bit` | upper/lower texture | lower: spruce_door_bottom / spruce_door_lower; upper: spruce_door_top / spruce_door_upper |
| `minecraft:spruce_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:stripped_crimson_hyphae` | `pillar_axis` | end/side faces | end: stripped_crimson_hyphae_top / stripped_crimson_log_top / stripped_crimson_hyphae; side: stripped_crimson_hyphae_side / stripped_crimson_log_side / stripped_crimson_hyphae |
| `minecraft:stripped_poplar_log` | `pillar_axis` | end/side faces | end: stripped_poplar_log_top / stripped_poplar_log / stripped_poplar_log; side: stripped_poplar_log_side / stripped_poplar_log / stripped_poplar_log |
| `minecraft:stripped_poplar_wood` | `pillar_axis` | end/side faces | end: stripped_poplar_wood_top / stripped_poplar_log_top / stripped_poplar_wood; side: stripped_poplar_wood_side / stripped_poplar_log_side / stripped_poplar_wood |
| `minecraft:stripped_warped_hyphae` | `pillar_axis` | end/side faces | end: stripped_warped_hyphae_top / stripped_warped_log_top / stripped_warped_hyphae; side: stripped_warped_hyphae_side / stripped_warped_log_side / stripped_warped_hyphae |
| `minecraft:sunflower` | `upper_block_bit` | upper/lower texture | lower: sunflower_bottom / sunflower_lower; upper: sunflower_top / sunflower_upper |
| `minecraft:tall_grass` | `upper_block_bit` | upper/lower texture | lower: tall_grass_bottom / tall_grass_lower; upper: tall_grass_top / tall_grass_upper |
| `minecraft:torchflower_crop` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:warped_hyphae` | `pillar_axis` | end/side faces | end: warped_hyphae_top / warped_log_top / warped_hyphae; side: warped_hyphae_side / warped_log_side / warped_hyphae |
| `minecraft:warped_shelf` | `powered_shelf_type` | staged appearance | Only 1 local texture variant found |
| `minecraft:waxed_copper_bulb` | `lit` | lit/unlit bulb | unlit: waxed_copper_bulb; lit: waxed_copper_bulb_lit / waxed_copper_bulb_on |
| `minecraft:waxed_copper_door` | `upper_block_bit` | upper/lower texture | lower: waxed_copper_door_bottom / waxed_copper_door_lower; upper: waxed_copper_door_top / waxed_copper_door_upper |
| `minecraft:waxed_exposed_copper_bulb` | `lit` | lit/unlit bulb | unlit: waxed_exposed_copper_bulb; lit: waxed_exposed_copper_bulb_lit / waxed_exposed_copper_bulb_on |
| `minecraft:waxed_exposed_copper_door` | `upper_block_bit` | upper/lower texture | lower: waxed_exposed_copper_door_bottom / waxed_exposed_copper_door_lower; upper: waxed_exposed_copper_door_top / waxed_exposed_copper_door_upper |
| `minecraft:waxed_oxidized_copper_bulb` | `lit` | lit/unlit bulb | unlit: waxed_oxidized_copper_bulb; lit: waxed_oxidized_copper_bulb_lit / waxed_oxidized_copper_bulb_on |
| `minecraft:waxed_oxidized_copper_door` | `upper_block_bit` | upper/lower texture | lower: waxed_oxidized_copper_door_bottom / waxed_oxidized_copper_door_lower; upper: waxed_oxidized_copper_door_top / waxed_oxidized_copper_door_upper |
| `minecraft:waxed_weathered_copper_bulb` | `lit` | lit/unlit bulb | unlit: waxed_weathered_copper_bulb; lit: waxed_weathered_copper_bulb_lit / waxed_weathered_copper_bulb_on |
| `minecraft:waxed_weathered_copper_door` | `upper_block_bit` | upper/lower texture | lower: waxed_weathered_copper_door_bottom / waxed_weathered_copper_door_lower; upper: waxed_weathered_copper_door_top / waxed_weathered_copper_door_upper |
| `minecraft:weathered_copper_bulb` | `lit` | lit/unlit bulb | lit: weathered_copper_bulb_lit / weathered_copper_bulb_on |
| `minecraft:wheat` | `growth` | staged appearance | Only 1 local texture variant found |
| `minecraft:wildflowers` | `growth` | staged appearance | Only 1 local texture variant found |
