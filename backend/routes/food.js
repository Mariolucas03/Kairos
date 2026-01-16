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
    analyzeFoodText // <--- IMPORTADO
} = require('../controllers/foodController');
const protect = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.get('/log', protect, getNutritionLog);
router.post('/add', protect, addFoodEntry);
router.post('/category', protect, addMealCategory);
router.post('/seed', protect, seedFoods);
router.post('/analyze', protect, upload.single('image'), analyzeImage);

// 🔥 RUTAS DE GUARDADO Y BÚSQUEDA
router.post('/log/:mealId', protect, addFoodToLog);
router.get('/search', protect, searchFoods);

// 🔥 RUTA NUEVA IA TEXTO
router.post('/analyze-text', protect, analyzeFoodText);

// Mis Comidas
router.get('/saved', protect, getSavedFoods);
router.post('/save', protect, saveCustomFood);
router.delete('/saved/:id', protect, deleteSavedFood);
router.put('/saved/:id', protect, updateSavedFood);

// Chat Perfil
router.post('/chat-macros', protect, chatMacroCalculator);

module.exports = router;