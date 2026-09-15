/**
 * EL CAMINO DE LA RACHA.
 *
 * La racha son los dias SEGUIDOS que entras y recoges la recompensa: dia 1,
 * dia 2, dia 3... Si un dia no entras, al siguiente vuelves a empezar por el
 * dia 1. No hay ciclo de siete ni tope: el camino es infinito.
 *
 * Cada dia del camino tiene SU premio, distinto del anterior y decidido
 * aqui, de forma que se pueda pintar por adelantado: el movil pide el tramo
 * del camino que le rodea y lo enseña tal cual. No hay ninguna copia de esta
 * tabla en el movil que pueda quedarse vieja.
 *
 * ⚠️ REBAJADO A PROPOSITO. Un entreno da unos 250 de XP; la diaria premia la
 * constancia de APARECER, no puede competir con lo que premia el esfuerzo.
 * Las fichas se quedan altas: la diaria es la fuente principal del casino.
 *
 * El patron de una semana es siempre el mismo (fichas, XP, fichas, vida,
 * fichas, XP, COFRE) y lo que crece con las semanas es la cantidad. Los hitos
 * (7, 14, 21, 30, 60, 100, 365) dan un cofre, mejor cuanto mas lejos.
 *
 * `hito` marca los dias grandes para que el camino los pinte distintos, y
 * `etiqueta` es lo que se lee debajo del dia. Esta tabla es el sitio donde ir
 * metiendo diseños y premios especiales: una entrada en HITOS y ya.
 */

// El cofre de cada hito. Los ids son los de cofresService.
const HITOS = {
    7: { cofre: 'madera' },
    14: { cofre: 'hierro' },
    21: { cofre: 'bronce' },
    30: { cofre: 'plata' },
    45: { cofre: 'bronce' },
    60: { cofre: 'dorado' },
    90: { cofre: 'coleccionista' },
    100: { cofre: 'legendario' },
    180: { cofre: 'dorado' },
    365: { cofre: 'legendario' }
};

const NOMBRE_COFRE = {
    ronoso: 'Cofre Roñoso', madera: 'Cofre de Madera', hierro: 'Cofre de Hierro', bronce: 'Cofre de Bronce',
    plata: 'Cofre de Plata', dorado: 'Cofre Dorado', botiquin: 'Botiquín', coleccionista: 'Cofre del Coleccionista',
    bestia: 'Cofre de la Bestia', legendario: 'Cofre Legendario'
};

/** Cuanto crece el premio con las semanas: sube rapido al principio y se frena. */
const factorDe = (dia) => {
    const semana = Math.floor((dia - 1) / 7);          // 0 la primera
    return 1 + Math.min(semana, 12) * 0.25;             // hasta x4 en la semana 13
};

/**
 * El premio del dia `dia` de la racha (1, 2, 3, ...).
 * Devuelve { dia, tipo, valor, etiqueta, hito, cofre? }
 *     tipo: 'fichas' | 'xp' | 'hp' | 'cofre'
 */
const recompensaDelDia = (dia) => {
    const d = Math.max(1, Math.floor(Number(dia) || 1));
    const f = factorDe(d);

    if (HITOS[d]) {
        const cofre = HITOS[d].cofre;
        return { dia: d, tipo: 'cofre', valor: 1, cofre, etiqueta: NOMBRE_COFRE[cofre] || 'Cofre', hito: true };
    }

    const posicion = ((d - 1) % 7) + 1;   // 1..7 dentro de la semana
    switch (posicion) {
        case 1: return { dia: d, tipo: 'fichas', valor: Math.round(40 * f), etiqueta: `${Math.round(40 * f)} fichas`, hito: false };
        case 2: return { dia: d, tipo: 'xp', valor: Math.round(20 * f), etiqueta: `${Math.round(20 * f)} XP`, hito: false };
        case 3: return { dia: d, tipo: 'fichas', valor: Math.round(80 * f), etiqueta: `${Math.round(80 * f)} fichas`, hito: false };
        case 4: return { dia: d, tipo: 'hp', valor: Math.min(50, Math.round(10 * f)), etiqueta: `${Math.min(50, Math.round(10 * f))} de vida`, hito: false };
        case 5: return { dia: d, tipo: 'fichas', valor: Math.round(120 * f), etiqueta: `${Math.round(120 * f)} fichas`, hito: false };
        case 6: return { dia: d, tipo: 'xp', valor: Math.round(40 * f), etiqueta: `${Math.round(40 * f)} XP`, hito: false };
        default: {
            // El septimo de una semana sin hito (a partir de la 3ª): fichas grandes.
            const v = Math.round(250 * f);
            return { dia: d, tipo: 'fichas', valor: v, etiqueta: `${v} fichas`, hito: true };
        }
    }
};

/** El tramo del camino alrededor de un dia: para pintarlo. */
const tramoDelCamino = (dia, antes = 3, despues = 10) => {
    const desde = Math.max(1, dia - antes);
    const lista = [];
    for (let d = desde; d <= dia + despues; d++) lista.push(recompensaDelDia(d));
    return lista;
};

module.exports = { recompensaDelDia, tramoDelCamino, HITOS, factorDe };
