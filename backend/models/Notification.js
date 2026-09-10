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
    type: { type: String, enum: ['like', 'comment', 'duelo', 'reto'], required: true },

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
// Para el contador de no leídas
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
