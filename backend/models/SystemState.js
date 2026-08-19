const mongoose = require('mongoose');

/**
 * Estado interno del sistema: pares clave/valor para tareas que no pueden
 * repetirse.
 *
 * Nace por el mantenimiento nocturno. El cron interno se programa a las 03:00,
 * pero en el plan gratuito de Render la instancia está DORMIDA a esa hora: un
 * proceso dormido no ejecuta crons, así que el castigo por misiones no
 * cumplidas no llegaba a correr nunca y la vida no bajaba.
 *
 * Con esta marca, el mantenimiento se puede lanzar al despertar el servidor
 * sabiendo qué día se ejecutó por última vez, sin castigar dos veces.
 */
const systemStateSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemState', systemStateSchema);
