require('dotenv').config();
const mongoose = require('mongoose');
const DailyLog = require('./models/DailyLog');

const fixDB = async () => {
    try {
        console.log("⏳ Conectando a MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Conectado.");

        console.log("🧹 Borrando registros corruptos de DailyLog...");
        // Esto borra TODOS los logs diarios para reiniciar el formato
        await DailyLog.deleteMany({});

        console.log("✨ ¡Limpieza completada! La base de datos está limpia.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

fixDB();