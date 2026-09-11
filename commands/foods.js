// ═══════════════════════════════════════════════════════════
//  !food  —  Comidas con buff de Tibia
// ═══════════════════════════════════════════════════════════
//  Comando informativo. No recibe argumentos.
// ═══════════════════════════════════════════════════════════

const c = (s) => '`' + s + '`';           // formato código de WhatsApp
const b = (s) => '*' + s + '*';           // negrita

// ─────────────────────────────────────────────
// 🍗 DATOS
//   effect → qué hace
//   shop   → dónde se consigue
//   npc    → diálogo con el Hireling (opcional)
//
//   Para agregar el diálogo de un platillo del Hireling:
//   npc: ['hi', 'food', 'specific', 'PALABRA', 'confirm']
// ─────────────────────────────────────────────
const foods = {
  vida: {
    emoji: '❤️',
    label: 'VIDA',
    items: [
      {
        emoji: '🍓',
        name: 'Strawberry Cupcake',
        effect: 'Restaura 100% de la vida',
        shop: 'Market · evento A Piece of Cake'
      },
      {
        emoji: '🥘',
        name: 'Rotworm Stew',
        effect: 'Restaura 100% de la vida',
        shop: 'Market · Hot Cuisine (Jean Pierre)'
      },
      {
        emoji: '🍺',
        name: 'Pot of Blackjack',
        effect: 'Restaura 5.000 de vida',
        shop: 'Market · Hot Cuisine (Jean Pierre)'
      },
      {
        emoji: '🍲',
        name: 'Carrion Casserole',
        effect: 'Restaura 30% de la vida máxima',
        shop: 'Hireling (NPC de tu house)',
        npc: ['hi', 'food', 'specific', 'CASSEROLE', 'confirm']
      }
    ]
  },

  mana: {
    emoji: '💙',
    label: 'MANÁ',
    items: [
      {
        emoji: '🧁',
        name: 'Blueberry Cupcake',
        effect: 'Restaura 100% del maná',
        shop: 'Market · evento A Piece of Cake'
      },
      {
        emoji: '🍖',
        name: 'Blessed Steak',
        effect: 'Restaura 100% del maná',
        shop: 'Market · Hot Cuisine (Jean Pierre)'
      },
      {
        emoji: '🥩',
        name: 'Consecrated Beef',
        effect: 'Restaura 30% del maná máximo',
        shop: 'Hireling (NPC de tu house)',
        npc: ['hi', 'food', 'specific', 'BEEF', 'confirm']
      }
    ]
  },

  skills: {
    emoji: '⚔️',
    label: 'SKILLS',
    items: [
      {
        emoji: '🥗',
        name: 'Delicatessen Salad',
        effect: '+3 a todas las skills melee por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🐯',
        name: 'Tropical Marinated Tiger',
        effect: '+3 magic level por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🍗',
        name: 'Roasted Wyvern Wings',
        effect: '+7 shielding por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🥕',
        name: 'Carrot Pie',
        effect: '+7 distance por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🍋',
        name: 'Lemon Cupcake',
        effect: '+10 distance por 1 hora',
        shop: 'Market · evento A Piece of Cake'
      }
    ]
  },

  utilidad: {
    emoji: '🏃',
    label: 'UTILIDAD',
    items: [
      {
        emoji: '🌶️',
        name: 'Chilli Con Carniphila',
        effect: '+80 de velocidad por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🐟',
        name: 'Svargrond Salmon Filet',
        effect: '+30 de fishing por 1 hora',
        shop: 'Hireling (NPC de tu house)'
      },
      {
        emoji: '🍜',
        name: 'Overcooked Noodles',
        effect: 'Sin bonus, solo quita el hambre',
        shop: 'Hireling (NPC de tu house)'
      }
    ]
  }
};

// ═══════════════════════════════════════════════════════════
//  VISTA
// ═══════════════════════════════════════════════════════════
function foodText() {
  const parts = [];

  for (const key in foods) {
    const group = foods[key];
    if (parts.length) parts.push('');
    parts.push(`${group.emoji} ${b(group.label)}`);

    group.items.forEach(it => {
      parts.push('');
      parts.push(`${it.emoji} ${b(it.name)}`);
      parts.push(`• ${it.effect}`);
      parts.push(`• 🛒 ${it.shop} · ⏳ 10 min`);
      if (it.npc) {
        parts.push(`• 💬 ${it.npc.map(c).join(' → ')}`);
      }
    });
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════
//  COMANDO
// ═══════════════════════════════════════════════════════════
module.exports = async (msg) => {
  return await msg.reply(foodText());
};
