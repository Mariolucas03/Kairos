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
 * ⚠️ LOS PASOS Y LOS KILOMETROS NO ESTAN, Y ESO ES UNA DECISION.
 *
 * Se declaraban cuatro tipos al principio: misiones, gimnasio, pasos y
 * kilometros. Los dos ultimos se van porque salen de una casilla donde tecleas
 * un numero a mano. Eso da igual mientras compitas contigo mismo —mentir solo te
 * perjudica—, pero un duelo con apuesta convierte mentir en quitarle fichas a un
 * amigo. Un duelo de pasos seria "quien teclea el numero mas grande".
 *
 * Lo que queda lo calcula el SERVIDOR: los kilos y los entrenos salen de las
 * sesiones guardadas (con techo por sesion, y con la misma cuenta que mueve los
 * rangos musculares), y la XP y las misiones las reparte el servidor sin que
 * haya ninguna casilla donde escribirlas.
 *
 * Que mide cada uno esta en services/duelosService.js, en MEDIDAS.
 */
const challengeSchema = new mongoose.Schema({
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
        type: String,
        enum: ['gym', 'entrenos', 'xp', 'misiones'],
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
