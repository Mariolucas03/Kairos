const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Intentamos conectar usando la variable de entorno
        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error de conexión: ${error.message}`);
        // Detenemos la app con error (1) para que el servidor no se quede "colgado"
        process.exit(1);
    }
};

module.exports = connectDB;