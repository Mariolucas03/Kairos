const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    getNutritionLog,
    addMealCategory,
    seedFoods,
    analyzeImage,
    getSavedFoods,
    saveCustomFood,
    deleteSavedFood,
    updateSavedFood,
    chatMacroCalculator,
    addFoodToLog,
    searchFoods,
    addFoodEntry,
    analyzeFoodText,
    removeFoodFromLog
} = require('../controllers/foodController');
const protect = require('../middleware/authMiddleware');

// 🔥 FIX ARQUITECTÓNICO: Usar memoria en lugar de disco (Ultra rápido para Serverless)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de seguridad: 5MB máximo por foto
});

router.get('/log', protect, getNutritionLog);
router.post('/add', protect, addFoodEntry);
router.post('/category', protect, addMealCategory);
router.post('/seed', protect, seedFoods);

// Le pasamos el multer en memoria
router.post('/analyze', protect, upload.single('image'), analyzeImage);

// RUTAS DE GUARDADO Y BÚSQUEDA
router.post('/log/:mealId', protect, addFoodToLog);
router.delete('/log/:mealId/:foodItemId', protect, removeFoodFromLog); // Aseguramos que exista la ruta delete
router.get('/search', protect, searchFoods);

// RUTA NUEVA IA TEXTO
router.post('/analyze-text', protect, analyzeFoodText);

// Mis Comidas
router.get('/saved', protect, getSavedFoods);
router.post('/save', protect, saveCustomFood);
router.delete('/saved/:id', protect, deleteSavedFood);
router.put('/saved/:id', protect, updateSavedFood);

// Chat Perfil
router.post('/chat-macros', protect, chatMacroCalculator);

module.exports = router;