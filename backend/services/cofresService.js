const crypto = require('crypto');
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { addRewards } = require('./levelService');

/**
 * LOS COFRES DE LA TIENDA.
 *
 * Se compran con fichas y dentro puede haber de todo MENOS monedas de oro:
 * fichas, experiencia u objetos del catalogo (avatares, marcos, mascotas,
 * titulos, temas, pociones). Diez cofres, cada uno con su tabla de premios.
 *
 * ⚠️ LA TABLA ES LA VERDAD, Y SE ENSEÑA. `resumenDe(cofre)` calcula los
 * porcentajes a partir de los pesos y es lo que el movil pinta en el boton de
 * informacion. No hay una lista de porcentajes escrita aparte que pueda
 * quedarse vieja: sale de la misma tabla que decide el premio.
 *
 * ⚠️ NINGUN COFRE DEVUELVE MAS DE LO QUE CUESTA, DE MEDIA. Los premios se miden
 * en fichas (los objetos, por su precio de tienda) y la prueba de economia
 * comprueba que cada cofre devuelve entre el 60% y el 90%: abrir cofres es
 * jugar, no una maquina de imprimir fichas, pero tampoco tirar el dinero.
 *
 * Un objeto UNICO (avatar, marco, mascota, titulo, tema) que ya tienes no se
 * repite: se convierte en la mitad de su precio en fichas, y la respuesta lo
 * dice. Las pociones se apilan.
 *
 * Cada entrada de una tabla:
 *     { t: 'fichas', min, max, peso }
 *     { t: 'xp',     min, max, peso }
 *     { t: 'objeto', rareza, categorias, peso }   // uno al azar del catalogo
 */

const COSMETICOS = ['avatar', 'frame', 'pet', 'title', 'theme'];
const UNICOS = new Set(COSMETICOS);

const COFRES = [
    {
        id: 'ronoso', nombre: 'Cofre Roñoso', precio: 50, icono: '📦', rareza: 'comun',
        descripcion: 'Casi siempre fichas. Alguna vez, algo más.',
        tabla: [
            { t: 'fichas', min: 20, max: 70, peso: 75 },
            { t: 'xp', min: 20, max: 50, peso: 20 },
            { t: 'objeto', rareza: 'comun', categorias: COSMETICOS, peso: 5 }
        ]
    },
    {
        id: 'madera', nombre: 'Cofre de Madera', precio: 100, icono: '🪵', rareza: 'comun',
        descripcion: 'Fichas, algo de XP, y un objeto común de vez en cuando.',
        tabla: [
            { t: 'fichas', min: 50, max: 160, peso: 60 },
            { t: 'xp', min: 30, max: 100, peso: 25 },
            { t: 'objeto', rareza: 'comun', categorias: COSMETICOS, peso: 15 }
        ]
    },
    {
        id: 'hierro', nombre: 'Cofre de Hierro', precio: 180, icono: '⚙️', rareza: 'comun',
        descripcion: 'Uno de cada cuatro trae un objeto.',
        tabla: [
            { t: 'fichas', min: 100, max: 300, peso: 50 },
            { t: 'xp', min: 60, max: 160, peso: 20 },
            { t: 'objeto', rareza: 'comun', categorias: COSMETICOS, peso: 25 },
            { t: 'objeto', rareza: 'raro', categorias: COSMETICOS, peso: 5 }
        ]
    },
    {
        id: 'bronce', nombre: 'Cofre de Bronce', precio: 300, icono: '🥉', rareza: 'raro',
        descripcion: 'Empiezan a salir objetos raros.',
        tabla: [
            { t: 'fichas', min: 180, max: 520, peso: 45 },
            { t: 'xp', min: 100, max: 250, peso: 15 },
            { t: 'objeto', rareza: 'comun', categorias: COSMETICOS, peso: 25 },
            { t: 'objeto', rareza: 'raro', categorias: COSMETICOS, peso: 15 }
        ]
    },
    {
        id: 'plata', nombre: 'Cofre de Plata', precio: 500, icono: '🥈', rareza: 'raro',
        descripcion: 'Casi la mitad de las veces, un objeto. Uno de cada diez, épico.',
        tabla: [
            { t: 'fichas', min: 200, max: 750, peso: 40 },
            { t: 'xp', min: 150, max: 400, peso: 15 },
            { t: 'objeto', rareza: 'raro', categorias: COSMETICOS, peso: 35 },
            { t: 'objeto', rareza: 'epico', categorias: COSMETICOS, peso: 10 }
        ]
    },
    {
        id: 'dorado', nombre: 'Cofre Dorado', precio: 800, icono: '🥇', rareza: 'epico',
        descripcion: 'La mitad son objetos, y uno de cada cuatro es épico.',
        tabla: [
            { t: 'fichas', min: 450, max: 1300, peso: 35 },
            { t: 'xp', min: 250, max: 600, peso: 15 },
            { t: 'objeto', rareza: 'raro', categorias: COSMETICOS, peso: 25 },
            { t: 'objeto', rareza: 'epico', categorias: COSMETICOS, peso: 25 }
        ]
    },
    {
        id: 'botiquin', nombre: 'Botiquín', precio: 150, icono: '🧰', rareza: 'comun',
        descripcion: 'Solo pociones: de vida y de XP.',
        tabla: [
            { t: 'objeto', rareza: 'comun', categorias: ['consumable'], peso: 45 },
            { t: 'objeto', rareza: 'raro', categorias: ['consumable'], peso: 35 },
            { t: 'objeto', rareza: 'epico', categorias: ['consumable'], peso: 8 },
            { t: 'fichas', min: 60, max: 200, peso: 12 }
        ]
    },
    {
        id: 'coleccionista', nombre: 'Cofre del Coleccionista', precio: 900, icono: '🗝️', rareza: 'epico',
        descripcion: 'Siempre un objeto. Nunca fichas.',
        tabla: [
            { t: 'objeto', rareza: 'comun', categorias: COSMETICOS, peso: 20 },
            { t: 'objeto', rareza: 'raro', categorias: COSMETICOS, peso: 40 },
            { t: 'objeto', rareza: 'epico', categorias: COSMETICOS, peso: 30 },
            { t: 'objeto', rareza: 'legendario', categorias: COSMETICOS, peso: 10 }
        ]
    },
    {
        id: 'bestia', nombre: 'Cofre de la Bestia', precio: 900, icono: '🐾', rareza: 'epico',
        descripcion: 'Siempre una mascota.',
        tabla: [
            { t: 'objeto', rareza: 'comun', categorias: ['pet'], peso: 15 },
            { t: 'objeto', rareza: 'raro', categorias: ['pet'], peso: 45 },
            { t: 'objeto', rareza: 'epico', categorias: ['pet'], peso: 30 },
            { t: 'objeto', rareza: 'legendario', categorias: ['pet'], peso: 10 }
        ]
    },
    {
        id: 'legendario', nombre: 'Cofre Legendario', precio: 2000, icono: '💎', rareza: 'legendario',
        descripcion: 'Uno de cada tres es legendario. Lo demás, épico o un buen puñado de fichas.',
        tabla: [
            { t: 'objeto', rareza: 'epico', categorias: COSMETICOS, peso: 35 },
            { t: 'objeto', rareza: 'legendario', categorias: COSMETICOS, peso: 30 },
            { t: 'fichas', min: 1000, max: 2600, peso: 25 },
            { t: 'xp', min: 800, max: 1500, peso: 10 }
        ]
    }
];

const cofrePorId = (id) => COFRES.find(c => c.id === id) || null;

/** Una entrada de la tabla, al azar y por peso. */
const tirar = (tabla) => {
    const total = tabla.reduce((a, e) => a + e.peso, 0);
    let r = crypto.randomInt(total);
    for (const e of tabla) {
        if (r < e.peso) return e;
        r -= e.peso;
    }
    return tabla[tabla.length - 1];
};

const entre = (min, max) => min + crypto.randomInt(max - min + 1);

const NOMBRE_RAREZA = { comun: 'común', raro: 'raro', epico: 'épico', legendario: 'legendario' };
const NOMBRE_CATEGORIA = { avatar: 'avatar', frame: 'marco', pet: 'mascota', title: 'título', theme: 'tema', consumable: 'poción' };

/** Con que palabras se enseña una entrada de la tabla. */
const etiquetaDe = (e) => {
    if (e.t === 'fichas') return `${e.min}–${e.max} fichas`;
    if (e.t === 'xp') return `${e.min}–${e.max} XP`;
    const que = e.categorias.length === 1 ? NOMBRE_CATEGORIA[e.categorias[0]] || 'objeto' : 'objeto';
    return `${que.charAt(0).toUpperCase() + que.slice(1)} ${NOMBRE_RAREZA[e.rareza] || e.rareza}`;
};

/** Los porcentajes de un cofre, para el boton de informacion. */
const resumenDe = (cofre) => {
    const total = cofre.tabla.reduce((a, e) => a + e.peso, 0);
    return cofre.tabla.map(e => ({
        tipo: e.t,
        rareza: e.rareza || null,
        etiqueta: etiquetaDe(e),
        porcentaje: Math.round((e.peso / total) * 1000) / 10
    }));
};

/** Lo que el movil necesita de cada cofre. */
const catalogoDeCofres = () => COFRES.map(c => ({
    id: c.id, nombre: c.nombre, precio: c.precio, icono: c.icono, rareza: c.rareza,
    descripcion: c.descripcion, probabilidades: resumenDe(c)
}));

/** Un objeto del catalogo al azar que encaje con la entrada. */
const elegirObjeto = async (entrada) => {
    const candidatos = await ShopItem.find({
        user: null,
        rarity: entrada.rareza,
        category: { $in: entrada.categorias },
        price: { $gt: 0 }
    }).lean();
    if (candidatos.length === 0) return null;
    return candidatos[crypto.randomInt(candidatos.length)];
};

/**
 * Abre un cofre para un usuario: decide el premio, lo aplica y lo devuelve.
 * El cofre ya tiene que estar descontado del inventario (lo hace el
 * controlador, con candado). Devuelve:
 *     { tipo: 'fichas'|'xp'|'objeto', valor, objeto?, duplicado? }
 */
const abrirCofre = async (userId, cofre) => {
    const entrada = tirar(cofre.tabla);

    if (entrada.t === 'fichas') {
        const valor = entre(entrada.min, entrada.max);
        await User.updateOne({ _id: userId }, { $inc: { gameCoins: valor } });
        return { tipo: 'fichas', valor };
    }
    if (entrada.t === 'xp') {
        const valor = entre(entrada.min, entrada.max);
        // Por addRewards: el XP puede subir de nivel.
        await addRewards(userId, valor, 0, 0);
        return { tipo: 'xp', valor };
    }

    const objeto = await elegirObjeto(entrada);
    if (!objeto) {
        // Sin candidatos en el catalogo (no deberia pasar): fichas por el valor
        // medio de esa rareza, para no dejar el cofre vacio.
        const valor = { comun: 100, raro: 350, epico: 900, legendario: 2000 }[entrada.rareza] || 100;
        await User.updateOne({ _id: userId }, { $inc: { gameCoins: valor } });
        return { tipo: 'fichas', valor, sinObjeto: true };
    }

    const resumen = { _id: objeto._id, name: objeto.name, icon: objeto.icon, sprite: objeto.sprite, rarity: objeto.rarity, category: objeto.category, price: objeto.price };

    if (UNICOS.has(objeto.category)) {
        const yaLoTiene = await User.exists({ _id: userId, 'inventory.item': objeto._id });
        if (yaLoTiene) {
            const valor = Math.round(objeto.price / 2);
            await User.updateOne({ _id: userId }, { $inc: { gameCoins: valor } });
            return { tipo: 'fichas', valor, duplicado: true, objeto: resumen };
        }
    }

    // Apilar si ya hay una entrada (pociones), y si no, añadirla.
    const apilado = await User.updateOne(
        { _id: userId, 'inventory.item': objeto._id },
        { $inc: { 'inventory.$.quantity': 1 } }
    );
    if (apilado.matchedCount === 0) {
        await User.updateOne({ _id: userId }, { $push: { inventory: { item: objeto._id, quantity: 1 } } });
    }
    return { tipo: 'objeto', valor: 1, objeto: resumen };
};

module.exports = { COFRES, cofrePorId, resumenDe, catalogoDeCofres, abrirCofre, tirar, COSMETICOS };
