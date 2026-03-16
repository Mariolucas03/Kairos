// backend/utils/dateHelpers.js

// Usamos la configuración regional para forzar la zona horaria correcta
const getTodayDateString = () => {
    const now = new Date();
    // Ajusta 'Europe/Madrid' a tu zona horaria objetivo si la app es internacional,
    // o pásale la zona horaria desde el frontend en los headers.
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // Devuelve formato YYYY-MM-DD exacto a la hora de Madrid
    return formatter.format(now);
};

module.exports = { getTodayDateString };