const { mejorMano, comparar } = require('./pokerManos');

/**
 * LAS REGLAS DE LA MESA: turnos, rondas de apuestas y reparto del bote.
 *
 * Vive aparte del controlador y trabaja sobre objetos planos, sin base de datos
 * ni peticiones, para poder jugar partidas enteras en una prueba. Es donde
 * viven los dos sitios en los que un póquer se rompe siempre:
 *
 *  1. CUÁNDO TERMINA UNA RONDA. Si se cierra antes de tiempo, alguien se queda
 *     sin hablar; si se cierra tarde, la mesa se cuelga esperando a alguien que
 *     ya no puede apostar.
 *
 *  2. LOS BOTES LATERALES. Cuando alguien va all-in con menos de lo que apuestan
 *     los demás, no puede ganar lo que no cubrió. Hacerlo mal no da ningún
 *     error: paga de más a uno y de menos a otro.
 */

/** Los que siguen vivos en la mano (no retirados y sentados). */
const enMano = (mesa) => mesa.jugadores.filter(j => j.sentado && !j.retirado);

/** Los que además pueden apostar (no están all-in). */
const puedenApostar = (mesa) => enMano(mesa).filter(j => !j.allIn);

/** Siguiente puesto ocupado a partir de uno dado, saltando a quien no juega. */
const siguientePuesto = (mesa, desde, filtro = (j) => j.sentado && !j.retirado && !j.allIn) => {
    const n = mesa.jugadores.length;
    for (let i = 1; i <= n; i++) {
        const p = (desde + i) % n;
        if (filtro(mesa.jugadores[p])) return p;
    }
    return -1;
};

/**
 * ¿Ha terminado la ronda de apuestas?
 *
 * Termina cuando todos los que pueden apostar han hablado Y han igualado la
 * apuesta. Lo segundo sin lo primero cerraría la ronda antes de que el último
 * dijera nada; lo primero sin lo segundo la cerraría con alguien debiendo.
 */
const rondaTerminada = (mesa) => {
    const vivos = puedenApostar(mesa);
    if (vivos.length === 0) return true;
    // Con uno solo que pueda apostar, si ya habló no hay a quién esperar
    if (enMano(mesa).length <= 1) return true;
    return vivos.every(j => j.haActuado && j.apostadoRonda === mesa.apuestaActual);
};

/** Prepara la siguiente ronda: se limpia lo apostado y quién ha hablado. */
const abrirRonda = (mesa) => {
    for (const j of mesa.jugadores) {
        j.apostadoRonda = 0;
        j.haActuado = false;
    }
    mesa.apuestaActual = 0;
    mesa.subidaMinima = mesa.ciegaGrande;
};

/**
 * REPARTO DEL BOTE, CON SUS BOTES LATERALES.
 *
 * La idea, que es más simple de lo que parece: se ordenan las cantidades que ha
 * puesto cada uno en la mano. Cada "escalón" forma un bote al que solo optan
 * los que llegaron a poner esa cantidad. El que va all-in con 50 no puede llevarse
 * lo que otros dos apostaron por encima de esos 50.
 *
 * Trabaja SOLO con lo apostado, así que la suma repartida es exactamente la
 * suma puesta. No se puede crear ni perder una ficha por el camino.
 *
 * @returns {Array<{puestos: number[], fichas: number, texto: string}>}
 */
const repartirBote = (mesa) => {
    const jugadores = mesa.jugadores;

    // Valor de la mano de cada uno que llegó al final
    const valores = jugadores.map((j) => {
        if (!j.sentado || j.retirado || j.cartas.length === 0) return null;
        return mejorMano([...j.cartas, ...mesa.comunitarias]);
    });

    // Escalones: cada cantidad distinta que alguien puso
    const puestas = [...new Set(jugadores.map(j => j.apostadoMano).filter(v => v > 0))]
        .sort((a, b) => a - b);

    const pagos = [];
    let anterior = 0;

    for (const escalon of puestas) {
        const tramo = escalon - anterior;

        // Quién contribuye a este bote: todo el que puso al menos `escalon`
        const contribuyen = jugadores.filter(j => j.apostadoMano >= escalon).length;
        const fichas = tramo * contribuyen;
        anterior = escalon;
        if (fichas <= 0) continue;

        // Quién opta: los que llegaron a este escalón Y siguen en la mano
        const candidatos = jugadores
            .map((j, i) => ({ j, i }))
            .filter(({ j }) => j.apostadoMano >= escalon && j.sentado && !j.retirado && valores[jugadores.indexOf(j)]);

        if (candidatos.length === 0) {
            // Nadie opta (todos retirados): vuelve a quien lo puso. No debería
            // pasar, pero perder fichas en silencio sí sería un problema.
            const dueños = jugadores.map((j, i) => ({ j, i })).filter(({ j }) => j.apostadoMano >= escalon);
            if (dueños.length) {
                const parte = Math.floor(fichas / dueños.length);
                pagos.push({ puestos: dueños.map(d => d.i), fichas: parte * dueños.length, porCabeza: parte, texto: 'devuelto' });
            }
            continue;
        }

        let mejor = null;
        let ganadores = [];
        for (const { j, i } of candidatos) {
            const v = valores[jugadores.indexOf(j)];
            const cmp = mejor ? comparar(v.valor, mejor.valor) : 1;
            if (cmp > 0) { mejor = v; ganadores = [i]; }
            else if (cmp === 0) ganadores.push(i);
        }

        // Con empate, a partes iguales. Lo que sobra de la división se queda en
        // el primero: es una ficha, y hay que dársela a alguien.
        const parte = Math.floor(fichas / ganadores.length);
        const resto = fichas - parte * ganadores.length;

        pagos.push({
            puestos: ganadores,
            fichas,
            porCabeza: parte,
            resto,
            texto: mejor.texto
        });
    }

    return pagos;
};

/**
 * Reparte una mano nueva: barajas, ciegas y primera palabra.
 *
 * @param {object} mesa   documento de la mesa (se modifica)
 * @param {Function} nuevoMazo
 */
const repartirMano = (mesa, nuevoMazo) => {
    const sentados = mesa.jugadores.filter(j => j.sentado && j.fichas > 0);
    if (sentados.length < 2) return false;

    mesa.mazo = nuevoMazo();
    mesa.comunitarias = [];
    mesa.bote = 0;
    mesa.fase = 'preflop';
    mesa.manoNumero += 1;

    for (const j of mesa.jugadores) {
        j.cartas = [];
        j.apostadoRonda = 0;
        j.apostadoMano = 0;
        j.haActuado = false;
        j.allIn = false;
        // Quien no tenga fichas se queda fuera de ESTA mano, sin levantarse
        j.retirado = !(j.sentado && j.fichas > 0);
    }

    // El botón pasa al siguiente que pueda jugar
    mesa.boton = siguientePuesto(mesa, mesa.boton, (j) => j.sentado && j.fichas > 0);
    if (mesa.boton < 0) mesa.boton = mesa.jugadores.findIndex(j => j.sentado && j.fichas > 0);

    const jugables = (j) => j.sentado && j.fichas > 0;

    // Con dos jugadores el botón es la ciega pequeña y habla primero antes del
    // flop. Es la regla del mano a mano, y sin ella el botón nunca hablaría.
    const cabezaACabeza = sentados.length === 2;
    const ciegaP = cabezaACabeza ? mesa.boton : siguientePuesto(mesa, mesa.boton, jugables);
    const ciegaG = siguientePuesto(mesa, ciegaP, jugables);

    const pequena = Math.floor(mesa.ciegaGrande / 2);
    ponerFichas(mesa, ciegaP, Math.min(pequena, mesa.jugadores[ciegaP].fichas));
    ponerFichas(mesa, ciegaG, Math.min(mesa.ciegaGrande, mesa.jugadores[ciegaG].fichas));

    mesa.apuestaActual = mesa.ciegaGrande;
    mesa.subidaMinima = mesa.ciegaGrande;

    // Las ciegas no cuentan como "haber hablado": el de la grande tiene derecho
    // a subir cuando le vuelva el turno.
    for (const j of mesa.jugadores) j.haActuado = false;

    // Dos cartas a cada uno
    for (let vuelta = 0; vuelta < 2; vuelta++) {
        for (let i = 0; i < mesa.jugadores.length; i++) {
            const p = (mesa.boton + 1 + i) % mesa.jugadores.length;
            if (jugables(mesa.jugadores[p])) mesa.jugadores[p].cartas.push(mesa.mazo.shift());
        }
    }

    mesa.turno = cabezaACabeza ? mesa.boton : siguientePuesto(mesa, ciegaG, jugables);
    return true;
};

/**
 * Mueve fichas del montón de alguien al bote.
 *
 * ⚠️ Lo primero es comprobar que la cantidad es un número.
 *
 * Sin esto, un NaN atraviesa Math.floor, Math.min y Math.max sin inmutarse y
 * deja el montón en NaN: un saldo que ya no se puede ni apostar ni arreglar, y
 * que no da ningún error al llegar. En esta app ya pasó una vez con las fichas
 * del casino.
 */
const ponerFichas = (mesa, puesto, cantidad) => {
    const j = mesa.jugadores[puesto];
    const pedido = Number(cantidad);
    if (!Number.isFinite(pedido) || pedido <= 0) return 0;
    const real = Math.max(0, Math.min(Math.floor(pedido), j.fichas));
    j.fichas -= real;
    j.apostadoRonda += real;
    j.apostadoMano += real;
    mesa.bote += real;
    if (j.fichas === 0) j.allIn = true;
    return real;
};

/** Saca la siguiente carta comunitaria (o las tres del flop). */
const abrirCartas = (mesa) => {
    if (mesa.fase === 'preflop') {
        mesa.comunitarias.push(mesa.mazo.shift(), mesa.mazo.shift(), mesa.mazo.shift());
        mesa.fase = 'flop';
    } else if (mesa.fase === 'flop') {
        mesa.comunitarias.push(mesa.mazo.shift());
        mesa.fase = 'turn';
    } else if (mesa.fase === 'turn') {
        mesa.comunitarias.push(mesa.mazo.shift());
        mesa.fase = 'river';
    } else {
        mesa.fase = 'showdown';
        return false;
    }
    abrirRonda(mesa);
    // Después del flop habla el primero a la izquierda del botón
    mesa.turno = siguientePuesto(mesa, mesa.boton);
    return true;
};

module.exports = {
    enMano, puedenApostar, siguientePuesto, rondaTerminada,
    abrirRonda, repartirBote, repartirMano, ponerFichas, abrirCartas
};
