const mongoose = require('mongoose');

/**
 * REGISTRO DE LO QUE HACEN LOS ADMINISTRADORES.
 *
 * El panel puede suspender cuentas, generar contrasenas, sumar dinero y borrar
 * cuentas enteras. Hasta ahora ninguna de esas cosas dejaba rastro: si manana
 * aparecen 5.000 fichas de mas en una cuenta, no habia forma de saber si las
 * puso un admin, si fue un fallo del casino o si alguien encontro un agujero.
 *
 * Sirve para dos cosas, y la segunda importa mas:
 *
 *  1. Recordar lo que hiciste. Un ajuste de hace tres semanas no se recuerda.
 *  2. Que el poder deje huella. Un panel que puede darse dinero a si mismo sin
 *     que quede constancia es un panel en el que hay que confiar a ciegas; con
 *     registro, se puede revisar.
 *
 * No se puede editar ni borrar desde la app a proposito: un registro que el
 * propio administrador puede limpiar no es un registro. Se caduca solo al ano.
 */
const adminLogSchema = new mongoose.Schema({
    // Quien lo hizo. Se guarda tambien el nombre suelto porque si esa cuenta se
    // borra, el registro tiene que seguir diciendo quien fue.
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNombre: { type: String, required: true },

    // Que hizo, en corto y en maquina: 'banear', 'ajustar-saldo', 'borrar-cuenta'...
    accion: { type: String, required: true, index: true },

    // Sobre quien, cuando aplica. Mismo motivo para el nombre suelto.
    objetivo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    objetivoNombre: { type: String, default: '' },

    // Frase entendible, ya montada, para poder ensenar el registro sin
    // reconstruirlo: "sumo 500 fichas a Ari".
    resumen: { type: String, default: '' },

    // Lo que haga falta para entender el cambio (antes/despues, motivo...).
    // Es libre porque cada accion guarda cosas distintas.
    detalle: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Se caduca solo al ano: es un registro de seguridad, no un archivo historico,
// y la base de datos gratuita tiene 512 MB.
adminLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
