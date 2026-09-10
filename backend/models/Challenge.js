const mongoose = require('mongoose');

/**
 * UN DUELO ENTRE DOS AMIGOS.
 *
 * ⚠️ ESTO ESTUVO A MEDIAS MUCHO TIEMPO.
 *
 * Se podía crear un reto y aceptarlo, y ahí se acababa: nada ponía ganador,
 * nada ponía fecha de fin y la apuesta se comprobaba pero no se cobraba nunca.
 * Los duelos empezaban y se quedaban activos para siempre. La pantalla decía
 * "próximamente", así que al menos no mentía.
 *
 * ⚠️ SOLO DE GIMNASIO, Y ESO ES UNA DECISION, NO UN RECORTE.
 *
 * Aquí se declaraban cuatro tipos: misiones, gimnasio, pasos y kilómetros. Pero
 * en esta app TODO lo escribes tú. Los pasos se guardan desde una casilla donde
 * tecleas un número, y los kilómetros igual. Eso da igual mientras compitas
 * contigo mismo —mentir solo te perjudica—, pero un duelo con apuesta convierte
 * mentir en quitarle fichas a otro. Un duelo de pasos seria "quien teclea el
 * numero mas grande".
 *
 * El de gimnasio es el unico que ya viene acotado: el volumen tiene un techo por
 * sesion (MAX_VOLUMEN_SESION) y se calcula con `volumenDe`, la misma cuenta que
 * mueve los rangos musculares. Sigue siendo un numero que escribes tu, pero es
 * el que menos se presta.
 */
const challengeSchema = new mongoose.Schema({
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
        type: String,
        enum: ['gym'],       // kilos movidos en la semana
        default: 'gym',
        required: true
    },

    // Fichas que pone CADA UNO. El bote es el doble.
    betAmount: { type: Number, required: true, default: 0 },

    // ⚠️ 'rejected' ya no esta: rechazar BORRA el duelo, asi que no habia forma
    // de llegar a ese estado. Un valor de enum al que no lleva ningun camino
    // hace pensar que existe una pantalla de "rechazados" que no existe.
    status: {
        type: String,
        enum: ['pending', 'active', 'finished'],
        default: 'pending'
    },

    // Null y `resueltoEn` puesto = empate. Null y sin `resueltoEn` = sigue vivo.
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Los kilos de cada uno al cerrar. Se guardan para poder ENSEÑAR el
    // resultado —"12.400 kg contra 11.200"— sin tener que recalcular el pasado
    // cada vez que se abre la pantalla, que ademas daria otro numero si el
    // usuario borra un entreno despues.
    volumenChallenger: { type: Number, default: 0 },
    volumenOpponent: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },

    // Se ponen al ACEPTAR, las dos a la vez. Mientras el duelo esta pendiente no
    // hay reloj corriendo: no seria justo que contara el tiempo que el otro
    // tarda en contestar.
    startDate: { type: Date },
    endDate: { type: Date },

    // Cuando lo cerro el mantenimiento nocturno. Es lo que distingue un duelo
    // resuelto en empate de uno que todavia no se ha mirado.
    resueltoEn: { type: Date },

    // ⚠️ SI EL BOTE YA SE HA REPARTIDO.
    //
    // Va aparte de `status` porque cerrar y pagar son dos escrituras, y entre
    // las dos cabe un reinicio de Render. Sin esta marca, la puesta al dia del
    // arranque volveria a pagar un duelo ya pagado: eso no es un fallo de
    // pantalla, es fabricar fichas de la nada.
    pagado: { type: Boolean, default: false }
});

// El resolutor nocturno pregunta siempre lo mismo: que duelos activos ya han
// vencido. Sin indice, eso es un barrido de la coleccion entera cada noche.
challengeSchema.index({ status: 1, endDate: 1 });
// Y los que se cerraron sin llegar a pagarse, para poder rescatarlos.
challengeSchema.index({ status: 1, pagado: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);
