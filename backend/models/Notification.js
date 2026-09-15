const mongoose = require('mongoose');

/**
 * Notificaciones sociales (me gusta y comentarios).
 *
 * Van en su propia colección y no como array dentro de User —a diferencia de
 * friendRequests/missionRequests— porque son de alto volumen: un usuario activo
 * puede acumular cientos, y meterlas en el documento del usuario lo haría crecer
 * sin control y ralentizaría cada login.
 */
const notificationSchema = new mongoose.Schema({
    // Quién la recibe
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Quién la provoca
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // 'reto' = alguien te ha desafiado. 'duelo' = un duelo ha terminado. Son
    // dos avisos distintos y por eso son dos tipos: el primero pide que hagas
    // algo (aceptar o pasar) y el segundo solo cuenta lo que ha pasado.
    // 'mencion' = alguien te ha nombrado (@tu_nombre) en un comentario.
    type: { type: String, enum: ['like', 'comment', 'duelo', 'reto', 'mencion'], required: true },

    // Entreno sobre el que se actúa
    workout: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutLog' },
    workoutName: { type: String, default: '' },

    // Duelo del que se avisa. El texto NO se guarda aquí: "has ganado" y "has
    // perdido" son la misma notificación leída por dos personas distintas, así
    // que la frase se arma en el móvil a partir del duelo.
    challenge: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },

    // Texto del comentario (vacío en los me gusta)
    text: { type: String, default: '' },

    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Consulta principal: "mis notificaciones, de la más nueva a la más vieja"
notificationSchema.index({ user: 1, createdAt: -1 });
// EL BUZON SE VACIA SOLO: a los 7 dias la notificacion desaparece. Es un
// indice TTL de Mongo, que borra en segundo plano; sin esto el buzon crecia
// sin limite y lo de hace un mes seguia ahi.
//
// ⚠️ Si se cambia el plazo hay que cambiarlo tambien en Mongo: un indice TTL
// que ya existe con otro `expireAfterSeconds` no se actualiza solo al
// arrancar (Mongoose lo intenta crear, choca con el que hay y avisa). Se
// arregla en server.js al conectar, con collMod.
const DIAS_EN_EL_BUZON = 7;
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * DIAS_EN_EL_BUZON });
// Para el contador de no leídas
notificationSchema.index({ user: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
Notification.DIAS_EN_EL_BUZON = DIAS_EN_EL_BUZON;
module.exports = Notification;
