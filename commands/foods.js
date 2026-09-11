// ═══════════════════════════════════════════════════════════
//  !food  —  Comidas que restauran vida y maná
// ═══════════════════════════════════════════════════════════
//  Comando informativo. No recibe argumentos.
// ═══════════════════════════════════════════════════════════

const c = (s) => '`' + s + '`';           // formato código de WhatsApp
const b = (s) => '*' + s + '*';           // negrita

// ─────────────────────────────────────────────
// 🍗 DATOS
//   heal  → qué restaura
//   shop  → dónde se consigue
//   npc   → diálogo con el NPC (opcional)
// ─────────────────────────────────────────────
const foods = {
  mana: {
    emoji: '💙',
    label: 'MANÁ',
    items: [
      {
        emoji: '🥩',
        name: 'Consecrated Beef',
        heal: 'Restaura 30% del maná total',
        shop: 'NPC de House',
        npc: ['hi', 'food', 'specific', 'BEEF', 'confirm']
      },
      {
        emoji: '🧁',
        name: 'Blueberry Cupcake',
        heal: 'Restaura 100% del maná',
        shop: 'Market o Store'
      },
      {
        emoji: '🍖',
        name: 'Blessed Steak',
        heal: 'Restaura 100% del maná',
        shop: 'Market o Store'
      }
    ]
  },

  vida: {
    emoji: '❤️',
    label: 'VIDA',
    items: [
      {
        emoji: '🍲',
        name: 'Carrion Casserole',
        heal: 'Restaura 30% de la vida total',
        shop: 'NPC de House',
        npc: ['hi', 'food', 'specific', 'CASSEROLE', 'confirm']
      },
      {
        emoji: '🍓',
        name: 'Strawberry Cupcake',
        heal: 'Restaura 100% de la vida',
        shop: 'Market o Store'
      },
      {
        emoji: '🥘',
        name: 'Rotworm Stew',
        heal: 'Restaura 100% de la vida',
        shop: 'Market o Store'
      },
      {
        emoji: '🍺',
        name: 'Pot of Blackjack',
        heal: 'Restaura 5.000 de vida',
        shop: 'Market o Store'
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
      parts.push(`• ${it.heal}`);
      parts.push(`• 🛒 ${it.shop}`);
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
