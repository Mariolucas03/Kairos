// backend/utils/dateHelpers.js
const getTodayDateString = () => {
    // Retorna YYYY-MM-DD en la zona horaria local o UTC según prefieras
    // Para simplificar, usamos ISO slice (UTC)
    return new Date().toISOString().split('T')[0];
};

module.exports = { getTodayDateString };