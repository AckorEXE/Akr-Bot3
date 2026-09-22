// ═══════════════════════════════════════════════════════════
//  !imbuement  —  Guía de imbuements de Tibia
// ═══════════════════════════════════════════════════════════
//  Uso:
//    !imbuement            → ayuda
//    !imbuement list       → todos los imbuements
//    !imbuement type       → tipos de item
//    !imbuement <nombre>   → materiales de un imbuement
//    !imbuement <tipo>     → imbuements + items de ese tipo
// ═══════════════════════════════════════════════════════════

const c = (s) => '`' + s + '`';           // formato código de WhatsApp
const b = (s) => '*' + s + '*';           // negrita
const LINE = '━━━━━━━━━━━━━━━';

// ─────────────────────────────────────────────
// 🧩 TIPOS DE ITEM
// ─────────────────────────────────────────────
const TYPE_META = {
  helmet:    { emoji: '🪖', label: 'Helmet' },
  armor:     { emoji: '🛡️', label: 'Armor' },
  boots:     { emoji: '🥾', label: 'Boots' },
  shield:    { emoji: '🔰', label: 'Shield' },
  spellbook: { emoji: '📖', label: 'Spellbook' },
  rod:       { emoji: '🔮', label: 'Rod' },
  wand:      { emoji: '✨', label: 'Wand' },
  bow:       { emoji: '🏹', label: 'Bow' },
  crossbow:  { emoji: '🎯', label: 'Crossbow' },
  axe:       { emoji: '🪓', label: 'Axe' },
  sword:     { emoji: '⚔️', label: 'Sword' },
  club:      { emoji: '🔨', label: 'Club' },
  fist:      { emoji: '👊', label: 'Fist' },
  backpack:  { emoji: '🎒', label: 'Backpack' }
};

// Alias para que el usuario pueda escribir en español o en plural
const TYPE_ALIASES = {
  casco: 'helmet', cascos: 'helmet', helm: 'helmet',
  armadura: 'armor', armaduras: 'armor', body: 'armor',
  botas: 'boots', bota: 'boots', boot: 'boots',
  escudo: 'shield', escudos: 'shield',
  libro: 'spellbook', libros: 'spellbook', book: 'spellbook', spell: 'spellbook',
  vara: 'rod', varita: 'wand',
  arco: 'bow', arcos: 'bow',
  ballesta: 'crossbow', ballestas: 'crossbow', cross: 'crossbow',
  hacha: 'axe', hachas: 'axe',
  espada: 'sword', espadas: 'sword',
  maza: 'club', mazo: 'club', garrote: 'club',
  puno: 'fist', punos: 'fist', puños: 'fist', fists: 'fist',
  mochila: 'backpack', mochilas: 'backpack', bp: 'backpack'
};

const MELEE = ['axe', 'sword', 'club', 'fist'];
const DISTANCE = ['bow', 'crossbow'];

// ─────────────────────────────────────────────
// 🔥 IMBUEMENTS
//   compatible: usa los mismos tokens que TYPE_META
// ─────────────────────────────────────────────
const GROUPS = {
  damage:     { emoji: '🔥', label: 'Daño elemental' },
  combat:     { emoji: '⚔️', label: 'Combate' },
  skill:      { emoji: '🎯', label: 'Skills' },
  protection: { emoji: '🛡️', label: 'Protección' },
  utility:    { emoji: '🎒', label: 'Utilidad' }
};

const imbuements = {
  // 🔥 Daño elemental
  'scorch':    { emoji: '🔥', label: 'Scorch',    effect: 'Fire Damage',   group: 'damage', values: ['10%','25%','50%'], materials: ['25 Fiery Heart', '5 Green Dragon Scale', '5 Demon Horn'], compatible: [...MELEE, ...DISTANCE] },
  'venom':     { emoji: '🌱', label: 'Venom',     effect: 'Earth Damage',  group: 'damage', values: ['10%','25%','50%'], materials: ['25 Swamp Grass', '20 Poisonous Slime', '2 Slime Heart'], compatible: [...MELEE, ...DISTANCE] },
  'frost':     { emoji: '❄️', label: 'Frost',     effect: 'Ice Damage',    group: 'damage', values: ['10%','25%','50%'], materials: ['25 Frosty Heart', '10 Seacrest Hair', '5 Polar Bear Paw'], compatible: [...MELEE, ...DISTANCE] },
  'electrify': { emoji: '⚡', label: 'Electrify', effect: 'Energy Damage', group: 'damage', values: ['10%','25%','50%'], materials: ['25 Rorc Feather', '5 Peacock Feather Fan', '1 Energy Vein'], compatible: [...MELEE, ...DISTANCE] },
  'reap':      { emoji: '💀', label: 'Reap',      effect: 'Death Damage',  group: 'damage', values: ['10%','25%','50%'], materials: ['25 Pile of Grave Earth', '20 Demonic Skeletal Hand', '5 Petrified Scream'], compatible: [...MELEE, ...DISTANCE] },

  // ⚔️ Combate
  'strike':     { emoji: '🎯', label: 'Strike',     effect: 'Critical Hit', group: 'combat', values: ['15%','25%','50%'], materials: ['20 Protective Charm', '25 Sabretooth', '5 Vexclaw Talon'], compatible: [...MELEE, ...DISTANCE, 'wand', 'rod'] },
  'vampirism':  { emoji: '🩸', label: 'Vampirism',  effect: 'Life Leech',   group: 'combat', values: ['5%','10%','25%'], materials: ['25 Vampire Teeth', '15 Bloody Pincers', '5 Piece of Dead Brain'], compatible: [...MELEE, ...DISTANCE, 'armor'] },
  'void':       { emoji: '🔮', label: 'Void',       effect: 'Mana Leech',   group: 'combat', values: ['3%','5%','8%'], materials: ['25 Rope Belt', '25 Silencer Claw', '5 Grimeleech Wings'], compatible: [...MELEE, ...DISTANCE, 'helmet'] },
  'epiphany':   { emoji: '✨', label: 'Epiphany',   effect: 'Magic Level',  group: 'combat', values: ['+1','+2','+4'], materials: ['25 Elvish Talisman', '15 Broken Shamanic Staff', '15 Strand of Medusa Hair'], compatible: ['helmet', 'rod', 'wand'] },

  // 🎯 Skills
  'chop':      { emoji: '🪓', label: 'Chop',      effect: 'Axe Fighting',      group: 'skill', values: ['+1','+2','+4'], materials: ['20 Orc Tooth', '25 Battle Stone', '20 Moohtant Horn'], compatible: ['axe', 'helmet'] },
  'slash':     { emoji: '🗡️', label: 'Slash',     effect: 'Sword Fighting',    group: 'skill', values: ['+1','+2','+4'], materials: ['25 Lion’s Mane', '25 Mooh’tah Shell', '5 War Crystal'], compatible: ['sword', 'helmet'] },
  'bash':      { emoji: '🔨', label: 'Bash',      effect: 'Club Fighting',     group: 'skill', values: ['+1','+2','+4'], materials: ['20 Cyclops Toe', '15 Ogre Nose Ring', '10 Warmaster’s Wristguards'], compatible: ['club', 'helmet'] },
  'punch':     { emoji: '👊', label: 'Punch',     effect: 'Fist Fighting',     group: 'skill', values: ['+1','+2','+4'], materials: ['25 Tarantula Egg', '20 Mantassin Tail', '15 Gold-Brocaded Cloth'], compatible: ['fist', 'helmet'] },
  'precision': { emoji: '🏹', label: 'Precision', effect: 'Distance Fighting', group: 'skill', values: ['+1','+2','+4'], materials: ['25 Elven Scouting Glass', '20 Elven Hoof', '10 Metal Spike'], compatible: [...DISTANCE, 'helmet'] },

  // 🛡️ Protección
  'blockade':       { emoji: '🔰', label: 'Blockade',       effect: 'Shielding',        group: 'protection', values: ['+1','+2','+4'], materials: ['20 Piece of Scarab Shell', '25 Brimstone Shell', '25 Frazzle Skin'], compatible: ['helmet', 'shield', 'spellbook'] },
  'lich shroud':    { emoji: '💀', label: 'Lich Shroud',    effect: 'Death Protection', group: 'protection', values: ['2%','5%','10%'], materials: ['25 Flask of Embalming Fluid', '20 Gloom Wolf Fur', '5 Mystical Hourglass'], compatible: ['armor', 'shield'] },
  'snake skin':     { emoji: '🌱', label: 'Snake Skin',     effect: 'Earth Protection', group: 'protection', values: ['3%','8%','15%'], materials: ['25 Swampling Wood', '20 Snake Skin', '10 Brimstone Fangs'], compatible: ['armor', 'shield', 'spellbook'] },
  'dragon hide':    { emoji: '🔥', label: 'Dragon Hide',    effect: 'Fire Protection',  group: 'protection', values: ['3%','8%','15%'], materials: ['20 Green Dragon Leather', '10 Blazing Bone', '5 Draken Sulphur'], compatible: ['armor', 'shield', 'spellbook'] },
  'quara scale':    { emoji: '❄️', label: 'Quara Scale',    effect: 'Ice Protection',   group: 'protection', values: ['3%','8%','15%'], materials: ['25 Winter Wolf Fur', '10 Thick Fur', '10 Deepling Wart'], compatible: ['armor', 'shield', 'spellbook'] },
  'cloud fabric':   { emoji: '⚡', label: 'Cloud Fabric',   effect: 'Energy Protection', group: 'protection', values: ['3%','8%','15%'], materials: ['20 Wyvern Talisman', '15 Crawler Head Plating', '10 Wyrm Scale'], compatible: ['armor', 'shield', 'spellbook'] },
  'demon presence': { emoji: '✝️', label: 'Demon Presence', effect: 'Holy Protection',  group: 'protection', values: ['3%','8%','15%'], materials: ['25 Cultish Robe', '25 Cultish Mask', '20 Hellspawn Tail'], compatible: ['armor', 'shield', 'spellbook'] },

  // 🎒 Utilidad
  'vibrancy':      { emoji: '🪞', label: 'Vibrancy',      effect: 'Paralysis Deflection', group: 'utility', values: ['15%','25%','50%'], materials: ['20 Wereboar Hooves', '15 Crystallized Anger', '5 Quill'], compatible: ['boots'] },
  'swiftness':     { emoji: '🪶', label: 'Swiftness',     effect: 'Walking Speed',        group: 'utility', values: ['+10','+15','+30'], materials: ['15 Damselfly Wing', '25 Compass', '20 Waspoid Wing'], compatible: ['boots'] },
  'featherweight': { emoji: '🎒', label: 'Featherweight', effect: 'Capacity',             group: 'utility', values: ['3%','8%','15%'], materials: ['20 Fairy Wings', '10 Little Bowl of Myrrh', '5 Goosebump Leather'], compatible: ['backpack'] }
};

// Alias de imbuements (nombres alternativos / en español)
const IMB_ALIASES = {
  fire: 'scorch', fuego: 'scorch',
  earth: 'venom', tierra: 'venom', poison: 'venom', veneno: 'venom',
  ice: 'frost', hielo: 'frost',
  energy: 'electrify', energia: 'electrify', 'energía': 'electrify',
  death: 'reap', muerte: 'reap',
  crit: 'strike', critical: 'strike', critico: 'strike', 'crítico': 'strike',
  'life leech': 'vampirism', life: 'vampirism', vamp: 'vampirism',
  'mana leech': 'void', mana: 'void',
  ml: 'epiphany', 'magic level': 'epiphany',
  speed: 'swiftness', velocidad: 'swiftness', haste: 'swiftness',
  cap: 'featherweight', capacity: 'featherweight',
  shielding: 'blockade', skillshield: 'blockade',
  para: 'vibrancy', paralisis: 'vibrancy', 'parálisis': 'vibrancy',
  lich: 'lich shroud', snake: 'snake skin', dragon: 'dragon hide',
  quara: 'quara scale', cloud: 'cloud fabric', demon: 'demon presence',
  distance: 'precision', dist: 'precision'
};

// ─────────────────────────────────────────────
// 🧱 LISTAS DE ITEMS  ("Nombre <slots>")
// ─────────────────────────────────────────────
const rawItems = {
  helmet: [
    "Alicorn Headguard 2", "Amazon Helmet 2", "Ancient Tiara 2", "Antler-Horn Helmet 2", "Arboreal Crown 2", "Arcanomancer Regalia 2", "Bonelord Helmet 2", "Cobra Hood 2", "Crown Helmet 2", "Crusader Helmet 2", "Dark Vision Bandana 2", "Dark Whispers 2", "Demon Helmet 2", "Demon Mengu 2", "Demonfang Mask 2", "Dreadfire Headpiece 2", "Dwarven Helmet 2", "Eldritch Cowl 2", "Eldritch Hood 2", "Ethereal Coned Hat 2", "Falcon Circlet 2", "Falcon Coif 2", "Fur Cap 2", "Galea Mortis 2", "Gnome Helmet 2", "Golden Helmet 2", "Green Demon Helmet 2", "Hellstalker Visor 2", "Helmet of Nature 2", "Helmet of Ultimate Terror 2", "Helmet of the Lost 2", "Lion Spangenhelm 2", "Mage Hat 2", "Magician Hat 2", "Maliceforged Helmet 2", "Norcferatu Bonehood 2", "Norcferatu Skullguard 2", "Odd Hat 2", "Royal Helmet 2", "Shamanic Mask 2", "Skull Helmet 2", "Spiritthorn Helmet 2", "Stag Helmet 2", "Stoic Iks Casque 2", "Stoic Iks Headpiece 2", "Visage of the End Days 2", "Warrior Helmet 2", "Batwing Hat 1", "Coned Hat of Enlightenment 1", "Elite Draken Helmet 1", "Hat of the Mad 1", "Jade Conical Hat 1", "Jade Hat 1", "Terra Helmet 1", "Witch Hat 1", "Yalahari Mask 1", "Zaoan Helmet 1"
  ],
  armor: [
    "Elven Mail 3", "Albino Plate 2", "Amazon Armor 2", "Blue Robe 2", "Chain Armor 2", "Dauntless Dragon Scale Armor 2", "Demon Armor 2", "Depth Lorica 2", "Dwarven Armor 2", "Eldritch Cuirass 2", "Elite Draken Mail 2", "Falcon Plate 2", "Ghost Chestplate 2", "Gnome Armor 2", "Golden Armor 2", "Green Demon Armor 2", "Heat Core 2", "Heavy Metal T-Shirt 2", "Knight Armor 2", "Leopard Armor 2", "Lion Plate 2", "Magic Plate Armor 2", "Mammoth Fur Cape 2", "Merudri Battle Mail 2", "Mooh'tah Plate 2", "Mutated Skin Armor 2", "Naga Tanko 2", "Noble Armor 2", "Norcferatu Tuskplate 2", "Ornate Chestplate 2", "Soulgarb 2", "Soulmantle 2", "Soulshell 2", "Soulshroud 2", "Spiritthorn Armor 2", "Stag Plate 2", "Stag Robe 2", "Stoic Iks Chestplate 2", "Stoic Iks Robe 2", "Unerring Dragon Scale Armor 2", "Arcane Dragon Robe 1", "Bear Skin 1", "Crown Armor 1", "Dawnfire Sherwani 1", "Death Oyoroi 1", "Dragon Scale Mail 1", "Dream Shroud 1", "Embrace of Nature 1", "Gnomish Cuirass 1", "Living Armor 1", "Master Archer's Armor 1", "Merudri Nanbando 1", "Midnight Tunic 1", "Mystical Dragon Robe 1", "Norcferatu Bloodhide 1", "Norcferatu Bonecloak 1", "Paladin Armor 1", "Prismatic Armor 1", "Robe of Enlightenment 1", "Stoic Iks Cuirass 1", "Toga Mortis 1"
  ],
  boots: [
    "Alchemist's Boots 1", "Badger Boots 1", "Boots of Enlightenment 1", "Boots of Haste 1", "Bunnyslippers 1", "Cobra Boots 1", "Coconut Shoes 1", "Crocodile Boots 1", "Crystal Boots 1", "Depth Calcei 1", "Dragon Scale Boots 1", "Draken Boots 1", "Eldritch Monk Boots 1", "Feverbloom Boots 1", "Frostflower Boots 1", "Fur Boots 1", "Glacier Shoes 1", "Gnomish Footwraps 1", "Golden Boots 1", "Green Demon Slippers 1", "Guardian Boots 1", "Iks Footwraps 1", "Leather Boots 1", "Lightning Boots 1", "Magma Boots 1", "Make-Do Boots 1", "Makeshift Boots 1", "Metal Spats 1", "Mutant Bone Boots 1", "Norcferatu Goretrampers 1", "Oriental Shoes 1", "Pair of Dreamwalkers 1", "Pair of Nightmare Boots 1", "Pair of Soulstalkers 1", "Pair of Soulwalkers 1", "Patched Boots 1", "Pirate Boots 1", "Prismatic Boots 1", "Sandals 1", "Sanguine Boots 1", "Sanguine Galoshes 1", "Soulsoles 1", "Stag Boots 1", "Stag Footwraps 1", "Stag Shinguards 1", "Steel Boots 1", "Stoic Iks Boots 1", "Stoic Iks Sandals 1", "Terra Boots 1", "Treader of Torment 1", "Vampire Silk Slippers 1", "Winged Boots 1", "Yalahari Footwraps 1", "Zaoan Shoes 1"
  ],
  shield: [
    "Amazon Shield 1", "Biscuit Barrier 1", "Bonelord Shield 1", "Carapace Shield 1", "Castle Shield 1", "Crown Shield 1", "Death Gaze 1", "Demon Shield 1", "Depth Scutum 1", "Dragon Shield 1", "Ectoplasmic Shield 1", "Eldritch Shield 1", "Falcon Escutcheon 1", "Falcon Shield 1", "Gnome Shield 1", "Great Shield 1", "Griffin Shield 1", "Haunted Mirror Piece 1", "Lion Shield 1", "Mastermind Shield 1", "Meat Shield 1", "Medusa Shield 1", "Necromancer Shield 1", "Nightmare Shield 1", "Norse Shield 1", "Ornamented Shield 1", "Ornate Shield 1", "Phoenix Shield 1", "Refined Stag Shield 1", "Rift Shield 1", "Runic Ice Shield 1", "Sentinel Shield 1", "Shield of Care 1", "Shield of Corruption 1", "Shield of the White Knight 1", "Soulbastion 1", "Stag Shield 1", "Steel Shield 1", "Tempest Shield 1", "Tower Shield 1", "Vampire Shield 1", "Viking Shield 1", "Warrior's Shield 1"
  ],
  spellbook: [
    "Alchemist's Notepad 1", "Arboreal Tome 1", "Arcanomancer Folio 1", "Book of Lies 1", "Brain in a Jar 1", "Cocoa Grimoire 1", "Creamy Grimoire 1", "Eldritch Folio 1", "Eldritch Tome 1", "Lion Spellbook 1", "Shoulder Plate 1", "Spellbook of Enlightenment 1", "Spellbook of Warding 1", "Spellbook 1", "Spirit Guide 1", "Stag Scrolls 1", "Stag Spellbook 1", "Umbral Master Spellbook 1", "Umbral Spellbook 1", "Wooden Spellbook 1"
  ],
  rod: [
    "Amber Rod 2", "Cobra Rod 2", "Crypt Jaw 2", "Deepling Ceremonial Dagger 2", "Deepling Fork 2", "Dream Blossom Staff 2", "Eldritch Rod 2", "Energized Limb 2", "Falcon Rod 2", "Gilded Eldritch Rod 2", "Grand Sanguine Rod 2", "Inferniarch Rod 2", "Jungle Rod 2", "Lion Rod 2", "Naga Rod 2", "Northwind Rod 2", "Ogre Scepta 2", "Rod of Carving 2", "Rod of Destruction 2", "Rod of Mayhem 2", "Rod of Remedy 2", "Sanguine Rod 2", "Soulhexer 2", "Underworld Rod 2", "Draining Inferniarch Rod 1", "Rending Inferniarch Rod 1", "Siphoning Inferniarch Rod 1"
  ],
  wand: [
    "Amber Wand 2", "Cobra Wand 2", "Crypt Bile 2", "Deepling Ceremonial Dagger 2", "Deepling Fork 2", "Dream Blossom Staff 2", "Eldritch Wand 2", "Energized Limb 2", "Falcon Wand 2", "Gilded Eldritch Wand 2", "Grand Sanguine Coil 2", "Inferniarch Wand 2", "Jungle Wand 2", "Lion Wand 2", "Naga Wand 2", "Sanguine Coil 2", "Soultainter 2", "Wand of Carving 2", "Wand of Destruction 2", "Wand of Draconia 2", "Wand of Dragonbreath 2", "Wand of Mayhem 2", "Wand of Remedy 2", "Wand of Starstorm 2", "Wand of Voodoo 2", "Draining Inferniarch Wand 1", "Rending Inferniarch Wand 1", "Siphoning Inferniarch Wand 1"
  ],
  bow: [
    "Amber Bow 3", "Bow of Carving 3", "Bow of Cataclysm 3", "Bow of Destruction 3", "Bow of Mayhem 3", "Bow of Remedy 3", "Composite Hornbow 3", "Crypt Spine 3", "Eldritch Bow 3", "Elvish Bow 3", "Falcon Bow 3", "Gilded Eldritch Bow 3", "Grand Sanguine Bow 3", "Hive Bow 3", "Icicle Bow 3", "Inferniarch Bow 3", "Lion Longbow 3", "Living Vine Bow 3", "Musician's Bow 3", "Mycological Bow 3", "Rift Bow 3", "Sanguine Bow 3", "Silkweaver Bow 3", "Soulbleeder 3", "Warsinger Bow 3", "Draining Inferniarch Bow 2", "Jungle Bow 2", "Rending Inferniarch Bow 2", "Siphoning Inferniarch Bow 2", "Umbral Master Bow 2", "Umbral Bow 1"
  ],
  crossbow: [
    "Amber Crossbow 3", "Chain Bolter 3", "Crossbow of Carving 3", "Crossbow of Destruction 3", "Crossbow of Mayhem 3", "Crossbow of Remedy 3", "Crossbow 3", "Grand Sanguine Crossbow 3", "Inferniarch Arbalest 3", "Modified Crossbow 3", "Naga Crossbow 3", "Rift Crossbow 3", "Royal Crossbow 3", "Sanguine Crossbow 3", "Soulpiercer 3", "The Devileye 3", "The Ironworker 3", "Thorn Spitter 3", "Triple Bolt Crossbow 3", "Cobra Crossbow 2", "Draining Inferniarch Arbalest 2", "Rending Inferniarch Arbalest 2", "Siphoning Inferniarch Arbalest 2", "Umbral Master Crossbow 2", "Umbral Crossbow 1"
  ],
  axe: [
    "Axe of Carving 3", "Axe of Mayhem 3", "Axe of Remedy 3", "Chopper of Carving 3", "Chopper of Destruction 3", "Chopper of Mayhem 3", "Chopper of Remedy 3", "Crypt Splitter 3", "Dragon Lance 3", "Drakinata 3", "Grand Sanguine Battleaxe 3", "Guardian Halberd 3", "Headchopper 3", "Ravager's Axe 3", "Rift Lance 3", "Sanguine Battleaxe 3", "Souleater (Axe) 3", "Twin Axe 3", "War Axe 3", "Zaoan Halberd 3", "Amber Axe 2", "Amber Greataxe 2", "Axe of Destruction 2", "Barbarian Axe 2", "Beastslayer Axe 2", "Butcher's Axe 2", "Cobra Axe 2", "Demonwing Axe 2", "Dreaded Cleaver 2", "Dwarven Axe 2", "Eldritch Greataxe 2", "Executioner 2", "Falcon Battleaxe 2", "Gilded Eldritch Greataxe 2", "Grand Sanguine Hatchet 2", "Great Axe 2", "Heroic Axe 2", "Hive Scythe 2", "Impaler 2", "Inferniarch Battleaxe 2", "Inferniarch Greataxe 2", "Knight Axe 2", "Lion Axe 2", "Mythril Axe 2", "Naga Axe 2", "Noble Axe 2", "Phantasmal Axe 2", "Royal Axe 2", "Ruthless Axe 2", "Sanguine Hatchet 2", "Soulbiter 2", "Umbral Master Chopper 2", "Warrior's Axe 2", "Crystalline Axe 1", "Draining Inferniarch Battleaxe 1", "Draining Inferniarch Greataxe 1", "Hellforged Axe 1", "Rending Inferniarch Battleaxe 1", "Rending Inferniarch Greataxe 1", "Siphoning Inferniarch Battleaxe 1", "Siphoning Inferniarch Greataxe 1", "Solar Axe 1", "Stonecutter Axe 1", "Throwing Axe 1", "Umbral Axe 1", "Umbral Chopper 1", "Umbral Master Axe 1"
  ],
  club: [
    "Abyss Hammer 3", "Amber Staff 3", "Crypt Breaker 3", "Grand Sanguine Bludgeon 3", "Hammer of Carving 3", "Hammer of Destruction 3", "Hammer of Mayhem 3", "Hammer of Remedy 3", "Hammer of Wrath 3", "Heavy Mace 3", "Lunar Staff 3", "Mace of Carving 3", "Mace of Mayhem 3", "Mace of Remedy 3", "Orcish Maul 3", "Sanguine Bludgeon 3", "Soulmaimer 3", "Spiked Squelcher 3", "War Hammer 3", "Amber Bludgeon 2", "Amber Cudgel 2", "Arcane Staff 2", "Blessed Sceptre 2", "Clerical Mace 2", "Cobra Club 2", "Cranial Basher 2", "Crystal Mace 2", "Deepling Squelcher 2", "Demonbone 2", "Dragonbone Staff 2", "Eldritch Warmace 2", "Energized Demonbone 2", "Falcon Mace 2", "Gilded Eldritch Warmace 2", "Glooth Whip 2", "Grand Sanguine Cudgel 2", "Inferniarch Flail 2", "Inferniarch Warhammer 2", "Jungle Flail 2", "Life Preserver 2", "Lion Hammer 2", "Mace of Destruction 2", "Mortal Mace 2", "Naga Club 2", "Onyx Flail 2", "Ornate Mace 2", "Queen's Sceptre 2", "Resizer 2", "Rotten Demonbone 2", "Sanguine Cudgel 2", "Sapphire Hammer 2", "Shadow Sceptre 2", "Silver Mace 2", "Skull Staff 2", "Skullcrusher 2", "Snake God's Sceptre 2", "Soulcrusher 2", "Sulphurous Demonbone 2", "The Stomper 2", "Thunder Hammer 2", "Umbral Master Hammer 2", "Unliving Demonbone 2", "Draining Inferniarch Flail 1", "Draining Inferniarch Warhammer 1", "Maimer 1", "Mycological Mace 1", "Obsidian Truncheon 1", "Rending Inferniarch Flail 1", "Rending Inferniarch Warhammer 1", "Siphoning Inferniarch Flail 1", "Siphoning Inferniarch Warhammer 1", "Umbral Hammer 1", "Umbral Mace 1", "Umbral Master Mace 1"
  ],
  sword: [
    "Berserker 3", "Blacksteel Sword 3", "Blade of Carving 3", "Blade of Mayhem 3", "Blade of Remedy 3", "Broadsword 3", "Crypt Slicer 3", "Demonrage Sword 3", "Dragon Slayer 3", "Giant Sword 3", "Grand Sanguine Razor 3", "Haunted Blade 3", "Havoc Blade 3", "Sanguine Razor 3", "Slayer of Carving 3", "Slayer of Destruction 3", "Slayer of Mayhem 3", "Slayer of Remedy 3", "Soulshredder 3", "Thaian Sword 3", "Twiceslicer 3", "Twin Hooks 3", "Amber Sabre 2", "Amber Slayer 2", "Assassin Dagger 2", "Blade of Corruption 2", "Blade of Destruction 2", "Bloody Edge 2", "Bright Sword 2", "Cobra Sword 2", "Crimson Sword 2", "Djinn Blade 2", "Eldritch Claymore 2", "Emerald Sword 2", "Epee 2", "Falcon Longsword 2", "Gilded Eldritch Claymore 2", "Gnome Sword 2", "Grand Sanguine Blade 2", "Inferniarch Blade 2", "Inferniarch Slayer 2", "Ink Sword 2", "Lion Longsword 2", "Magic Sword 2", "Mystic Blade 2", "Naga Sword 2", "Nightmare Blade 2", "Relic Sword 2", "Runed Sword 2", "Sanguine Blade 2", "Soulcutter 2", "Spike Sword 2", "Summerblade 2", "Sword 2", "Tagralt Blade 2", "The Avenger 2", "Umbral Master Slayer 2", "Winterblade 2", "Wyvern Fang 2", "Zaoan Sword 2", "Draining Inferniarch Blade 1", "Draining Inferniarch Slayer 1", "Rending Inferniarch Blade 1", "Rending Inferniarch Slayer 1", "Shiny Blade 1", "Siphoning Inferniarch Blade 1", "Siphoning Inferniarch Slayer 1", "The Epiphany 1", "Umbral Blade 1", "Umbral Masterblade 1", "Umbral Slayer 1"
  ],
  fist: [
    "Crypt Strike 3", "Grand Sanguine Claws 3", "Nunchaku of Destruction 3", "Sanguine Claws 3", "Soulkamas 3", "Amber Kusarigama 2", "Bambus Jo 2", "Cobra Bo 2", "Depth Claws 2", "Drachaku 2", "Eldritch Crescent Moon Spade 2", "Falcon Sai 2", "Gilded Eldritch Crescent Moon Spade 2", "Inferniarch Claws 2", "Lion Claws 2", "Naga Katar 2", "Pair of Iron Fists 2", "Traditional Sai 2", "Umbral Master Katar 2", "Draining Inferniarch Claws 1", "Fists of Enlightenment 1", "Nunchaku of Enlightenment 1", "Rending Inferniarch Claws 1", "Sai of Enlightenment 1", "Sai 1", "Siphoning Inferniarch Claws 1", "Umbral Katar 1"
  ],
  backpack: [
    "25 Years Backpack 1", "Adventurer Backpack 1", "Anniversary Backpack 1", "Backpack of Holding 1", "Backpack 1", "Beach Backpack 1", "Birthday Backpack 1", "Blue Backpack 1", "Book Backpack 1", "Brocade Backpack 1", "Buggy Backpack 1", "Bursa Obscura 1", "Cake Backpack 1", "Camouflage Backpack 1", "Changing Backpack 1", "Crown Backpack 1", "Crystal Backpack 1", "Deepling Backpack 1", "Demon Backpack 1", "Dragon Backpack 1", "Energetic Backpack 1", "Expedition Backpack 1", "Feedbag 1", "Festive Backpack 1", "Fur Backpack 1", "Ghost Backpack 1", "Glooth Backpack 1", "Golden Backpack 1", "Green Backpack 1", "Grey Backpack 1", "Heart Backpack 1", "Jewelled Backpack 1", "Lilypad Backpack 1", "Minotaur Backpack 1", "Moon Backpack 1", "Mushroom Backpack 1", "Old and Used Backpack 1", "Orange Backpack 1", "Pannier Backpack 1", "Peppermint Backpack 1", "Pillow Backpack 1", "Pirate Backpack 1", "Purple Backpack 1", "Raccoon Backpack 1", "Red Backpack 1", "Santa Backpack 1", "Winged Backpack 1", "Wolf Backpack 1", "Yellow Backpack 1"
  ]
};

// "Demon Helmet 2" → { name: 'Demon Helmet', slots: 2 }
const itemTypes = {};
for (const key in rawItems) {
  itemTypes[key] = rawItems[key].map(line => {
    const parts = line.trim().split(' ');
    const slots = parseInt(parts.pop(), 10);
    return { name: parts.join(' '), slots };
  });
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

const normalize = (s) => s
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita acentos

// distancia de Levenshtein (para "¿quisiste decir...?")
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Resuelve un tipo de item a partir de lo que escribió el usuario
function resolveType(q) {
  if (itemTypes[q]) return q;
  if (TYPE_ALIASES[q]) return TYPE_ALIASES[q];
  const singular = q.replace(/s$/, '');
  if (itemTypes[singular]) return singular;
  if (TYPE_ALIASES[singular]) return TYPE_ALIASES[singular];
  return null;
}

// Resuelve un imbuement a partir de lo que escribió el usuario
function resolveImbuement(q) {
  if (imbuements[q]) return q;
  if (IMB_ALIASES[q]) return IMB_ALIASES[q];

  const keys = Object.keys(imbuements);

  // coincidencia por inicio  (ej. "vamp" → vampirism)
  const starts = keys.filter(k => k.startsWith(q));
  if (starts.length === 1) return starts[0];

  // coincidencia parcial en nombre o efecto (ej. "leech" → void / vampirism)
  const partial = keys.filter(k =>
    k.includes(q) || normalize(imbuements[k].effect).includes(q)
  );
  if (partial.length === 1) return partial[0];

  return null;
}

// Sugerencias cuando no hay match
function suggest(q) {
  const pool = [
    ...Object.keys(imbuements),
    ...Object.keys(itemTypes)
  ];
  return pool
    .map(k => ({ k, d: levenshtein(q, k) }))
    .filter(x => x.d <= Math.max(2, Math.floor(x.k.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.k);
}

// Todas las coincidencias parciales (para listar opciones)
function matchesFor(q) {
  return Object.keys(imbuements).filter(k =>
    k.includes(q) || normalize(imbuements[k].effect).includes(q)
  );
}

// Línea de un imbuement en listados:  • 🔥 `scorch` — Fire Damage
const imbLine = (key) => {
  const i = imbuements[key];
  return `• ${i.emoji} ${c(key)} — _${i.effect}_`;
};

// Convierte tokens de compatibilidad en algo legible
function prettyCompatible(tokens) {
  const out = [];
  const rest = [...tokens];
  const take = (group, label) => {
    if (group.every(t => rest.includes(t))) {
      group.forEach(t => rest.splice(rest.indexOf(t), 1));
      out.push(label);
    }
  };
  take(MELEE, '⚔️ Melee');
  take(DISTANCE, '🏹 Distance');
  take(['wand', 'rod'], '🔮 Wand/Rod');
  rest.forEach(t => {
    const m = TYPE_META[t];
    out.push(m ? `${m.emoji} ${m.label}` : t);
  });
  return out.join(' · ');
}

// ═══════════════════════════════════════════════════════════
//  VISTAS
// ═══════════════════════════════════════════════════════════

function helpText() {
  return [
    'Elige qué quieres consultar:',
    '',
    `📜 ${c('!imbuement list')}`,
    '   _Todos los imbuements que existen_',
    '',
    `🧩 ${c('!imbuement type')}`,
    '   _Tipos de item que aceptan imbuement_',
    '',
    `🔎 ${c('!imbuement <nombre>')}`,
    `   _Materiales y niveles de un imbuement_`,
    `   Ej: ${c('!imbuement scorch')}`
  ].join('\n');
}

function typeText() {
  const lines = Object.keys(TYPE_META).map(t => {
    const m = TYPE_META[t];
    const n = itemTypes[t] ? itemTypes[t].length : 0;
    return `• ${m.emoji} ${c(t)} _(${n} items)_`;
  });

  return [
    ...lines,
    '',
    LINE,
    '🔎 Escribe un tipo para ver sus imbuements compatibles y los items.',
    `Ejemplo: ${c('!imbuement helmet')}`
  ].join('\n');
}

function listText() {
  const parts = [];

  for (const g in GROUPS) {
    const keys = Object.keys(imbuements).filter(k => imbuements[k].group === g);
    if (!keys.length) continue;
    if (parts.length) parts.push('');
    parts.push(`${GROUPS[g].emoji} ${b(GROUPS[g].label)}`);
    keys.forEach(k => parts.push(imbLine(k)));
  }

  parts.push('');
  parts.push(LINE);
  parts.push('🔎 Escribe un imbuement para ver sus materiales.');
  parts.push(`Ejemplo: ${c('!imbuement scorch')}`);

  return parts.join('\n');
}

function detailText(key) {
  const i = imbuements[key];
  const LEVELS = [
    { n: '1️⃣', label: 'Basic' },
    { n: '2️⃣', label: 'Intricate' },
    { n: '3️⃣', label: 'Powerful' }
  ];

  const parts = [
    `${i.emoji} ${b(i.label)} — _${i.effect}_`,
    '',
    '🧪 ' + b('Materiales por nivel:')
  ];

  LEVELS.forEach((lv, idx) => {
    if (idx > 0) parts.push('');   // sin salto antes del primer nivel
    parts.push(`${lv.n} ${b(lv.label)} — ${i.values[idx]}`);
    // nivel 1 = 1er material, nivel 2 = 1er + 2do, nivel 3 = los tres
    i.materials.slice(0, idx + 1).forEach(m => parts.push(`• ${m}`));
  });

  parts.push('');
  parts.push(`🧩 ${b('Se aplica en:')}`);
  parts.push(prettyCompatible(i.compatible));
  parts.push('');
  parts.push(LINE);
  parts.push(`🎒 Ver items de un tipo: ${c('!imbuement helmet')}`);
  parts.push(`📜 Ver todos: ${c('!imbuement list')}`);

  return parts.join('\n');
}

function typeDetailText(type) {
  const items = itemTypes[type];

  // imbuements compatibles, ordenados por grupo
  const compatKeys = Object.keys(imbuements)
    .filter(k => imbuements[k].compatible.includes(type))
    .sort((a, b2) => {
      const order = Object.keys(GROUPS);
      return order.indexOf(imbuements[a].group) - order.indexOf(imbuements[b2].group);
    });

  const parts = [
    `📜 ${b(`Imbuements compatibles (${compatKeys.length})`)}`
  ];

  parts.push(compatKeys.length ? compatKeys.map(imbLine).join('\n') : '_Ninguno_');

  // items agrupados por slots (3 → 1)
  parts.push('');
  parts.push(`🎒 ${b('Lista de items:')}`);

  const bySlots = {};
  items.forEach(it => {
    (bySlots[it.slots] = bySlots[it.slots] || []).push(it.name);
  });

  Object.keys(bySlots)
    .map(Number)
    .sort((a, b2) => b2 - a)
    .forEach(s => {
      const names = bySlots[s].slice().sort((a, b2) => a.localeCompare(b2));
      parts.push('');
      parts.push(`🔹 ${b(`${s} slot${s > 1 ? 's' : ''}`)}`);
      parts.push(names.join(' · '));
    });

  parts.push('');
  parts.push(LINE);
  if (compatKeys.length) {
    parts.push(`🧪 Ver materiales: ${c('!imbuement ' + compatKeys[0])}`);
  }
  parts.push(`🧩 Otros tipos: ${c('!imbuement type')}`);

  return parts.join('\n');
}

function notFoundText(query) {
  const sug = suggest(query);
  const parts = [
    `❎ No encontré ${b('"' + query + '"')}`,
    ''
  ];

  if (sug.length) {
    parts.push('🤔 ' + b('¿Quisiste decir?'));
    sug.forEach(s => parts.push(`• ${c('!imbuement ' + s)}`));
    parts.push('');
  }

  parts.push(LINE);
  parts.push(`📜 Ver todos los imbuements: ${c('!imbuement list')}`);
  parts.push(`🧩 Ver tipos de item: ${c('!imbuement type')}`);
  return parts.join('\n');
}

function multipleMatchesText(query, keys) {
  const parts = [
    `🔎 ${keys.length} imbuements coinciden con ${b('"' + query + '"')}`,
    ''
  ];
  keys.forEach(k => parts.push(imbLine(k)));
  parts.push('');
  parts.push(LINE);
  parts.push('Escribe el nombre completo para ver sus materiales.');
  parts.push(`Ejemplo: ${c('!imbuement ' + keys[0])}`);
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════
//  COMANDO
// ═══════════════════════════════════════════════════════════
module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);
    const query = normalize(args.join(' '));

    // ── sin argumentos / ayuda ────────────────────────────
    if (!query || ['help', 'ayuda', '?', 'h'].includes(query)) {
      return await msg.reply(helpText());
    }

    // ── tipos de item ─────────────────────────────────────
    if (['type', 'types', 'tipo', 'tipos', 'slots', 'items'].includes(query)) {
      return await msg.reply(typeText());
    }

    // ── lista completa ────────────────────────────────────
    if (['list', 'lista', 'all', 'todos'].includes(query)) {
      return await msg.reply(listText());
    }

    // ── tipo de item concreto ─────────────────────────────
    const type = resolveType(query);
    if (type) {
      return await msg.reply(typeDetailText(type));
    }

    // ── imbuement concreto ────────────────────────────────
    const key = resolveImbuement(query);
    if (key) {
      return await msg.reply(detailText(key));
    }

    // ── varias coincidencias parciales ────────────────────
    const matches = matchesFor(query);
    if (matches.length > 1) {
      return await msg.reply(multipleMatchesText(query, matches));
    }

    // ── nada ──────────────────────────────────────────────
    const errorMsg = await msg.reply(notFoundText(args.join(' ')));
    await errorMsg.react('❎');
    await msg.react('❎');
    return null;

  } catch (error) {
    console.error('Error en comando imbuement:', error);
    try { await msg.react('❎'); } catch { }
    throw error;
  }
};
