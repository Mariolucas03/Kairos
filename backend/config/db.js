const mongoose = require('mongoose');

/**
 * EL PLAZO DEL BUZON, PUESTO AL DIA EN MONGO.
 *
 * Las notificaciones caducan con un indice TTL. Mongo no deja cambiar el
 * plazo de un indice TTL que ya existe volviendolo a crear: Mongoose lo
 * intenta al arrancar, choca ("ya existe con otras opciones") y se queda el
 * plazo viejo para siempre. `collMod` es la forma de cambiarlo en sitio; si
 * el indice aun no existe, se crea.
 */
const ajustarCaducidadDelBuzon = async () => {
    try {
        const Notification = require('../models/Notification');
        const segundos = 60 * 60 * 24 * Notification.DIAS_EN_EL_BUZON;
        const db = mongoose.connection.db;
        const indices = await db.collection('notifications').indexes().catch(() => []);
        const ttl = indices.find(i => i.key && i.key.createdAt === 1 && Object.keys(i.key).length === 1);
        if (ttl && ttl.expireAfterSeconds !== segundos) {
            await db.command({ collMod: 'notifications', index: { name: ttl.name, expireAfterSeconds: segundos } });
            console.log(`🧹 Buzón: las notificaciones caducan a los ${Notification.DIAS_EN_EL_BUZON} días (antes ${Math.round(ttl.expireAfterSeconds / 86400)}).`);
        } else if (!ttl) {
            await db.collection('notifications').createIndex({ createdAt: 1 }, { expireAfterSeconds: segundos });
        }
    } catch (error) {
        console.error('No se pudo ajustar la caducidad del buzón:', error.message);
    }
};

const connectDB = async () => {
    try {
        // Intentamos conectar usando la variable de entorno
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
        await ajustarCaducidadDelBuzon();
    } catch (error) {
        console.error(`❌ Error de conexión: ${error.message}`);
        // Detenemos la app con error (1) para que el servidor no se quede "colgado"
        process.exit(1);
    }
};

module.exports = connectDB;
