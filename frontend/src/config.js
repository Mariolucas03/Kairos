// frontend/src/config.js

// En Vite, las variables de entorno se acceden con import.meta.env
// Si VITE_API_URL existe (Producción), usa esa. Si no, usa localhost (Desarrollo).
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';