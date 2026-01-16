const mongoose = require('mongoose');

// Esquema de un alimento individual dentro de una comida
const foodEntrySchema = new mongoose.Schema({
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' }, // Referencia opcional
    name: { type: String, required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 } // Multiplicador (ej: 1.5 raciones)
});

// Esquema de "Caja de Comida" (Desayuno, Comida, Cena...)
const mealCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    foods: [foodEntrySchema]
});

// Esquema Principal del Día
const nutritionLogSchema = new mongoose.Schema({
    // VINCULACIÓN DE USUARIO (CRUCIAL)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // Formato YYYY-MM-DD

    // Totales del día (Caché para no recalcular siempre)
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    totalFiber: { type: Number, default: 0 },

    // Array dinámico de comidas
    meals: [mealCategorySchema]
});

// ÍNDICE ÚNICO: Un usuario solo puede tener UN log por fecha.
nutritionLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);