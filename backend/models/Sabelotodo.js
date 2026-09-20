const mongoose = require('mongoose');

/**
 * SABELOTODO — el trivial en pareja.
 *
 * Como el Preguntados, pero COOPERATIVO: de dos a cuatro personas, un solo
 * equipo. Se turnan; en cada turno se gira la ruleta, sale una categoria y
 * una pregunta. Acertar da la corona de esa categoria; fallar quita una vida
 * AL EQUIPO. Con las seis coronas ganan todos; con las tres vidas perdidas,
 * pierden todos. No hay nada que ganarle a nadie: o salis juntos o no salis.
 *
 * Como los duelos, se pueden tener varias a la vez.
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
    // Quien contesto, por id y por nombre: si alguien deja la partida los
    // indices de `jugadores` se mueven, y esto no puede depender de ellos.
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nombre: { type: String, default: '' },
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

    // Los que estan dentro (el creador el primero) y los que aun no han
    // contestado a la invitacion. Al aceptar se pasa de una lista a la otra.
    jugadores: { type: [jugadorSchema], default: [] },
    invitados: { type: [jugadorSchema], default: [] },

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
sabelotodoSchema.index({ 'invitados.user': 1, estado: 1 });

module.exports = mongoose.model('Sabelotodo', sabelotodoSchema);
