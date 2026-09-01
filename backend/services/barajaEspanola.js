const crypto = require('crypto');

/**
 * LA BARAJA ESPAÑOLA, CON SUS REGLAS.
 *
 * Vive aparte del controlador para poder comprobarla sin base de datos: que la
 * baraja tenga las 40 cartas y ni una repetida, y que el orden de fuerza sea el
 * que espera cualquiera que haya jugado a la brisca, es de las pocas cosas de
 * esta app que se pueden demostrar del todo.
 */

const PALOS = ['oros', 'copas', 'espadas', 'bastos'];

// Los números que existen en una baraja española: no hay 8 ni 9.
const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

/**
 * ORDEN DE FUERZA, de menor a mayor.
 *
 * Es el de la brisca y el tute, no el numérico: el as manda y el tres va
 * detrás. Un jugador español lo da por hecho, y hacerlo "por número" —con el as
 * de carta más floja— convertiría el juego en otra cosa.
 *
 * En la app se enseña esta escalera, porque el que no la conozca no puede
 * calcular nada.
 */
const FUERZA = [2, 4, 5, 6, 7, 10, 11, 12, 3, 1];

const NOMBRES = {
    1: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco',
    6: 'Seis', 7: 'Siete', 10: 'Sota', 11: 'Caballo', 12: 'Rey'
};

/** Cuánto vale una carta para decidir quién gana. Mayor número, más fuerte. */
const fuerzaDe = (carta) => FUERZA.indexOf(Number(carta?.numero));

/** Nombre para enseñar: "Rey de bastos". */
const nombreDe = (carta) =>
    carta ? `${NOMBRES[carta.numero] || carta.numero} de ${carta.palo}` : '';

/** Las 40, en orden. */
const barajaCompleta = () => {
    const cartas = [];
    for (const palo of PALOS) {
        for (const numero of NUMEROS) cartas.push({ numero, palo });
    }
    return cartas;
};

/**
 * Baraja de verdad.
 *
 * Fisher-Yates con crypto.randomInt y no con Math.random: es dinero de la
 * gente, y Math.random no promete nada sobre lo predecible que es. Cuesta lo
 * mismo hacerlo bien.
 */
const barajar = (cartas) => {
    const mazo = [...cartas];
    for (let i = mazo.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
    }
    return mazo;
};

/** Una baraja nueva, barajada. */
const mazoNuevo = () => barajar(barajaCompleta());

/**
 * Quién gana la mano.
 * @returns {'a'|'b'|'empate'}
 */
const ganadorDe = (cartaA, cartaB) => {
    const fa = fuerzaDe(cartaA);
    const fb = fuerzaDe(cartaB);
    if (fa === fb) return 'empate';
    return fa > fb ? 'a' : 'b';
};

module.exports = {
    PALOS, NUMEROS, FUERZA, NOMBRES,
    barajaCompleta, barajar, mazoNuevo,
    fuerzaDe, nombreDe, ganadorDe
};
