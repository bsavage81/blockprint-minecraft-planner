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
  Armor:Array.from({ length:5 }, () => ({ Count:0, Damage:0, Name:"", WasPickedUp:0 })),
  AttackTime:0,
  BreedCooldown:0,
  Chested:0,
  Color:0,
  Color2:0,
  Dead:0,
  DeathTime:0,
  HurtTime:0,
  InLove:0,
  Invulnerable:0,
  IsAngry:0,
  IsAutonomous:0,
  IsBaby:0,
  IsEating:0,
  IsGliding:0,
  IsGlobal:0,
  IsIllagerCaptain:0,
  IsOrphaned:0,
  IsOutOfControl:0,
  IsPregnant:0,
  IsRoaring:0,
  IsScared:0,
  IsStunned:0,
  IsSwimming:0,
  IsTamed:0,
  IsTrusting:0,
  LeasherID:-1,
  LootDropped:0,
  LoveCause:0,
  Mainhand:[{ Count:0, Damage:0, Name:"", WasPickedUp:0 }],
  MarkVariant:0,
  NaturalSpawn:0,
  Offhand:[{ Count:0, Damage:0, Name:"", WasPickedUp:0 }],
  OwnerNew:-1,
  Persistent:1,
  Saddled:0,
  Sheared:0,
  ShowBottom:0,
  Sitting:0,
  SkinID:0,
  Strength:0,
  StrengthMax:0,
  Surface:0,
  Tags:[],
  TargetID:-1,
  TradeExperience:0,
  TradeTier:0,
  Variant:0,
  boundX:0,
  boundY:0,
  boundZ:0,
  canPickupItems:0,
  expDropEnabled:1,
  hasBoundOrigin:0,
  hasSetCanPickupItems:1,
  internalComponents:{},
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

function attribute(name, base, min, max, defaultMin = min, defaultMax = max) {
  return { Base:base, Current:base, DefaultMax:defaultMax, DefaultMin:defaultMin, Max:max, Min:min, Name:name };
}

export function mobDefaultsFromBehavior(identifier, definition = {}) {
  const entity = definition["minecraft:entity"] ?? {};
  const components = entity.components ?? {};
  const localName = identifier.replace(/^minecraft:/, "");
  const value = (name, fallback) => {
    const component = components[`minecraft:${name}`];
    return Number(component?.value ?? component?.default ?? fallback);
  };
  const health = components["minecraft:health"] ?? {};
  const healthValue = Number(health.value ?? health.max ?? 20);
  const healthMax = Number(health.max ?? healthValue);
  const groups = Object.keys(entity.component_groups ?? {});
  const adult = groups.find(name => name === `minecraft:${localName}_adult`)
    ?? groups.find(name => /_adult$/.test(name));
  const unsaddled = groups.find(name => /_unsaddled$/.test(name));
  const definitions = [`+${identifier}`, ...[adult, unsaddled].filter(Boolean).map(name => `+${name}`)];
  const properties = Object.fromEntries(Object.entries(entity.description?.properties ?? {})
    .flatMap(([name, property]) => property && "default" in property ? [[name, property.default]] : []));
  return {
    Attributes:[
      attribute("minecraft:health", healthValue, 0, healthMax, 0, healthMax),
      attribute("minecraft:follow_range", value("follow_range", 16), 0, 2048),
      attribute("minecraft:knockback_resistance", value("knockback_resistance", 0), -2, 1),
      attribute("minecraft:movement", value("movement", 0.1), 0, 3.4028234663852886e+38),
      attribute("minecraft:underwater_movement", value("underwater_movement", 0.02), 0, 3.4028234663852886e+38),
      attribute("minecraft:lava_movement", value("lava_movement", 0.02), 0, 3.4028234663852886e+38),
      attribute("minecraft:absorption", value("absorption", 0), 0, 16),
      attribute("minecraft:luck", value("luck", 0), -1024, 1024),
      attribute("minecraft:friction_modifier", value("friction_modifier", 1), 0, 256),
      attribute("minecraft:bounciness", value("bounciness", 0), 0, 1),
      attribute("minecraft:air_drag_modifier", value("air_drag_modifier", 1), 0, 256),
    ],
    definitions,
    ...(Object.keys(properties).length ? { properties } : {}),
  };
}
