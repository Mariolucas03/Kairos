// Fechas "de calendario" en hora de Madrid, igual que el backend.
// new Date().toISOString() devuelve la fecha en UTC, que entre las 00:00 y 02:00
// de Madrid es el día anterior: eso descuadraba la recompensa diaria con el servidor.
export const getMadridDateString = (dateObj = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(dateObj);
};
