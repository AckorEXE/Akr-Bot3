const fs = require('fs');
const path = require('path');

const MONSTERS_FILE = path.join(
    __dirname,
    '..',
    'utils',
    'monsters_enhanced_complete.json'
);

let monsters = null;
let monsterMap = null;

/**
 * Carga los monsters una sola vez y los mantiene en memoria.
 */
function loadMonsters() {
    if (monsters !== null) {
        return monsters;
    }

    try {
        if (!fs.existsSync(MONSTERS_FILE)) {
            console.error(`[MonsterLocal] No existe: ${MONSTERS_FILE}`);
            monsters = [];
            monsterMap = new Map();
            return monsters;
        }

        const raw = fs.readFileSync(MONSTERS_FILE, 'utf8');
        const data = JSON.parse(raw);

        if (Array.isArray(data)) {
            monsters = data;
        } else if (Array.isArray(data.monsters)) {
            monsters = data.monsters;
        } else if (typeof data === 'object' && data !== null) {
            monsters = Object.values(data);
        } else {
            monsters = [];
        }

        monsterMap = new Map();

        for (const monster of monsters) {
            if (!monster || typeof monster !== 'object') {
                continue;
            }

            const name =
                monster.name ||
                monster.Name ||
                monster.monster ||
                monster.Monster;

            if (!name) {
                continue;
            }

            monster.name = String(name);

            monsterMap.set(normalizeName(name), monster);
        }

        console.log(
            `[MonsterLocal] Cargados ${monsters.length} monsters desde JSON`
        );

        return monsters;
    } catch (error) {
        console.error(
            '[MonsterLocal] Error cargando monsters:',
            error.message
        );

        monsters = [];
        monsterMap = new Map();

        return monsters;
    }
}

/**
 * Normaliza nombres para búsquedas.
 */
function normalizeName(name) {
    return String(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Distancia Levenshtein.
 */
function levenshtein(a, b) {
    a = normalizeName(a);
    b = normalizeName(b);

    if (a === b) {
        return 0;
    }

    if (!a.length) {
        return b.length;
    }

    if (!b.length) {
        return a.length;
    }

    const previous = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) {
        previous[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        const current = new Array(b.length + 1);
        current[0] = i;

        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;

            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }

        for (let j = 0; j <= b.length; j++) {
            previous[j] = current[j];
        }
    }

    return previous[b.length];
}

/**
 * Obtiene un monster por nombre.
 *
 * Orden:
 * 1. Coincidencia exacta
 * 2. Coincidencia parcial
 * 3. Coincidencia aproximada
 */
function findMonster(query) {
    loadMonsters();

    if (!query || typeof query !== 'string') {
        return null;
    }

    const normalizedQuery = normalizeName(query);

    if (!normalizedQuery) {
        return null;
    }

    // Exacta
    const exact = monsterMap.get(normalizedQuery);

    if (exact) {
        return exact;
    }

    // Parcial
    const partialMatches = [];

    for (const monster of monsters) {
        if (!monster || !monster.name) {
            continue;
        }

        const normalizedName = normalizeName(monster.name);

        if (
            normalizedName.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedName)
        ) {
            partialMatches.push(monster);
        }
    }

    if (partialMatches.length > 0) {
        partialMatches.sort((a, b) => {
            const aName = normalizeName(a.name);
            const bName = normalizeName(b.name);

            const aDistance = Math.abs(
                aName.length - normalizedQuery.length
            );

            const bDistance = Math.abs(
                bName.length - normalizedQuery.length
            );

            return aDistance - bDistance;
        });

        return partialMatches[0];
    }

    // Aproximada
    let bestMonster = null;
    let bestDistance = Infinity;

    for (const monster of monsters) {
        if (!monster || !monster.name) {
            continue;
        }

        const normalizedName = normalizeName(monster.name);

        const distance = levenshtein(
            normalizedQuery,
            normalizedName
        );

        const maxAllowed = Math.max(
            2,
            Math.floor(normalizedQuery.length * 0.4)
        );

        if (
            distance <= maxAllowed &&
            distance < bestDistance
        ) {
            bestDistance = distance;
            bestMonster = monster;
        }
    }

    return bestMonster;
}

/**
 * Busca múltiples monsters.
 */
function searchMonsters(query, limit = 10) {
    loadMonsters();

    if (!query || typeof query !== 'string') {
        return [];
    }

    const normalizedQuery = normalizeName(query);

    if (!normalizedQuery) {
        return [];
    }

    const results = [];

    for (const monster of monsters) {
        if (!monster || !monster.name) {
            continue;
        }

        const normalizedName = normalizeName(monster.name);

        let score = 0;

        if (normalizedName === normalizedQuery) {
            score = 100;
        } else if (normalizedName.startsWith(normalizedQuery)) {
            score = 80;
        } else if (normalizedName.includes(normalizedQuery)) {
            score = 60;
        } else {
            const distance = levenshtein(
                normalizedQuery,
                normalizedName
            );

            const maxAllowed = Math.max(
                2,
                Math.floor(normalizedQuery.length * 0.4)
            );

            if (distance <= maxAllowed) {
                score = 40 - distance;
            }
        }

        if (score > 0) {
            results.push({
                monster,
                score
            });
        }
    }

    results.sort((a, b) => b.score - a.score);

    return results
        .slice(0, limit)
        .map(result => result.monster);
}

/**
 * Obtiene todos los monsters.
 */
function getAllMonsters() {
    return loadMonsters();
}

/**
 * Cantidad de monsters cargados.
 */
function getMonsterCount() {
    loadMonsters();
    return monsters.length;
}

/**
 * Busca una propiedad dentro del monster
 * aceptando diferentes nombres de campo.
 */
function getField(monster, ...fields) {
    if (!monster || typeof monster !== 'object') {
        return null;
    }

    for (const field of fields) {
        if (
            monster[field] !== undefined &&
            monster[field] !== null
        ) {
            return monster[field];
        }
    }

    return null;
}

/**
 * Información básica.
 */
function getBasicInfo(monster) {
    if (!monster) {
        return null;
    }

    return {
        name: getField(
            monster,
            'name',
            'Name',
            'monster',
            'Monster'
        ),

        level: getField(
            monster,
            'level',
            'Level'
        ),

        experience: getField(
            monster,
            'experience',
            'Experience',
            'exp',
            'Exp'
        ),

        health: getField(
            monster,
            'health',
            'Health',
            'hp',
            'HP'
        ),

        speed: getField(
            monster,
            'speed',
            'Speed'
        ),

        armor: getField(
            monster,
            'armor',
            'Armor'
        ),

        defense: getField(
            monster,
            'defense',
            'Defense'
        )
    };
}

/**
 * Obtiene resistencias.
 */
function getResistances(monster) {
    if (!monster) {
        return null;
    }

    return getField(
        monster,
        'resistances',
        'Resistances',
        'resistance',
        'Resistance'
    );
}

/**
 * Obtiene loot.
 */
function getLoot(monster) {
    if (!monster) {
        return null;
    }

    return getField(
        monster,
        'loot',
        'Loot'
    );
}

/**
 * Obtiene charms.
 */
function getCharms(monster) {
    if (!monster) {
        return null;
    }

    return getField(
        monster,
        'charms',
        'Charms'
    );
}

/**
 * Obtiene información de respawn.
 */
function getRespawn(monster) {
    if (!monster) {
        return null;
    }

    return getField(
        monster,
        'respawn',
        'Respawn',
        'spawn',
        'Spawn'
    );
}

/**
 * Recarga manualmente el JSON.
 * Útil si actualizas el archivo sin reiniciar el bot.
 */
function reloadMonsters() {
    monsters = null;
    monsterMap = null;

    return loadMonsters();
}

/**
 * Estadísticas del archivo local.
 */
function getStats() {
    loadMonsters();

    return {
        total: monsters.length,
        indexed: monsterMap.size,
        file: MONSTERS_FILE
    };
}

module.exports = {
    loadMonsters,
    reloadMonsters,

    findMonster,
    searchMonsters,

    getAllMonsters,
    getMonsterCount,

    getBasicInfo,
    getResistances,
    getLoot,
    getCharms,
    getRespawn,

    getStats,

    normalizeName
};
