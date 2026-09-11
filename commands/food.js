// ═══════════════════════════════════════════════════════════
//  !food  —  Comidas con buff de Tibia
// ═══════════════════════════════════════════════════════════
//  Uso:
//    !food                → ayuda
//    !food list           → todas las comidas
//    !food <categoría>    → solo esa categoría
//    !food <nombre>       → una comida en concreto
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
//   src    → de dónde sale (clave de SRC)
//   npc    → diálogo del Hireling (opcional)
//   note   → advertencia (opcional)
//   sub    → lista de sub-efectos (opcional)
//
//   Diálogo del Hireling:
//   npc: ['hi', 'food', 'specific', 'PALABRA', 'confirm']
// ─────────────────────────────────────────────
const categories = {
  vida: {
    emoji: '❤️', label: 'VIDA',
    items: [
      { emoji: '🍲', name: 'Carrion Casserole', effect: 'Restaura 30% de la vida máxima', src: 'hireling',
        npc: ['hi', 'food', 'specific', 'CASSEROLE', 'confirm'] },
      { emoji: '🍺', name: 'Pot of Blackjack', effect: 'Restaura 5.000 de vida', src: 'jean' },
      { emoji: '🥘', name: 'Rotworm Stew', effect: 'Restaura 100% de la vida', src: 'jean' },
      { emoji: '🍓', name: 'Strawberry Cupcake', effect: 'Restaura 100% de la vida', src: 'cake' }
    ]
  },

  mana: {
    emoji: '💙', label: 'MANÁ',
    items: [
      { emoji: '🥩', name: 'Consecrated Beef', effect: 'Restaura 30% del maná máximo', src: 'hireling',
        npc: ['hi', 'food', 'specific', 'BEEF', 'confirm'] },
      { emoji: '🍖', name: 'Blessed Steak', effect: 'Restaura 100% del maná', src: 'jean' },
      { emoji: '🧁', name: 'Blueberry Cupcake', effect: 'Restaura 100% del maná', src: 'cake' }
    ]
  },

  estados: {
    emoji: '🧪', label: 'ESTADOS',
    items: [
      { emoji: '🥬', name: 'Hydra Tongue Salad', effect: 'Cura veneno, sangrado, fuego y demás', src: 'jean',
        note: 'No quita Rooted ni Feared' }
    ]
  },

  melee: {
    emoji: '⚔️', label: 'MELEE',
    items: [
      { emoji: '🥗', name: 'Delicatessen Salad', effect: '+3 a todas las melee · 1 hora', src: 'hireling' },
      { emoji: '🍛', name: 'Veggie Casserole', effect: '+10 a sword, axe y club · 1 hora', src: 'jean',
        note: 'No incluye fist fighting' }
    ]
  },

  distance: {
    emoji: '🎯', label: 'DISTANCE',
    items: [
      { emoji: '🥕', name: 'Carrot Pie', effect: '+7 · 1 hora', src: 'hireling' },
      { emoji: '🍋', name: 'Lemon Cupcake', effect: '+10 · 1 hora', src: 'cake' },
      { emoji: '🍰', name: 'Carrot Cake', effect: '+10 · 1 hora', src: 'jean',
        note: 'Se pierde con Bullseye Potion o si mueres' }
    ]
  },

  shielding: {
    emoji: '🛡️', label: 'SHIELDING',
    items: [
      { emoji: '🍗', name: 'Roasted Wyvern Wings', effect: '+7 · 1 hora', src: 'hireling' },
      { emoji: '🐉', name: 'Roasted Dragon Wings', effect: '+10 · 1 hora', src: 'falcon' }
    ]
  },

  ml: {
    emoji: '✨', label: 'MAGIC LEVEL',
    items: [
      { emoji: '🐯', name: 'Tropical Marinated Tiger', effect: '+3 · 1 hora', src: 'hireling' },
      { emoji: '🍗', name: 'Tropical Fried Terrorbird', effect: '+5 · 1 hora', src: 'jean' }
    ]
  },

  velocidad: {
    emoji: '🏃', label: 'VELOCIDAD',
    items: [
      { emoji: '🌶️', name: 'Chilli Con Carniphila', effect: '+80 · 1 hora', src: 'hireling' },
      { emoji: '🫑', name: 'Filled Jalapeno Peppers', effect: '+100 · 1 hora', src: 'jean',
        note: 'Se pierde si usas haste o te paralizan' }
    ]
  },

  fishing: {
    emoji: '🎣', label: 'FISHING',
    items: [
      { emoji: '🐟', name: 'Svargrond Salmon Filet', effect: '+30 · 1 hora', src: 'hireling' },
      { emoji: '🍔', name: 'Northern Fishburger', effect: '+50 · 1 hora', src: 'jean' }
    ]
  },

  otros: {
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
};

// Alias de categorías (español, inglés, abreviaturas)
const CAT_ALIASES = {
  hp: 'vida', life: 'vida', salud: 'vida', health: 'vida',
  mp: 'mana', 'maná': 'mana',
  estado: 'estados', curacion: 'estados', 'curación': 'estados', cura: 'estados', condiciones: 'estados',
  melees: 'melee', sword: 'melee', axe: 'melee', club: 'melee', espada: 'melee', hacha: 'melee',
  dist: 'distance', distancia: 'distance', arco: 'distance', bow: 'distance',
  shield: 'shielding', escudo: 'shielding', defensa: 'shielding', def: 'shielding',
  magic: 'ml', 'magic level': 'ml', magiclevel: 'ml', magia: 'ml', mlvl: 'ml',
  speed: 'velocidad', haste: 'velocidad', vel: 'velocidad', rapidez: 'velocidad',
  fish: 'fishing', pesca: 'fishing', pescar: 'fishing',
  otro: 'otros', varios: 'otros', random: 'otros'
};

// Índice plano para buscar por nombre
const ALL = [];
for (const id in categories) {
  categories[id].items.forEach(it => ALL.push(Object.assign({ cat: id }, it)));
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

const normalize = (s) => s
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // quita acentos

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, x) => x);
  for (let x = 1; x <= m; x++) {
    const cur = [x];
    for (let y = 1; y <= n; y++) {
      cur[y] = Math.min(prev[y] + 1, cur[y - 1] + 1, prev[y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function resolveCategory(q) {
  if (categories[q]) return q;
  if (CAT_ALIASES[q]) return CAT_ALIASES[q];
  const singular = q.replace(/s$/, '');
  if (categories[singular]) return singular;
  if (CAT_ALIASES[singular]) return CAT_ALIASES[singular];
  return null;
}

function matchesFor(q) {
  return ALL.filter(f => normalize(f.name).includes(q));
}

function suggest(q) {
  const pool = Object.keys(categories).concat(ALL.map(f => normalize(f.name)));
  return pool
    .map(k => ({ k, d: levenshtein(q, k) }))
    .filter(x => x.d <= Math.max(2, Math.floor(x.k.length / 3)))
    .sort((a, b2) => a.d - b2.d)
    .slice(0, 3)
    .map(x => x.k);
}

// Bloque de una comida
function itemLines(it) {
  const out = [
    `${it.emoji} ${b(it.name)}`,
    `• ${it.effect}`
  ];
  if (it.sub) it.sub.forEach(s => out.push(`   ↳ ${s}`));
  if (it.note) out.push(`• ⚠️ ${i(it.note)}`);
  out.push(`• 📍 ${SRC[it.src]}`);
  if (it.npc) out.push(`• 💬 ${it.npc.map(c).join(' → ')}`);
  return out;
}

const HEADER = [
  '⏳ 1 platillo cada 10 min ' + i('(los cupcakes van aparte)'),
  '📍 ' + i('Origen en Tibia global; en OTs suelen estar en Store o Market.')
];

// ═══════════════════════════════════════════════════════════
//  VISTAS
// ═══════════════════════════════════════════════════════════

function helpText() {
  const cats = Object.keys(categories).map(id =>
    `• ${categories[id].emoji} ${c(id)}`
  );

  return [
    'Elige qué quieres consultar:',
    '',
    `📜 ${c('!food list')}`,
    '   _Todas las comidas con buff_',
    '',
    `🔎 ${c('!food <nombre>')}`,
    '   _Una comida en concreto_',
    `   Ej: ${c('!food carrot pie')}`,
    '',
    `🏷️ ${c('!food <categoría>')}`,
    '   _Solo las de esa categoría_',
    `   Ej: ${c('!food distance')}`,
    '',
    ...cats
  ].join('\n');
}

function listText() {
  const parts = HEADER.slice();

  for (const id in categories) {
    const cat = categories[id];
    parts.push('');
    parts.push(`${cat.emoji} ${b(cat.label)}`);
    cat.items.forEach(it => {
      parts.push('');
      parts.push(...itemLines(it));
    });
  }

  return parts.join('\n');
}

function categoryText(id) {
  const cat = categories[id];
  const parts = [`${cat.emoji} ${b(cat.label)}`, ...HEADER];

  cat.items.forEach(it => {
    parts.push('');
    parts.push(...itemLines(it));
  });

  return parts.join('\n');
}

function detailText(it) {
  const cat = categories[it.cat];
  return [
    ...itemLines(it),
    `• 🏷️ ${cat.emoji} ${cat.label}`,
    '',
    `⏳ ${i('1 platillo cada 10 min')}`
  ].join('\n');
}

function multipleMatchesText(query, list) {
  const parts = [
    `🔎 ${list.length} comidas coinciden con ${b('"' + query + '"')}`,
    ''
  ];
  list.forEach(f => parts.push(`• ${f.emoji} ${b(f.name)} — ${f.effect}`));
  parts.push('');
  parts.push('Escribe el nombre completo para ver sus detalles.');
  parts.push(`Ejemplo: ${c('!food ' + list[0].name.toLowerCase())}`);
  return parts.join('\n');
}

function notFoundText(query) {
  const sug = suggest(normalize(query));
  const parts = [`No encontré ${b('"' + query + '"')}`, ''];

  if (sug.length) {
    parts.push('🤔 ' + b('¿Quisiste decir?'));
    sug.forEach(s => parts.push(`• ${c('!food ' + s)}`));
    parts.push('');
  }

  parts.push(`📜 Ver todas las comidas: ${c('!food list')}`);
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════
//  COMANDO
// ═══════════════════════════════════════════════════════════
module.exports = async (msg) => {
  const args = msg.body.split(' ').slice(1);
  const query = normalize(args.join(' '));

  // ── sin argumentos / ayuda ────────────────────────────
  if (!query || ['help', 'ayuda', '?', 'h'].includes(query)) {
    return await msg.reply(helpText());
  }

  // ── lista completa ────────────────────────────────────
  if (['list', 'lista', 'all', 'todo', 'todos', 'todas'].includes(query)) {
    return await msg.reply(listText());
  }

  // ── categoría ─────────────────────────────────────────
  const cat = resolveCategory(query);
  if (cat) {
    return await msg.reply(categoryText(cat));
  }

  // ── comida concreta ───────────────────────────────────
  const matches = matchesFor(query);
  if (matches.length === 1) {
    return await msg.reply(detailText(matches[0]));
  }
  if (matches.length > 1) {
    return await msg.reply(multipleMatchesText(args.join(' '), matches));
  }

  // ── nada ──────────────────────────────────────────────
  return await msg.reply(notFoundText(args.join(' ')));
};
