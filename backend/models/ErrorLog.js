const mongoose = require('mongoose');

/**
 * FALLOS DE PANTALLA QUE LLEGAN DESDE LOS MÓVILES.
 *
 * Hasta ahora, cuando una pantalla reventaba, la red de seguridad la cazaba,
 * pintaba "algo se ha roto" y hacía un console.error. Y ya. Nadie se enteraba
 * nunca, salvo que el usuario te escribiera. En la historia de esta app han
 * reventado seis pantallas por usar una variable que no existía, y las seis se
 * descubrieron igual: alguien mirando el código días después.
 *
 * ⚠️ SE AGRUPA POR HUELLA, NO SE GUARDA UNA FILA POR FALLO.
 *
 * Un componente que peta lo hace en bucle: al recargar vuelve a petar. Guardar
 * cada ocurrencia serían miles de documentos del mismo error en una base de 512
 * MB, y un panel con mil líneas iguales no se lee. Cada huella
 * (mensaje + pantalla) es UN documento con un contador, la primera vez y la
 * última. "Se ha roto 340 veces desde el martes" es justo lo que hay que saber,
 * y ocupa lo mismo que si hubiera pasado una.
 *
 * Se caduca solo al mes: esto es para enterarse de lo que está roto AHORA, no
 * un archivo histórico.
 */
const errorLogSchema = new mongoose.Schema({
    // Lo que agrupa: mismo mensaje en la misma pantalla = el mismo fallo.
    huella: { type: String, required: true, unique: true, index: true },

    mensaje: { type: String, required: true },

    // En qué pantalla estaba (la ruta), para poder ir a mirar.
    ruta: { type: String, default: '' },

    // De dónde sale: 'render' (la red de seguridad de React), 'global' (un
    // error suelto de JavaScript) o 'promesa' (un await que nadie capturó).
    origen: { type: String, enum: ['render', 'global', 'promesa'], default: 'render' },

    // Las primeras líneas de la pila. No entera: ocupa mucho y en producción
    // viene minificada, así que a partir de cierto punto no dice nada.
    pila: { type: String, default: '' },

    // Cuántas veces ha pasado en total, y a cuánta gente distinta. Un fallo que
    // le pasa a una persona puede ser su móvil; a los tres, es la app.
    veces: { type: Number, default: 1 },
    usuarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // El navegador del último que lo sufrió, recortado. Sirve para lo que de
    // verdad pasa: que algo solo falle en el iPhone de alguien.
    navegador: { type: String, default: '' },

    primeraVez: { type: Date, default: Date.now },
    ultimaVez: { type: Date, default: Date.now },

    // Marcado como visto desde el panel. No se borra: si vuelve a pasar
    // después de darlo por resuelto, eso es información.
    resuelto: { type: Boolean, default: false },
    resueltoEn: { type: Date }
}, { timestamps: true });

// Los sin resolver primero y por lo reciente, que es como se mira el panel
errorLogSchema.index({ resuelto: 1, ultimaVez: -1 });

// Un mes y fuera: esto es para saber qué está roto ahora
errorLogSchema.index({ ultimaVez: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
