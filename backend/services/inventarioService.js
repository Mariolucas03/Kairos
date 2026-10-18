const User = require('../models/User');

/**
 * METER UN OBJETO EN LA MOCHILA.
 *
 * ⚠️ POR QUE EXISTE ESTO Y NO SE HACE A MANO EN CADA SITIO.
 *
 * Meter un objeto parece una linea y son dos: si ya hay una entrada de ese
 * objeto se le suma uno a la cantidad, y si no hay, se crea. Escrito tal cual
 * —mirar si existe y luego escribir— es la carrera de siempre:
 *
 *   - Dos entregas del MISMO objeto a la vez, sin tenerlo todavia: las dos ven
 *     "no hay entrada" y las dos la crean. Acabas con el mismo objeto dos
 *     veces en la mochila, cada uno con su cantidad.
 *
 *   - Y en los cosmeticos, que son UNICOS, es peor: lo normal es que un
 *     repetido se convierta en fichas. Con dos cofres abiertos a la vez los
 *     dos ven "no lo tiene", los dos entregan el avatar, y te quedas con dos
 *     copias del mismo en vez de una copia y la compensacion.
 *
 * Estaba copiado en tres sitios (la tienda, el cofre y la recompensa diaria) y
 * solo la tienda lo tenia bien. Asi que vive aqui y se arregla una vez.
 *
 * La condicion va SIEMPRE dentro del filtro, que es lo unico que no deja hueco
 * entre mirar y escribir.
 */

/** Cuantas vueltas antes de rendirse. Dos bastan; la tercera es por si acaso. */
const INTENTOS = 3;

/**
 * Apila un objeto (pociones, cofres: se pueden tener varios).
 *
 * @returns {Promise<boolean>} si se pudo meter
 */
const apilarObjeto = async (userId, itemId, cuantos = 1) => {
    for (let intento = 0; intento < INTENTOS; intento++) {
        // ¿Ya hay entrada? Se le suma, en una sola escritura.
        const sumado = await User.updateOne(
            { _id: userId, 'inventory.item': itemId },
            { $inc: { 'inventory.$.quantity': cuantos } }
        );
        if (sumado.matchedCount > 0) return true;

        // No habia. Se crea, pero SOLO si sigue sin haberla: si otro la creo
        // entre medias, esta escritura no encuentra a nadie y se vuelve a
        // intentar sumar, en vez de crear una segunda entrada igual.
        const creado = await User.updateOne(
            { _id: userId, 'inventory.item': { $ne: itemId } },
            { $push: { inventory: { item: itemId, quantity: cuantos } } }
        );
        if (creado.modifiedCount > 0) return true;

        // Ni se pudo sumar ni se pudo crear: alguien se adelanto justo aqui.
        // Se repite y esta vez tocara sumar.
    }
    return false;
};

/**
 * Entrega un objeto UNICO (avatares, marcos, titulos: o lo tienes o no).
 *
 * @returns {Promise<boolean>} true si se entrego, false si YA lo tenia (y
 *          entonces quien llama decide que hacer: normalmente pagar fichas).
 */
const entregarUnico = async (userId, itemId) => {
    const creado = await User.updateOne(
        { _id: userId, 'inventory.item': { $ne: itemId } },
        { $push: { inventory: { item: itemId, quantity: 1 } } }
    );
    return creado.modifiedCount > 0;
};

module.exports = { apilarObjeto, entregarUnico };
