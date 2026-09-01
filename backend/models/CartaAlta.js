const mongoose = require('mongoose');

/**
 * CARTA ALTA — sala de juego con una baraja española de verdad.
 *
 * Se monta una sala, se invita a quien quieras, y cuando el líder dice, empieza
 * la partida. Si no invitas a nadie, juegas contra la máquina.
 *
 * Cada mano, todos ponen lo mismo y levantan una carta. La más alta se lleva el
 * bote entero.
 *
 * ⚠️ EL MAZO NO SALE DEL SERVIDOR.
 *
 * Es la diferencia entre un juego y una pantomima: si el móvil supiera el orden,
 * sabría su carta antes de pedirla. Lo único que viaja es lo que YA ha salido,
 * que es público y es justo lo que permite contar cartas.
 *
 * Y contar importa: son 40 cartas que salen y no vuelven. Con dos jugadores son
 * 20 manos; con cinco, ocho. Cuantos más seáis, más corta la partida y antes se
 * queda la baraja seca — que es parte de la gracia.
 */

const cartaSchema = new mongoose.Schema({
    numero: { type: Number, required: true },   // 1-7, 10 sota, 11 caballo, 12 rey
    palo: { type: String, enum: ['oros', 'copas', 'espadas', 'bastos'], required: true }
}, { _id: false });

/**
 * Un puesto en la sala.
 *
 * La máquina ocupa uno igual que cualquiera, con `user` vacío. Así el resto del
 * código no tiene que preguntar en cada línea si juega un humano o no: reparte,
 * cobra y paga por puesto, y solo el cobro mira si hay una cuenta detrás.
 */
const jugadorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    esMaquina: { type: Boolean, default: false },
    // Se guarda el nombre suelto: si esa cuenta se borra, la partida tiene que
    // seguir contando quién jugó.
    nombre: { type: String, default: '' },
    avatar: { type: String, default: '' },
    // Fichas ganadas o perdidas en esta partida
    saldo: { type: Number, default: 0 },
    // Se pone a false al salirse o al ser expulsado con la partida ya empezada
    activo: { type: Boolean, default: true }
}, { _id: false });

const tiradaSchema = new mongoose.Schema({
    puesto: { type: Number, required: true },   // índice dentro de `jugadores`
    carta: { type: cartaSchema, required: true }
}, { _id: false });

const manoSchema = new mongoose.Schema({
    numero: { type: Number, required: true },
    tiradas: { type: [tiradaSchema], default: [] },
    // Puesto ganador. -1 cuando hubo empate arriba; null mientras falte gente.
    ganador: { type: Number, default: null },
    empate: { type: Boolean, default: false },
    premio: { type: Number, default: 0 },
    resueltaEn: { type: Date }
}, { _id: false });

const cartaAltaSchema = new mongoose.Schema({
    lider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Fichas que pone CADA UNO en la mano que viene. Sube con cada empate y
    // vuelve a la base en cuanto alguien gana.
    apuesta: { type: Number, required: true, min: 1 },

    // La que puso el líder. Es a la que se vuelve después de un empate: sin
    // esto, una racha de empates dejaría la apuesta por las nubes para siempre.
    apuestaBase: { type: Number, required: true, min: 1 },

    jugadores: { type: [jugadorSchema], default: [] },

    // Invitados que todavía no han contestado
    invitados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    estado: { type: String, enum: ['sala', 'activa', 'terminada'], default: 'sala' },

    // Si juegas solo, la máquina ocupa un puesto. No cambia ninguna regla: los
    // empates doblan la apuesta igual que entre amigos.
    contraMaquina: { type: Boolean, default: false },

    mazo: { type: [cartaSchema], default: [] },
    manos: { type: [manoSchema], default: [] },

    // Lo acumulado por los empates. Se lo lleva ENTERO quien gane la siguiente.
    bote: { type: Number, default: 0 },

    manosTotales: { type: Number, default: 0 },
    terminadaEn: { type: Date }
}, { timestamps: true });

// Para "mis salas": las que lidero o en las que juego
cartaAltaSchema.index({ lider: 1, estado: 1, updatedAt: -1 });
cartaAltaSchema.index({ 'jugadores.user': 1, estado: 1, updatedAt: -1 });
cartaAltaSchema.index({ invitados: 1, estado: 1 });

module.exports = mongoose.model('CartaAlta', cartaAltaSchema);
