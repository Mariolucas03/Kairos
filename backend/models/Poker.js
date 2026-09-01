const mongoose = require('mongoose');

/**
 * PÓQUER TEXAS HOLD'EM — mesa entre amigos.
 *
 * ⚠️ LAS CARTAS TAPADAS NO SALEN DEL SERVIDOR.
 *
 * Ni el mazo, ni las dos cartas de los demás. Cada respuesta se monta a mano y
 * cada jugador solo ve las suyas; las de los rivales aparecen únicamente al
 * enseñarlas en el showdown. Si viajaran, no habría juego que valga.
 *
 * SE ENTRA CON FICHAS Y SE SALE CON LO QUE QUEDE.
 *
 * Al sentarte se te descuentan las fichas de tu saldo y pasan a tu montón de la
 * mesa; al levantarte, lo que quede vuelve. Es como funciona una mesa de verdad
 * y, sobre todo, hace que las cuentas se puedan comprobar: la suma de los
 * montones más lo que hay en el bote tiene que ser SIEMPRE lo que entró.
 */

const cartaSchema = new mongoose.Schema({
    valor: { type: Number, required: true },   // 2-14 (11=J, 12=Q, 13=K, 14=A)
    palo: { type: String, enum: ['picas', 'corazones', 'diamantes', 'treboles'], required: true }
}, { _id: false });

const jugadorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Se guarda suelto: si la cuenta se borra, la mano jugada sigue contando
    // quién estaba sentado.
    nombre: { type: String, default: '' },
    avatar: { type: String, default: '' },

    // Su montón en la mesa
    fichas: { type: Number, default: 0 },
    // Lo que trajo al sentarse, para poder decirle cuánto lleva ganado
    entrada: { type: Number, default: 0 },

    // Sus dos cartas. NUNCA se mandan a otro jugador.
    cartas: { type: [cartaSchema], default: [] },

    // Lo puesto en la ronda de apuestas en curso (para saber qué le falta para
    // igualar) y en la mano entera (para repartir botes laterales).
    apostadoRonda: { type: Number, default: 0 },
    apostadoMano: { type: Number, default: 0 },

    retirado: { type: Boolean, default: false },
    allIn: { type: Boolean, default: false },
    // Ha actuado ya en esta ronda de apuestas
    haActuado: { type: Boolean, default: false },

    // Sigue sentado a la mesa
    sentado: { type: Boolean, default: true }
}, { _id: false });

const pokerSchema = new mongoose.Schema({
    lider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    ciegaGrande: { type: Number, required: true, min: 2 },
    entradaMesa: { type: Number, required: true, min: 1 },

    jugadores: { type: [jugadorSchema], default: [] },
    invitados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    estado: { type: String, enum: ['sala', 'jugando', 'terminada'], default: 'sala' },

    mazo: { type: [cartaSchema], default: [] },
    comunitarias: { type: [cartaSchema], default: [] },

    fase: {
        type: String,
        enum: ['preflop', 'flop', 'turn', 'river', 'showdown', 'entremanos'],
        default: 'preflop'
    },

    // Puesto del botón (reparte). Rota cada mano.
    boton: { type: Number, default: 0 },
    // A quién le toca hablar
    turno: { type: Number, default: 0 },

    // Lo que hay que igualar en la ronda en curso, y lo mínimo que se puede
    // subir por encima (la última subida, o la ciega grande).
    apuestaActual: { type: Number, default: 0 },
    subidaMinima: { type: Number, default: 0 },

    bote: { type: Number, default: 0 },

    manoNumero: { type: Number, default: 0 },

    // Cómo acabó la última mano, para poder enseñarlo mientras empieza la
    // siguiente. Incluye las cartas ENSEÑADAS, que ahí ya son públicas.
    ultimoResultado: { type: mongoose.Schema.Types.Mixed, default: null },

    terminadaEn: { type: Date }
}, { timestamps: true });

pokerSchema.index({ lider: 1, estado: 1, updatedAt: -1 });
pokerSchema.index({ 'jugadores.user': 1, estado: 1, updatedAt: -1 });
pokerSchema.index({ invitados: 1, estado: 1 });

module.exports = mongoose.model('Poker', pokerSchema);
