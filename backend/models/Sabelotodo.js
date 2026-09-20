const mongoose = require('mongoose');

/**
 * SABELOTODO — el trivial en pareja.
 *
 * Como el Preguntados, pero COOPERATIVO: dos personas, un solo equipo. Se
 * turnan; en cada turno se gira la ruleta, sale una categoria y una pregunta.
 * Acertar da la corona de esa categoria; fallar quita una vida AL EQUIPO. Con
 * las seis coronas, ganais los dos; con las tres vidas perdidas, perdeis los
 * dos. No hay nada que ganarle al otro: o salis juntos o no salis.
 *
 * Como los duelos, se pueden tener varias a la vez: una con cada amigo.
 *
 * ⚠️ LA RESPUESTA CORRECTA NO SALE DEL SERVIDOR.
 * `enCurso.correcta` es la posicion de la buena entre las opciones ya
 * barajadas. El movil recibe las opciones y nada mas; solo al contestar se le
 * dice si ha acertado y cual era.
 */

const jugadorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Nombre y avatar sueltos: si la cuenta se borra, la partida sigue
    // contando quien jugo.
    nombre: { type: String, default: '' },
    avatar: { type: String, default: '' }
}, { _id: false });

const preguntaEnCursoSchema = new mongoose.Schema({
    preguntaId: { type: String, required: true },
    categoria: { type: String, required: true },
    texto: { type: String, required: true },
    opciones: { type: [String], required: true },
    correcta: { type: Number, required: true },
    servidaEn: { type: Date, default: Date.now }
}, { _id: false });

const jugadaSchema = new mongoose.Schema({
    jugador: { type: Number, required: true },      // indice en `jugadores`
    preguntaId: { type: String, required: true },
    categoria: { type: String, required: true },
    texto: { type: String, default: '' },
    acierto: { type: Boolean, required: true },
    elegida: { type: String, default: '' },
    correcta: { type: String, default: '' },
    fecha: { type: Date, default: Date.now }
}, { _id: false });

const sabelotodoSchema = new mongoose.Schema({
    creador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // A quien se ha invitado y aun no ha contestado. Se vacia al aceptar.
    invitado: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    jugadores: { type: [jugadorSchema], default: [] },

    estado: {
        type: String,
        enum: ['invitacion', 'activa', 'ganada', 'perdida', 'rechazada', 'abandonada'],
        default: 'invitacion'
    },

    coronas: { type: [String], default: [] },
    vidas: { type: Number, default: 3 },

    // A quien le toca (indice en `jugadores`) y cuantas lleva seguidas en
    // este turno: a las tres, pasa el turno aunque acierte.
    turno: { type: Number, default: 0 },
    racha: { type: Number, default: 0 },

    enCurso: { type: preguntaEnCursoSchema, default: null },

    // Preguntas ya salidas en esta partida, para no repetir
    usadas: { type: [String], default: [] },
    historial: { type: [jugadaSchema], default: [] },

    premio: { type: { xp: Number, fichas: Number }, default: null },
    terminadaEn: { type: Date }
}, { timestamps: true });

sabelotodoSchema.index({ 'jugadores.user': 1, updatedAt: -1 });
sabelotodoSchema.index({ invitado: 1, estado: 1 });

module.exports = mongoose.model('Sabelotodo', sabelotodoSchema);
