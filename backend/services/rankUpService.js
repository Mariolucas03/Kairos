const User = require('../models/User');
const { MUSCLE_GROUPS } = require('../utils/muscles');
const { getMuscleRanks } = require('./muscleRankService');

/**
 * PREMIO POR SUBIR DE RANGO UN GRUPO MUSCULAR.
 *
 * Por que existe: el entreno ya no da monedas ni fichas. Su recompensa a corto
 * plazo es el XP, y la GRANDE es esto. Subir un rango pasa cada muchas semanas,
 * asi que es el momento que merece un aviso y dinero de verdad.
 *
 * El rango se calcula al vuelo desde el historial de entrenos, no se guarda.
 * Por eso hace falta recordar el anterior (`user.muscleRanks`): sin el no hay
 * forma de saber que ACABAS de subir, solo en que rango estas.
 *
 * Escalado: escalon x 150 monedas. Subir al rango 1 son 150, al 9 son 1.350.
 * Con 8 grupos y 9 escalones, un jugador reparte ~54.000 monedas a lo largo de
 * anos, que es el orden de magnitud del catalogo entero de la tienda.
 */
const MONEDAS_POR_ESCALON = 150;

const premioPorSubir = (desde, hasta) => {
    let total = 0;
    for (let r = desde + 1; r <= hasta; r++) total += r * MONEDAS_POR_ESCALON;
    return total;
};

/**
 * Compara el rango actual de cada grupo con el ultimo conocido.
 *
 * @returns {{ subidas: Array, monedas: number }} subidas vacio si no hay nada
 */
const revisarSubidasDeRango = async (userId) => {
    const usuario = await User.findById(userId).select('muscleRanks coins');
    if (!usuario) return { subidas: [], monedas: 0 };

    const ranks = await getMuscleRanks(userId);

    // ⚠️ Primera vez: el campo no existe todavia. Se anota el estado actual SIN
    // pagar nada. Si no, un usuario con meses de historial cobraria de golpe
    // todos los rangos que ya tenia ganados.
    const esPrimeraVez = !usuario.muscleRanks || usuario.muscleRanks.size === 0;

    const anteriores = usuario.muscleRanks || new Map();
    const subidas = [];
    let monedas = 0;

    const nuevos = new Map();

    for (const grupo of MUSCLE_GROUPS) {
        const info = ranks[grupo];
        const actual = info?.rankIndex ?? 0;
        const antes = anteriores.get ? (anteriores.get(grupo) ?? 0) : 0;

        nuevos.set(grupo, actual);

        if (!esPrimeraVez && actual > antes) {
            monedas += premioPorSubir(antes, actual);
            subidas.push({
                grupo,
                rango: info?.rankLabel || '',
                color: info?.rankColor || '#eab308',
                desde: antes,
                hasta: actual,
                puntos: info?.points || 0
            });
        }
    }

    // Se guarda SIEMPRE el estado nuevo, aunque no haya premio: es lo que evita
    // que la proxima llamada vuelva a detectar la misma subida.
    const cambio = { $set: { muscleRanks: nuevos } };
    if (monedas > 0) cambio.$inc = { coins: monedas };

    const actualizado = await User.findByIdAndUpdate(userId, cambio, { new: true });

    return { subidas, monedas, user: actualizado };
};

module.exports = { revisarSubidasDeRango, premioPorSubir, MONEDAS_POR_ESCALON };
