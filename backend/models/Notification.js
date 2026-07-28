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

    type: { type: String, enum: ['like', 'comment'], required: true },

    // Entreno sobre el que se actúa
    workout: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutLog' },
    workoutName: { type: String, default: '' },

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
