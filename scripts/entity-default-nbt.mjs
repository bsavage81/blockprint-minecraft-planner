export const ENTITY_FORMAT_REFERENCE = "https://minecraft.wiki/w/Bedrock_Edition_level_format/Entity_format";

const BASE_ENTITY_NBT = {
  FallDistance:0,
  Fire:0,
  Invulnerable:0,
  Motion:[0, 0, 0],
  OnGround:1,
  PortalCooldown:0,
};

const MOB_NBT = {
  Air:300,
  AttackTime:0,
  Dead:0,
  DeathTime:0,
  HurtTime:0,
  LeasherID:-1,
  NaturalSpawn:0,
  Persistent:1,
};

const TYPE_DEFAULTS = {
  "minecraft:item":{
    Age:0,
    Health:5,
    Item:{ Name:"minecraft:stone", Count:1, Damage:0 },
  },
  "minecraft:falling_block":{
    FallingBlock:{ name:"minecraft:sand", states:{}, version:18168865 },
    Time:1,
  },
  "minecraft:painting":{
    Dir:0,
    Direction:0,
    Motive:"Kebab",
  },
  "minecraft:primed_tnt":{ Fuse:80 },
  "minecraft:xp_orb":{ Age:0, Value:1 },
  "minecraft:experience_orb":{ Age:0, Value:1 },
};

export function defaultNbtForEntity(identifier, mob = false, existing = {}) {
  return {
    ...BASE_ENTITY_NBT,
    ...(mob ? MOB_NBT : {}),
    ...(TYPE_DEFAULTS[identifier] ?? {}),
    ...existing,
  };
}
