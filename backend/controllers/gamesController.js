const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const crypto = require('crypto'); // 🔥 IMPORTACIÓN NATIVA DE NODE PARA SEGURIDAD
const { getMadridDateString } = require('../utils/dateHelpers');

// --- UTILIDADES GLOBALES ---

/**
 * Normaliza una apuesta recibida del cliente. Devuelve el número, o null si no
 * sirve. TODOS los juegos deben pasar por aquí.
 *
 * Cada juego tenía su propia guarda y no coincidían:
 *   - blackjack:    `bet < 10`         -> `undefined < 10` y `NaN < 10` son
 *                                         FALSE, así que ambos la atravesaban.
 *   - dados/slots:  `!bet || bet < 10` -> deja pasar 'abc' e Infinity.
 *   - ruleta/torre: Number.isFinite    -> esta era la única correcta.
 *
 * Lo que se colaba acababa en `$inc: { gameCoins: NaN }`. Eso no da error:
 * deja el saldo del usuario en NaN y a partir de ahí ninguna partida cuadra.
 */
const normalizarApuesta = (valor, minimo = 10) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < minimo) return null;
    return n;
};

const chargeAndValidate = async (userId, amount) => {
    // Red de seguridad: aunque un juego olvide validar, aquí no pasa un NaN
    const importe = Number(amount);
    if (!Number.isFinite(importe)) throw new Error('Importe de apuesta inválido');
    if (importe <= 0) return await User.findById(userId);
    amount = importe;
    const user = await User.findOneAndUpdate(
        { _id: userId, gameCoins: { $gte: amount } },
        { $inc: { gameCoins: -amount } },
        { new: true }
    );
    if (!user) throw new Error('Fichas insuficientes o error de saldo');
    return user;
};

const payPrize = async (userId, amount) => {
    // Un premio no finito NO se escribe: meter NaN aquí deja el saldo inservible
    const importe = Number(amount);
    if (!Number.isFinite(importe) || importe <= 0) return await User.findById(userId);
    amount = importe;
    return await User.findByIdAndUpdate(userId, { $inc: { gameCoins: amount } }, { new: true });
};

// ==========================================
// 1. DADOS (DICE)
// ==========================================
const playDice = asyncHandler(async (req, res) => {
    const { bet, prediction } = req.body;
    const apuesta = normalizarApuesta(bet);
    if (apuesta === null) { res.status(400); throw new Error('Apuesta mínima 10'); }
    if (!['under', 'seven', 'over'].includes(prediction)) { res.status(400); throw new Error('Predicción inválida'); }

    await chargeAndValidate(req.user._id, apuesta);

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;

    let won = false; let multiplier = 0;
    if (prediction === 'under' && sum < 7) { won = true; multiplier = 2; }
    else if (prediction === 'seven' && sum === 7) { won = true; multiplier = 5; }
    else if (prediction === 'over' && sum > 7) { won = true; multiplier = 2; }

    const payout = won ? apuesta * multiplier : 0;
    const finalUser = await payPrize(req.user._id, payout);

    res.json({ won, payout, sum, dices: [d1, d2], user: finalUser });
});

// ==========================================
// 2. RASCA Y GANA (SCRATCH)
// ==========================================
/**
 * ⚠️ PREMIOS REEQUILIBRADOS. El rasca REGALABA DINERO.
 *
 * Medido simulando 300.000 tiradas con este mismo codigo: por cada 100 fichas
 * apostadas devolvia 279. O sea que jugar casi TRIPLICA el dinero cada vez, y
 * como las fichas se cambian por monedas, era una impresora infinita: con darle
 * al boton se compraba la tienda entera.
 *
 * No hacia falta hacer trampa para aprovecharlo, solo jugar: la cuenta que mas
 * habia jugado tenia diez veces mas fichas que las demas.
 *
 * Los premios se dividen por 3,3 para dejarlo en el 84%, el mismo margen que los
 * dados (83,5%). Se mantienen el ritmo de victorias (35%) y las proporciones
 * entre premios, que es lo que hace que el juego se sienta igual de bien: sigues
 * ganando algo una de cada tres veces y el diamante sigue siendo diez veces el
 * limon.
 *
 * El XP baja de 200 a 75 por lo mismo: el XP decide el ranking mensual, y a 200
 * por tirada el ranking se ganaba dandole al rasca, no entrenando.
 */
/**
 * ⚠️ LOS PREMIOS DE FICHAS SON MULTIPLICADORES, NO CANTIDADES.
 *
 * El rasca era el ultimo juego con la apuesta clavada en 10 fichas. Para poder
 * apostar lo que quieras, el premio tiene que salir de lo apostado: si no, con
 * una apuesta de 500 el diamante seguiria pagando 150 y jugar fuerte seria
 * tirar el dinero.
 *
 * Los multiplos estan puestos para que a 10 fichas —la apuesta de siempre— se
 * paguen EXACTAMENTE los mismos premios que antes: 15 x 10 = 150, 3 x 10 = 30,
 * 1,5 x 10 = 15. Asi el cambio no toca la economia, solo la escala.
 *
 * ⚠️ EL XP NO ESCALA, Y ES A PROPOSITO.
 *
 * Es la unica excepcion y tiene motivo: el XP decide el ranking mensual. Ya se
 * bajo una vez de 200 a 75 porque a ese ritmo el ranking se ganaba dandole al
 * rasca en vez de entrenando. Si escalara con la apuesta, apostar 500 daria
 * 3.750 XP por tirada y volveriamos al mismo sitio, pero peor. El XP se paga
 * plano: es un premio simpatico, no una via para subir de nivel.
 *
 * ⚠️ ESTOS NUMEROS ESTAN TAMBIEN EN EL MOVIL.
 *
 * frontend/src/pages/games/ScratchGame.jsx pinta la tabla de premios. Ya se
 * desincronizo una vez —enseñaba 500/200/100/50 cuando el servidor pagaba
 * 150/75/30/15, o sea 3,3 veces mas de lo que cobrabas— y nadie se entero.
 * Ahora enseña MULTIPLOS, que no dependen de la apuesta, y hay una prueba en
 * pruebas/economia.test.js que fija estos valores para que cambiarlos aqui
 * obligue a mirar alli.
 */
const SCRATCH_SYMBOLS = {
    DIAMOND: { id: 'd', icon: '💎', multiplo: 15, type: 'coins', weight: 2 },
    XP: { id: 'x', icon: '⚡', prize: 75, type: 'xp', weight: 8 },
    COIN: { id: 'c', icon: '🪙', multiplo: 3, type: 'coins', weight: 15 },
    LEMON: { id: 'l', icon: '🍋', multiplo: 1.5, type: 'coins', weight: 25 },
    SKULL: { id: 's', icon: '💀', multiplo: 0, type: 'none', weight: 25 },
    POOP: { id: 'p', icon: '💩', multiplo: 0, type: 'none', weight: 25 }
};

/**
 * Lo que paga un simbolo con una apuesta dada.
 *
 * Se redondea hacia ABAJO: un premio de 37,5 fichas no existe, y redondear
 * hacia arriba en cada tirada mueve el porcentaje que devuelve el juego sin que
 * nadie lo vea venir.
 */
const premioDelRasca = (simbolo, apuesta) => {
    if (!simbolo || simbolo.type === 'none') return 0;
    if (simbolo.type === 'xp') return simbolo.prize;
    return Math.floor(simbolo.multiplo * apuesta);
};

const getRandomScratchSymbol = () => {
    const keys = Object.keys(SCRATCH_SYMBOLS);
    const totalWeight = keys.reduce((acc, k) => acc + SCRATCH_SYMBOLS[k].weight, 0);
    let r = Math.random() * totalWeight;
    for (const key of keys) {
        if (r < SCRATCH_SYMBOLS[key].weight) return SCRATCH_SYMBOLS[key];
        r -= SCRATCH_SYMBOLS[key].weight;
    }
    return SCRATCH_SYMBOLS.SKULL;
};

const playScratch = asyncHandler(async (req, res) => {
    // Sin `bet` se apuesta 10, que es lo que costaba siempre: una app antigua
    // que no mande la apuesta sigue jugando igual en vez de dar un error.
    const apuesta = normalizarApuesta(req.body?.bet ?? 10);
    if (apuesta === null) { res.status(400); throw new Error('Apuesta mínima 10'); }

    await chargeAndValidate(req.user._id, apuesta);

    const isWin = Math.random() < 0.35; // 35% Win Rate
    let items = [];

    if (isWin) {
        const pRand = Math.random();
        let winSym;
        if (pRand < 0.05) winSym = SCRATCH_SYMBOLS.DIAMOND;
        else if (pRand < 0.20) winSym = SCRATCH_SYMBOLS.XP;
        else if (pRand < 0.50) winSym = SCRATCH_SYMBOLS.COIN;
        else winSym = SCRATCH_SYMBOLS.LEMON;

        items.push(winSym, winSym, winSym);
        while (items.length < 9) {
            const filler = getRandomScratchSymbol();
            const count = items.filter(x => x.id === filler.id).length;
            items.push(count < 2 ? filler : SCRATCH_SYMBOLS.SKULL);
        }
    } else {
        for (let i = 0; i < 9; i++) items.push(getRandomScratchSymbol());
        const counts = {};
        items.forEach(i => counts[i.id] = (counts[i.id] || 0) + 1);
        Object.keys(counts).forEach(k => {
            if (counts[k] >= 3 && k !== 's' && k !== 'p') {
                let removed = 0;
                items = items.map(i => {
                    if (i.id === k && removed >= 2) return Math.random() > 0.5 ? SCRATCH_SYMBOLS.SKULL : SCRATCH_SYMBOLS.POOP;
                    if (i.id === k) removed++;
                    return i;
                });
            }
        });
    }

    items = items.sort(() => Math.random() - 0.5);

    const finalCounts = {};
    items.forEach(i => finalCounts[i.id] = (finalCounts[i.id] || 0) + 1);
    const winSymObj = Object.values(SCRATCH_SYMBOLS).find(s => finalCounts[s.id] >= 3 && s.type !== 'none');

    let finalUser = req.user;
    let payout = 0;

    if (winSymObj) {
        payout = premioDelRasca(winSymObj, apuesta);
        if (winSymObj.type === 'xp') {
            finalUser = await User.findByIdAndUpdate(req.user._id, { $inc: { currentXP: payout } }, { new: true });
        } else {
            finalUser = await payPrize(req.user._id, payout);
        }
    }

    res.json({
        grid: items,
        won: !!winSymObj,
        prize: payout,
        prizeType: winSymObj?.type || 'none',
        apuesta,
        user: finalUser
    });
});

// ==========================================
// 3. SLOTS (TRAGAPERRAS)
// ==========================================
/**
 * ⚠️ VALORES SUBIDOS. Los slots se comian el 70% de cada tirada.
 *
 * Medido con 500.000 tiradas del codigo real: devolvian el 29,5%. No regalaban
 * dinero —eso era el rasca y la ruleta de la fortuna— pero eran tan duros que
 * jugar no tenia ningun sentido: en diez tiradas te quedabas sin nada y sin
 * haber visto ganar una sola vez.
 *
 * Los valores se multiplican por ~2,9 (redondeados a numeros legibles) y quedan
 * en el 83%, en linea con los dados (83,5%) y el rasca (84,4%). Los pesos NO se
 * tocan: el ritmo de simbolos y lo raro que es ver una corona se quedan igual,
 * solo cambia lo que paga cada linea.
 */
// Coste y premios de la ruleta de la fortuna.
//
// Viven aqui arriba y no dentro de la funcion por dos razones: no se
// reconstruyen en cada peticion, y sobre todo se pueden COMPROBAR desde las
// pruebas. Estas tablas ya regalaron dinero una vez (los tres modos pagaban
// mas de lo que costaban); una prueba que mide lo que devuelven es lo unico
// que evita que vuelva a pasar sin que nadie se entere.
/**
 * LAS RUEDAS DE LA FORTUNA.
 *
 * ⚠️ EL CATALOGO VIVE AQUI Y SOLO AQUI. El movil lo pide y lo pinta.
 *
 * Antes las etiquetas de la rueda estaban escritas en el movil y los premios
 * en el servidor, y cuando se reequilibro la economia solo se toco el
 * servidor: la rueda enseñaba "1K" y pagaba 200. Es el fallo de "el mismo
 * numero en dos sitios" que mas veces ha salido en este proyecto, y aqui era
 * el peor posible porque le decia al usuario que iba a ganar algo que no.
 * Ahora el servidor manda la rueda entera (coste, premios, nombre, color) y el
 * movil no tiene nada que pueda quedarse viejo.
 *
 * ⚠️ TODAS LAS DE PAGO DEVUELVEN EL 85%, ni una mas ni una menos.
 *
 * Es el mismo margen que los dados y el rasca. Con eso, girar sin limite es
 * seguro para la economia: cada tirada deja un 15% en la casa, de media. Por
 * eso las de pago NO tienen limite diario; la gratis si, porque es dinero
 * regalado y sin limite seria una fuente infinita.
 *
 * `t: 'c'` son fichas; `t: 'xp'` es experiencia. La rueda de XP es la unica
 * que no se mide en fichas y por eso su unica regla es ser modesta: comprar
 * niveles a golpe de ruleta no es lo que la app quiere premiar.
 */
const RUEDAS = [
    {
        id: 'daily', nombre: 'Diaria', coste: 0, acento: '#3b82f6',
        descripcion: 'Gratis. Una al día.',
        premios: [{ v: 10, t: 'c' }, { v: 50, t: 'c' }, { v: 5, t: 'c' }, { v: 25, t: 'c' }, { v: 100, t: 'c' }, { v: 5, t: 'c' }]
    },
    {
        id: 'bronce', nombre: 'Bronce', coste: 25, acento: '#b45309',
        descripcion: 'Para empezar. Premios pequeños, casi siempre algo.',
        // 170 / 8 = 21,25 -> 85% de 25
        premios: [0, 10, 20, 30, 50, 0, 15, 45].map(v => ({ v, t: 'c' }))
    },
    {
        id: 'hardcore', nombre: 'Todo o nada', coste: 50, acento: '#ef4444',
        descripcion: 'Cinco vacíos y un premio gordo. Una de seis.',
        // 255 / 6 = 42,5 -> 85% de 50
        premios: [0, 0, 0, 0, 0, 255].map(v => ({ v, t: 'c' }))
    },
    {
        id: 'plata', nombre: 'Plata', coste: 100, acento: '#94a3b8',
        descripcion: 'La de en medio. Se puede duplicar.',
        // 680 / 8 = 85 -> 85% de 100
        premios: [0, 50, 75, 100, 150, 0, 60, 245].map(v => ({ v, t: 'c' }))
    },
    {
        id: 'oro', nombre: 'Oro', coste: 250, acento: '#eab308',
        descripcion: 'Premios altos y pocos vacíos.',
        // 1700 / 8 = 212,5 -> 85% de 250
        premios: [0, 100, 150, 250, 400, 50, 200, 550].map(v => ({ v, t: 'c' }))
    },
    {
        id: 'jackpot', nombre: 'Jackpot', coste: 500, acento: '#a855f7',
        descripcion: 'Casi todo vacío. Uno lo cambia todo.',
        // 3400 / 8 = 425 -> 85% de 500
        premios: [0, 0, 100, 200, 300, 0, 400, 2400].map(v => ({ v, t: 'c' }))
    },
    {
        id: 'xp', nombre: 'Experiencia', coste: 40, acento: '#22d3ee',
        descripcion: 'Paga en XP, no en fichas.',
        // 730 / 8 = 91 XP de media. Modesta: un entreno da mas.
        premios: [30, 60, 100, 150, 250, 20, 80, 40].map(v => ({ v, t: 'xp' }))
    }
];

// Las dos tablas de siempre, DERIVADAS del catalogo: es lo que leen el juego y
// las pruebas de economia, y asi no hay dos copias que puedan desacordarse.
const FORTUNE_COSTS = Object.fromEntries(RUEDAS.map(r => [r.id, r.coste]));
const FORTUNE_PRIZES = Object.fromEntries(RUEDAS.map(r => [r.id, r.premios]));

const SLOT_SYMBOLS = [
    { id: 'cherry', icon: '🍒', val: 4, weight: 25 },
    { id: 'clover', icon: '🍀', val: 9, weight: 15 },
    { id: 'zap', icon: '⚡', val: 15, weight: 10 },
    { id: 'star', icon: '⭐', val: 30, weight: 8 },
    { id: 'gem', icon: '💎', val: 60, weight: 4 },
    { id: 'crown', icon: '👑', val: 150, weight: 1 },
    { id: 'skull', icon: '💀', val: 0, weight: 20 },
    { id: 'ghost', icon: '👻', val: 0, weight: 17 },
];

const getSlotSymbol = () => {
    const totalW = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * totalW;
    for (const s of SLOT_SYMBOLS) { if (r < s.weight) return s; r -= s.weight; }
    return SLOT_SYMBOLS[0];
};

const playSlots = asyncHandler(async (req, res) => {
    const { bet } = req.body;
    const apuesta = normalizarApuesta(bet);
    if (apuesta === null) { res.status(400); throw new Error('Apuesta mínima 10'); }
    await chargeAndValidate(req.user._id, apuesta);

    const grid = Array(4).fill(null).map(() => Array(4).fill(null).map(() => getSlotSymbol()));
    const rows = [0, 1, 2, 3].map(r => [grid[0][r], grid[1][r], grid[2][r], grid[3][r]]);

    let totalPayout = 0;
    let winningCells = [];

    const checkLines = [
        { syms: rows[0], coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
        { syms: rows[1], coords: [[0, 1], [1, 1], [2, 1], [3, 1]] },
        { syms: rows[2], coords: [[0, 2], [1, 2], [2, 2], [3, 2]] },
        { syms: rows[3], coords: [[0, 3], [1, 3], [2, 3], [3, 3]] },
        { syms: [rows[0][0], rows[1][1], rows[2][2], rows[3][3]], coords: [[0, 0], [1, 1], [2, 2], [3, 3]] },
        { syms: [rows[0][3], rows[1][2], rows[2][1], rows[3][0]], coords: [[0, 3], [1, 2], [2, 1], [3, 0]] },
        { syms: grid[0], coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
        { syms: grid[1], coords: [[1, 0], [1, 1], [1, 2], [1, 3]] },
        { syms: grid[2], coords: [[2, 0], [2, 1], [2, 2], [2, 3]] },
        { syms: grid[3], coords: [[3, 0], [3, 1], [3, 2], [3, 3]] }
    ];

    checkLines.forEach(line => {
        const s = line.syms;
        if (s[0].val === 0) return;
        let matchIds = [];
        if (s[0].id === s[1].id && s[1].id === s[2].id && s[2].id === s[3].id) matchIds = [0, 1, 2, 3];
        else if (s[0].id === s[1].id && s[1].id === s[2].id) matchIds = [0, 1, 2];
        else if (s[1].id === s[2].id && s[2].id === s[3].id && s[1].val > 0) matchIds = [1, 2, 3];

        if (matchIds.length >= 3) {
            const multi = matchIds.length === 4 ? 2 : 1;
            totalPayout += apuesta * s[matchIds[0]].val * multi;
            matchIds.forEach(i => winningCells.push(`${line.coords[i][0]}-${line.coords[i][1]}`));
        }
    });

    const finalUser = await payPrize(req.user._id, totalPayout);
    res.json({ grid, won: totalPayout > 0, payout: totalPayout, winningCells, user: finalUser });
});

// ==========================================
// 4. RULETA
// ==========================================
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
const TABLE_COLUMNS = {
    1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
    2: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    3: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
};

// 🔥 TABLA DE APUESTAS CANÓNICA: nunca confiamos en "numbers"/"multiplier" del cliente,
// los recalculamos siempre a partir de type+value.
const getCanonicalRouletteBet = (type, value) => {
    switch (type) {
        case 'number': {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 0 || n > 36) return null;
            return { numbers: [n], multiplier: 36 };
        }
        case 'column': {
            const col = Number(value);
            if (!TABLE_COLUMNS[col]) return null;
            return { numbers: TABLE_COLUMNS[col], multiplier: 3 };
        }
        case 'dozen': {
            const d = Number(value);
            if (![1, 2, 3].includes(d)) return null;
            return { numbers: Array.from({ length: 12 }, (_, i) => i + 1 + (d - 1) * 12), multiplier: 3 };
        }
        case 'low':
            return { numbers: Array.from({ length: 18 }, (_, i) => i + 1), multiplier: 2 };
        case 'high':
            return { numbers: Array.from({ length: 18 }, (_, i) => i + 19), multiplier: 2 };
        case 'even':
            return { numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0), multiplier: 2 };
        case 'odd':
            return { numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 !== 0), multiplier: 2 };
        case 'color':
            if (value === 'red') return { numbers: RED_NUMBERS, multiplier: 2 };
            if (value === 'black') return { numbers: BLACK_NUMBERS, multiplier: 2 };
            return null;
        default:
            return null;
    }
};

const playRoulette = asyncHandler(async (req, res) => {
    const { bets } = req.body;
    if (!Array.isArray(bets) || bets.length === 0) { res.status(400); throw new Error('Sin apuestas'); }
    if (bets.length > 50) { res.status(400); throw new Error('Demasiadas apuestas'); }

    const canonicalBets = [];
    for (const b of bets) {
        const amount = Number(b?.amount);
        if (!Number.isFinite(amount) || amount <= 0) { res.status(400); throw new Error('Apuesta inválida'); }
        const canonical = getCanonicalRouletteBet(b?.type, b?.value);
        if (!canonical) { res.status(400); throw new Error('Apuesta inválida'); }
        canonicalBets.push({ amount, ...canonical });
    }

    const totalBet = canonicalBets.reduce((a, b) => a + b.amount, 0);
    await chargeAndValidate(req.user._id, totalBet);

    const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const winNum = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];

    let totalWin = 0;
    canonicalBets.forEach(b => { if (b.numbers.includes(winNum)) totalWin += b.amount * b.multiplier; });

    const finalUser = await payPrize(req.user._id, totalWin);
    res.json({ winNum, totalWin, user: finalUser });
});

// ==========================================
// 5. RULETA DE LA FORTUNA
// ==========================================
const playFortuneWheel = asyncHandler(async (req, res) => {
    const { type } = req.body;
    const cost = FORTUNE_COSTS[type];

    if (cost === undefined) { res.status(400); throw new Error('Tipo inválido'); }

    // ⚠️ LA TIRADA GRATIS SOLO SE LIMITABA EN EL MÓVIL.
    //
    // El "una al día" vivía en el localStorage del navegador, que el propio
    // usuario puede borrar, y la API no comprobaba nada: girar sin parar era
    // gratis y daba 32 fichas de media cada vez. Esto es el límite de verdad, y
    // va con findOneAndUpdate atómico para que dos toques seguidos no cuelen dos
    // tiradas.
    if (type === 'daily') {
        const hoy = getMadridDateString();
        const reclamado = await User.findOneAndUpdate(
            { _id: req.user._id, ultimaRuletaDiaria: { $ne: hoy } },
            { $set: { ultimaRuletaDiaria: hoy } }
        );
        if (!reclamado) {
            res.status(400);
            throw new Error('La tirada gratis es una al día. Vuelve mañana.');
        }
    }

    await chargeAndValidate(req.user._id, cost);

    /**
     * ⚠️ PREMIOS REEQUILIBRADOS. Los tres modos pagaban MÁS de lo que costaban:
     *
     *     diaria     gratis y sin límite real -> 32,5 fichas por giro, infinitas
     *     hardcore   cuesta 50 y devolvía 200 de media  -> 400%
     *     premium    cuesta 200 y devolvía 443 de media -> 222%
     *
     * O sea que la forma óptima de conseguir fichas en la app era darle a la
     * ruleta, no jugar a nada ni entrenar. Ahora hardcore y premium devuelven el
     * 85%, el mismo margen que los dados y el rasca, y la diaria se queda como
     * está porque ya no se puede repetir: 32 fichas gratis al día es un regalo
     * de bienvenida razonable, no una fuente infinita.
     */

    const winIndex = Math.floor(Math.random() * FORTUNE_PRIZES[type].length);
    const winObj = FORTUNE_PRIZES[type][winIndex];

    let finalUser = req.user;
    if (winObj.v > 0) {
        if (winObj.t === 'xp') finalUser = await User.findByIdAndUpdate(req.user._id, { $inc: { currentXP: winObj.v } }, { new: true });
        else finalUser = await payPrize(req.user._id, winObj.v);
    }

    res.json({ winIndex, prize: winObj, user: finalUser });
});

/**
 * El catalogo para el movil, y si la gratis de hoy ya esta usada. Lo segundo
 * lo decide el servidor —que es quien la limita— y no un localStorage que el
 * usuario puede borrar.
 */
const getFortuneWheels = asyncHandler(async (req, res) => {
    const u = await User.findById(req.user._id).select('ultimaRuletaDiaria').lean();
    res.json({
        ruedas: RUEDAS,
        diariaUsadaHoy: u?.ultimaRuletaDiaria === getMadridDateString()
    });
});

// ==========================================
// 6. BLACKJACK (STATELESS / JWT) CON ANTI-CHEAT 🔥
// ==========================================
const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
    let deck = [];
    for (let suit of SUITS) for (let value of VALUES) {
        let weight = parseInt(value);
        if (['J', 'Q', 'K'].includes(value)) weight = 10;
        if (value === 'A') weight = 11;
        deck.push({ suit, value, weight, id: Math.random().toString() });
    }
    return deck.sort(() => Math.random() - 0.5);
};

const calcScore = (hand) => {
    let score = 0, aces = 0;
    hand.forEach(c => { score += c.weight; if (c.value === 'A') aces++; });
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
};

// 🔥 El estado (incluye el mazo restante) se ENCRIPTA, no solo se firma:
// un JWT normal solo está codificado en base64 y el cliente podría decodificarlo
// para ver todas las cartas futuras (conteo de cartas / trampas). AES-256-GCM
// evita que el contenido sea legible, y la etiqueta de autenticación evita manipulación.
const getBlackjackKey = () => crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();

const encryptState = (state) => {
    const key = getBlackjackKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

const decryptState = (token) => {
    const key = getBlackjackKey();
    const raw = Buffer.from(token, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
};

const playBlackjack = asyncHandler(async (req, res) => {
    const { action, bet, token } = req.body;
    let state;

    if (action === 'deal') {
        const apuesta = normalizarApuesta(bet);
        if (apuesta === null) { res.status(400); throw new Error('Apuesta mínima 10'); }
        await chargeAndValidate(req.user._id, apuesta);

        const deck = createDeck();
        const gameId = crypto.randomBytes(16).toString('hex'); // 🔥 CANDADO ÚNICO

        // Guardamos el candado en el usuario
        await User.findByIdAndUpdate(req.user._id, { activeGameToken: gameId });

        state = {
            gameId, // Incluimos el candado en el estado que se va a firmar
            deck, 
            pHands: [{ cards: [deck.pop(), deck.pop()], bet: apuesta, isDone: false, isDoubled: false }],
            dHand: [deck.pop(), deck.pop()], activeHand: 0, status: 'playing'
        };

        // Blackjack natural
        if (calcScore(state.pHands[0].cards) === 21) {
            state.pHands[0].isDone = true;
            state.status = 'ended';
        }
    } else {
        if (!token) { res.status(400); throw new Error('Sesión no encontrada'); }
        try {
            state = decryptState(token);
        } catch (e) {
            res.status(400); throw new Error('Sesión inválida o manipulada. Empieza de nuevo.');
        }

        // 🔥 VALIDACIÓN ANTI-TRAMPAS (REPLAY ATTACK)
        const currentUser = await User.findById(req.user._id).select('activeGameToken');
        if (!currentUser.activeGameToken || currentUser.activeGameToken !== state.gameId) {
            res.status(400); 
            throw new Error('Partida expirada o intento de trampa detectado. Empieza de nuevo.');
        }

        let hand = state.pHands[state.activeHand];

        if (action === 'hit') {
            hand.cards.push(state.deck.pop());
            if (calcScore(hand.cards) > 21) hand.isDone = true;
        } else if (action === 'stand') {
            hand.isDone = true;
        } else if (action === 'double') {
            await chargeAndValidate(req.user._id, hand.bet);
            hand.bet *= 2; hand.isDoubled = true; hand.isDone = true;
            hand.cards.push(state.deck.pop());
        }

        // Check if next hand exists
        const nextIdx = state.pHands.findIndex(h => !h.isDone);
        if (nextIdx !== -1) {
            state.activeHand = nextIdx;
        } else {
            state.status = 'ended';
        }
    }

    let finalUser = req.user;
    let totalPayout = 0;

    // Si termina, juega el dealer y paga
    if (state.status === 'ended') {
        const allBusted = state.pHands.every(h => calcScore(h.cards) > 21);
        if (!allBusted) {
            while (calcScore(state.dHand) < 17) state.dHand.push(state.deck.pop());
        }

        const dScore = calcScore(state.dHand);
        state.pHands.forEach(h => {
            const pScore = calcScore(h.cards);
            if (pScore <= 21) {
                if (dScore > 21 || pScore > dScore) {
                    if (pScore === 21 && h.cards.length === 2 && !h.isDoubled && state.pHands.length === 1) totalPayout += h.bet * 2.5;
                    else totalPayout += h.bet * 2;
                } else if (pScore === dScore) {
                    totalPayout += h.bet;
                }
            }
        });

        // 🔥 PAGAR Y ROMPER EL CANDADO EN UNA SOLA CONSULTA ATÓMICA.
        //
        // ⚠️ El candado va en el FILTRO, no sólo en la comprobación de arriba.
        // Comprobar activeGameToken al entrar y pagar después filtrando sólo por
        // _id deja una ventana: dos peticiones simultáneas con el MISMO token
        // pasan las dos la comprobación y las dos ejecutan el $inc, así que la
        // mano se cobra dos veces. Con el candado en el filtro, MongoDB sólo deja
        // pasar a una (la actualización de un documento es atómica) y la segunda
        // no encuentra nada que actualizar.
        finalUser = await User.findOneAndUpdate(
            { _id: req.user._id, activeGameToken: state.gameId },
            totalPayout > 0
                ? { $inc: { gameCoins: totalPayout }, $set: { activeGameToken: null } }
                : { $set: { activeGameToken: null } },
            { new: true }
        );
        if (!finalUser) { res.status(409); throw new Error('Esta mano ya estaba resuelta.'); }
    }

    const newStateToken = state.status === 'ended' ? null : encryptState(state);

    // Ocultar segunda carta del dealer si no ha terminado
    const safeDHand = state.status === 'ended' ? state.dHand : [state.dHand[0], { hidden: true }];

    res.json({
        state: { pHands: state.pHands, dHand: safeDHand, activeHand: state.activeHand, status: state.status, payout: totalPayout },
        token: newStateToken,
        user: finalUser
    });
});

// ==========================================
// 7. LA TORRE (subir plantas sin pisar la trampa)
// ==========================================
// Cada planta tiene 3 losas y una es trampa. Subes eligiendo losa y el premio
// se multiplica; puedes retirarte cuando quieras. Si pisas la trampa, se pierde
// todo lo acumulado. El estado (dónde están las trampas) va CIFRADO igual que en
// el blackjack: el cliente no puede leerlo ni fabricarlo.
const TOWER_FLOORS = 8;
const TOWER_TILES = 3;
const TOWER_MULTIPLIERS = [1.4, 2.0, 2.8, 3.9, 5.5, 7.7, 10.8, 15.0];

const playTower = asyncHandler(async (req, res) => {
    const { action, bet, token, choice } = req.body;

    // --- EMPEZAR PARTIDA ---
    if (action === 'start') {
        const amount = Number(bet);
        if (!Number.isFinite(amount) || amount < 10) { res.status(400); throw new Error('Apuesta mínima 10'); }

        await chargeAndValidate(req.user._id, amount);

        const gameId = crypto.randomBytes(16).toString('hex');
        await User.findByIdAndUpdate(req.user._id, { activeGameToken: gameId });

        // Una trampa por planta, elegida con aleatoriedad criptográfica
        const traps = Array.from({ length: TOWER_FLOORS }, () => crypto.randomInt(TOWER_TILES));
        const state = { gameId, bet: amount, traps, floor: 0 };

        return res.json({
            token: encryptState(state),
            floor: 0,
            multipliers: TOWER_MULTIPLIERS,
            status: 'playing'
        });
    }

    if (!token) { res.status(400); throw new Error('Partida no encontrada'); }

    let state;
    try {
        state = decryptState(token);
    } catch (e) {
        res.status(400); throw new Error('Partida inválida o manipulada. Empieza de nuevo.');
    }

    const currentUser = await User.findById(req.user._id).select('activeGameToken');
    if (!currentUser.activeGameToken || currentUser.activeGameToken !== state.gameId) {
        res.status(400); throw new Error('Partida expirada. Empieza de nuevo.');
    }

    // ⚠️ Mismo motivo que en el blackjack: el candado va en el FILTRO. Sin él,
    // dos 'cashout' simultáneos con el mismo token cobran los dos.
    // Devuelve null si otra petición ya cerró esta partida.
    const cerrarPartida = async (payout) => {
        const cambio = payout > 0
            ? { $inc: { gameCoins: payout }, $set: { activeGameToken: null } }
            : { $set: { activeGameToken: null } };
        return await User.findOneAndUpdate(
            { _id: req.user._id, activeGameToken: state.gameId },
            cambio,
            { new: true }
        );
    };
    const exigirCierre = (usuario) => {
        if (!usuario) { res.status(409); throw new Error('Esta partida ya estaba resuelta.'); }
        return usuario;
    };

    // --- RETIRARSE ---
    if (action === 'cashout') {
        if (state.floor === 0) { res.status(400); throw new Error('Sube al menos una planta'); }
        const payout = Math.round(state.bet * TOWER_MULTIPLIERS[state.floor - 1]);
        const finalUser = exigirCierre(await cerrarPartida(payout));
        return res.json({ status: 'cashed', payout, floor: state.floor, traps: state.traps, user: finalUser, token: null });
    }

    // --- ELEGIR LOSA ---
    if (action === 'pick') {
        const tile = Number(choice);
        if (!Number.isInteger(tile) || tile < 0 || tile >= TOWER_TILES) { res.status(400); throw new Error('Losa inválida'); }

        const trapTile = state.traps[state.floor];
        const floorJugada = state.floor;

        if (tile === trapTile) {
            const finalUser = exigirCierre(await cerrarPartida(0));
            return res.json({ status: 'lost', trapTile, floor: floorJugada, traps: state.traps, payout: 0, user: finalUser, token: null });
        }

        state.floor += 1;

        // Torre completada: se paga sola
        if (state.floor >= TOWER_FLOORS) {
            const payout = Math.round(state.bet * TOWER_MULTIPLIERS[TOWER_FLOORS - 1]);
            const finalUser = exigirCierre(await cerrarPartida(payout));
            return res.json({ status: 'won', trapTile, floor: state.floor, traps: state.traps, payout, user: finalUser, token: null });
        }

        return res.json({
            status: 'playing',
            trapTile,
            floor: state.floor,
            potential: Math.round(state.bet * TOWER_MULTIPLIERS[state.floor - 1]),
            token: encryptState(state)
        });
    }

    res.status(400);
    throw new Error('Acción inválida');
});

module.exports = {
    playDice, playScratch, playSlots, playRoulette, playFortuneWheel, getFortuneWheels, playBlackjack, playTower,
    RUEDAS,
    // Se exportan SOLO para las pruebas: son las tablas que deciden cuanto
    // devuelve cada juego, y ya regalaron dinero una vez.
    SCRATCH_SYMBOLS, SLOT_SYMBOLS, FORTUNE_PRIZES, FORTUNE_COSTS, TOWER_MULTIPLIERS,
    premioDelRasca
};