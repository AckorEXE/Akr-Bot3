// ═══════════════════════════════════════════════════════════
//  !food  —  Comidas con buff de Tibia
// ═══════════════════════════════════════════════════════════
//  Comando informativo. No recibe argumentos.
// ═══════════════════════════════════════════════════════════

const c = (s) => '`' + s + '`';           // formato código de WhatsApp
const b = (s) => '*' + s + '*';           // negrita
const i = (s) => '_' + s + '_';           // cursiva

// ─────────────────────────────────────────────
//  ORÍGENES
//  Son los de Tibia global. En OTs casi todos
//  se consiguen además en Store o Market.
// ─────────────────────────────────────────────
const SRC = {
  hireling: 'Hireling Cook (NPC de tu house)',
  jean:     'Jean Pierre (Hot Cuisine)',
  cake:     'Evento A Piece of Cake',
  falcon:   'Jean Pierre · Falcon Bastion'
};

// ─────────────────────────────────────────────
// 🍗 DATOS
//   effect → qué hace
//   src    → de dónde sale
//   npc    → diálogo del Hireling (opcional)
//   note   → advertencia (opcional)
//   sub    → lista de sub-efectos (opcional)
//
//   Diálogo del Hireling:
//   npc: ['hi', 'food', 'specific', 'PALABRA', 'confirm']
// ─────────────────────────────────────────────
const groups = [
  {
    emoji: '❤️', label: 'VIDA',
    items: [
      { emoji: '🍲', name: 'Carrion Casserole', effect: 'Restaura 30% de la vida máxima', src: 'hireling',
        npc: ['hi', 'food', 'specific', 'CASSEROLE', 'confirm'] },
      { emoji: '🍺', name: 'Pot of Blackjack', effect: 'Restaura 5.000 de vida', src: 'jean' },
      { emoji: '🥘', name: 'Rotworm Stew', effect: 'Restaura 100% de la vida', src: 'jean' },
      { emoji: '🍓', name: 'Strawberry Cupcake', effect: 'Restaura 100% de la vida', src: 'cake' }
    ]
  },
  {
    emoji: '💙', label: 'MANÁ',
    items: [
      { emoji: '🥩', name: 'Consecrated Beef', effect: 'Restaura 30% del maná máximo', src: 'hireling',
        npc: ['hi', 'food', 'specific', 'BEEF', 'confirm'] },
      { emoji: '🍖', name: 'Blessed Steak', effect: 'Restaura 100% del maná', src: 'jean' },
      { emoji: '🧁', name: 'Blueberry Cupcake', effect: 'Restaura 100% del maná', src: 'cake' }
    ]
  },
  {
    emoji: '🧪', label: 'ESTADOS',
    items: [
      { emoji: '🥬', name: 'Hydra Tongue Salad', effect: 'Cura veneno, sangrado, fuego y demás', src: 'jean',
        note: 'No quita Rooted ni Feared' }
    ]
  },
  {
    emoji: '⚔️', label: 'MELEE',
    items: [
      { emoji: '🥗', name: 'Delicatessen Salad', effect: '+3 a todas las melee · 1 hora', src: 'hireling' },
      { emoji: '🍛', name: 'Veggie Casserole', effect: '+10 a sword, axe y club · 1 hora', src: 'jean',
        note: 'No incluye fist fighting' }
    ]
  },
  {
    emoji: '🎯', label: 'DISTANCE',
    items: [
      { emoji: '🥕', name: 'Carrot Pie', effect: '+7 · 1 hora', src: 'hireling' },
      { emoji: '🍋', name: 'Lemon Cupcake', effect: '+10 · 1 hora', src: 'cake' },
      { emoji: '🍰', name: 'Carrot Cake', effect: '+10 · 1 hora', src: 'jean',
        note: 'Se pierde con Bullseye Potion o si mueres' }
    ]
  },
  {
    emoji: '🛡️', label: 'SHIELDING',
    items: [
      { emoji: '🍗', name: 'Roasted Wyvern Wings', effect: '+7 · 1 hora', src: 'hireling' },
      { emoji: '🐉', name: 'Roasted Dragon Wings', effect: '+10 · 1 hora', src: 'falcon' }
    ]
  },
  {
    emoji: '✨', label: 'MAGIC LEVEL',
    items: [
      { emoji: '🐯', name: 'Tropical Marinated Tiger', effect: '+3 · 1 hora', src: 'hireling' },
      { emoji: '🍗', name: 'Tropical Fried Terrorbird', effect: '+5 · 1 hora', src: 'jean' }
    ]
  },
  {
    emoji: '🏃', label: 'VELOCIDAD',
    items: [
      { emoji: '🌶️', name: 'Chilli Con Carniphila', effect: '+80 · 1 hora', src: 'hireling' },
      { emoji: '🫑', name: 'Filled Jalapeno Peppers', effect: '+100 · 1 hora', src: 'jean',
        note: 'Se pierde si usas haste o te paralizan' }
    ]
  },
  {
    emoji: '🎣', label: 'FISHING',
    items: [
      { emoji: '🐟', name: 'Svargrond Salmon Filet', effect: '+30 · 1 hora', src: 'hireling' },
      { emoji: '🍔', name: 'Northern Fishburger', effect: '+50 · 1 hora', src: 'jean' }
    ]
  },
  {
    emoji: '🎲', label: 'OTROS',
    items: [
      { emoji: '🍬', name: 'Demonic Candy Ball', effect: 'Efecto aleatorio al comerla', src: 'jean',
        sub: [
          '+6 melee · 1 hora',
          '+6 distance · 1 hora',
          '+6 shielding · 1 hora',
          '+3 magic level · 1 hora',
          'Más velocidad · 1 hora',
          'Luz como Ultimate Light · 2 horas',
          'Invisibilidad · 10 min _(raro)_',
          'Te vuelve Mutated Pumpkin · 5 horas _(raro)_'
        ] },
      { emoji: '🍜', name: 'Overcooked Noodles', effect: 'Sin bonus, solo quita el hambre', src: 'hireling' }
    ]
  }
];

// ═══════════════════════════════════════════════════════════
//  VISTA
// ═══════════════════════════════════════════════════════════
function foodText() {
  const parts = [
    '🍗 ' + b('COMIDAS CON BUFF'),
    '⏳ 1 platillo cada 10 min ' + i('(los cupcakes van aparte)'),
    '📍 ' + i('Origen en Tibia global; en OTs suelen estar en Store o Market.')
  ];

  groups.forEach(g => {
    parts.push('');
    parts.push(`${g.emoji} ${b(g.label)}`);

    g.items.forEach(it => {
      parts.push('');
      parts.push(`${it.emoji} ${b(it.name)}`);
      parts.push(`• ${it.effect}`);
      if (it.sub) it.sub.forEach(s => parts.push(`   ↳ ${s}`));
      if (it.note) parts.push(`• ⚠️ ${i(it.note)}`);
      parts.push(`• 📍 ${SRC[it.src]}`);
      if (it.npc) parts.push(`• 💬 ${it.npc.map(c).join(' → ')}`);
    });
  });

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════
//  COMANDO
// ═══════════════════════════════════════════════════════════
module.exports = async (msg) => {
  return await msg.reply(foodText());
};
