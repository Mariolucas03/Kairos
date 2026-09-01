const crypto = require('crypto');

/**
 * BARAJA DE PÓQUER Y VALOR DE LAS MANOS.
 *
 * Vive aparte del controlador porque es la única parte del juego que se puede
 * demostrar del todo, sin base de datos y sin jugadores: dadas siete cartas,
 * cuál es la mejor mano de cinco y quién gana. Y es justo la parte que NO puede
 * fallar — un error aquí le da el bote a quien no toca, y no da ningún error:
 * simplemente reparte mal.
 *
 * Baraja francesa de 52: no es la española del Carta Alta. El póquer necesita
 * los ochos y los nueves, y colores de trece cartas para que existan las
 * escaleras de color.
 */

const PALOS = ['picas', 'corazones', 'diamantes', 'treboles'];

// 2..14, donde 11=J, 12=Q, 13=K, 14=A
const VALORES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const NOMBRES = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

/** Las nueve categorías, de la más floja a la que manda. */
const CATEGORIAS = [
    'Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera',
    'Color', 'Full', 'Póquer', 'Escalera de color'
];

const barajaCompleta = () => {
    const cartas = [];
    for (const palo of PALOS) for (const valor of VALORES) cartas.push({ valor, palo });
    return cartas;
};

/**
 * Fisher-Yates con crypto.randomInt, no con Math.random.
 *
 * Es dinero de la gente y Math.random no promete nada sobre lo predecible que
 * es. Cuesta lo mismo hacerlo bien.
 */
const barajar = (cartas) => {
    const mazo = [...cartas];
    for (let i = mazo.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
    }
    return mazo;
};

const mazoNuevo = () => barajar(barajaCompleta());

const nombreDe = (c) => c ? `${NOMBRES[c.valor]}${{ picas: '♠', corazones: '♥', diamantes: '♦', treboles: '♣' }[c.palo]}` : '';

/** Combinaciones de 5 entre las que haya (siempre 7 en la práctica). */
const combinaciones5 = (cartas) => {
    const salida = [];
    const n = cartas.length;
    for (let a = 0; a < n - 4; a++)
        for (let b = a + 1; b < n - 3; b++)
            for (let c = b + 1; c < n - 2; c++)
                for (let d = c + 1; d < n - 1; d++)
                    for (let e = d + 1; e < n; e++)
                        salida.push([cartas[a], cartas[b], cartas[c], cartas[d], cartas[e]]);
    return salida;
};

/**
 * Valor de UNA mano de cinco cartas.
 *
 * Devuelve un array [categoría, ...desempates] que se compara elemento a
 * elemento. Los desempates van del más importante al menos: en una doble
 * pareja, primero la pareja alta, luego la baja, luego el kicker.
 */
const valorarCinco = (mano) => {
    const valores = mano.map(c => c.valor).sort((a, b) => b - a);
    const palos = mano.map(c => c.palo);

    const color = palos.every(p => p === palos[0]);

    // Cuántas veces sale cada valor
    const cuenta = {};
    for (const v of valores) cuenta[v] = (cuenta[v] || 0) + 1;

    // Grupos ordenados por: primero cuántas cartas, luego el valor. Así el trío
    // de un full manda sobre su pareja aunque la pareja sea más alta.
    const grupos = Object.entries(cuenta)
        .map(([v, n]) => ({ valor: Number(v), n }))
        .sort((a, b) => b.n - a.n || b.valor - a.valor);

    // Escalera. El as vale también como 1 para la A-2-3-4-5, la más floja.
    const unicos = [...new Set(valores)].sort((a, b) => b - a);
    let escalera = 0;
    if (unicos.length === 5) {
        if (unicos[0] - unicos[4] === 4) escalera = unicos[0];
        // La rueda: A-5-4-3-2. Cuenta como escalera al 5, no al as.
        else if (unicos[0] === 14 && unicos[1] === 5 && unicos[4] === 2) escalera = 5;
    }

    if (escalera && color) return [8, escalera];
    if (grupos[0].n === 4) return [7, grupos[0].valor, grupos[1].valor];
    if (grupos[0].n === 3 && grupos[1].n === 2) return [6, grupos[0].valor, grupos[1].valor];
    if (color) return [5, ...valores];
    if (escalera) return [4, escalera];
    if (grupos[0].n === 3) return [3, grupos[0].valor, ...grupos.slice(1).map(g => g.valor)];
    if (grupos[0].n === 2 && grupos[1].n === 2) {
        return [2, grupos[0].valor, grupos[1].valor, grupos[2].valor];
    }
    if (grupos[0].n === 2) return [1, grupos[0].valor, ...grupos.slice(1).map(g => g.valor)];
    return [0, ...valores];
};

/** Compara dos valores. >0 si a gana, <0 si b gana, 0 si empatan. */
const comparar = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] ?? -1;
        const y = b[i] ?? -1;
        if (x !== y) return x - y;
    }
    return 0;
};

/**
 * La MEJOR mano de cinco entre las que se tengan (2 propias + 5 comunes).
 *
 * @returns {{valor: number[], cartas: object[], categoria: string, texto: string}}
 */
const mejorMano = (cartas) => {
    if (!Array.isArray(cartas) || cartas.length < 5) return null;

    let mejor = null;
    for (const combo of combinaciones5(cartas)) {
        const valor = valorarCinco(combo);
        if (!mejor || comparar(valor, mejor.valor) > 0) mejor = { valor, cartas: combo };
    }

    const categoria = CATEGORIAS[mejor.valor[0]];
    return { ...mejor, categoria, texto: textoDe(mejor.valor, categoria) };
};

/** "Doble pareja de reyes y sietes", para poder contarlo en pantalla. */
const textoDe = (valor, categoria) => {
    const n = (v) => NOMBRES[v] || v;
    switch (valor[0]) {
        case 8: return valor[1] === 14 ? 'Escalera real' : `Escalera de color al ${n(valor[1])}`;
        case 7: return `Póquer de ${n(valor[1])}`;
        case 6: return `Full de ${n(valor[1])} con ${n(valor[2])}`;
        case 5: return `Color al ${n(valor[1])}`;
        case 4: return `Escalera al ${n(valor[1])}`;
        case 3: return `Trío de ${n(valor[1])}`;
        case 2: return `Doble pareja de ${n(valor[1])} y ${n(valor[2])}`;
        case 1: return `Pareja de ${n(valor[1])}`;
        default: return `Carta alta ${n(valor[1])}`;
    }
};

module.exports = {
    PALOS, VALORES, NOMBRES, CATEGORIAS,
    barajaCompleta, barajar, mazoNuevo, nombreDe,
    valorarCinco, comparar, mejorMano, combinaciones5
};
