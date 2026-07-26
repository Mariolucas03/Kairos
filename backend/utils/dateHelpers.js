// backend/utils/dateHelpers.js
// ⚠️ TODA fecha "de calendario" de la app debe salir de aquí (zona Europe/Madrid).
// Usar new Date().toISOString() da la fecha en UTC, que entre las 00:00 y 02:00
// de Madrid corresponde al día ANTERIOR: eso provocaba que la recompensa diaria
// se pudiera reclamar dos veces o reapareciera ya reclamada.

const APP_TIMEZONE = 'Europe/Madrid';

// Devuelve YYYY-MM-DD en hora de Madrid
const getMadridDateString = (dateObj = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(dateObj);
};

// Devuelve YYYY-MM en hora de Madrid (para ciclos mensuales / ranking)
const getMadridMonthString = (dateObj = new Date()) => getMadridDateString(dateObj).slice(0, 7);

// Alias histórico usado por foodController / gymController
const getTodayDateString = () => getMadridDateString();

module.exports = { getTodayDateString, getMadridDateString, getMadridMonthString, APP_TIMEZONE };
