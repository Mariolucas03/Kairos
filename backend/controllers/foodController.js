const Food = require('../models/Food');
const NutritionLog = require('../models/NutritionLog');
const DailyLog = require('../models/DailyLog');
// Importamos el helper de fecha local (¡Asegúrate de que el archivo utils/dateHelpers.js exista!)
const { getTodayDateString } = require('../utils/dateHelpers');

// --- CONFIGURACIÓN OPENROUTER ---
const OpenAI = require("openai");
const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "NoteGym App",
    }
});

// Usamos el helper centralizado en lugar del toISOString() que falla por zona horaria
const getTodayStr = () => getTodayDateString();

// ==========================================
// ⏱️ HELPER: TIMEOUT PARA IA (EVITA BLOQUEOS)
// ==========================================
const fetchWithTimeout = async (config, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await openrouter.chat.completions.create(
            config,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

// ==========================================
// 🤖 CALCULADORA NUTRICIONISTA (CHAT PERFIL)
// ==========================================
const chatMacroCalculator = async (req, res) => {
    const { history } = req.body;

    const TEXT_MODELS_CASCADE = [
        "deepseek/deepseek-r1-distill-llama-70b:free",
        "google/gemini-2.0-flash-exp:free",
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];

    const SYSTEM_PROMPT = `
    Actúa como un nutricionista experto. Extrae edad, peso, altura, género y objetivo.
    REGLAS:
    1. Si tienes TODOS los datos: Calcula TDEE, ajusta según objetivo, distribuye macros (30/40/30).
       Devuelve JSON: { "type": "final", "data": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "message": "Resumen..." } }
    2. Si FALTA dato: Devuelve JSON: { "type": "question", "message": "Pregunta qué falta..." }
    FORMATO JSON PURO SIN MARKDOWN.
    `;

    const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

    for (const model of TEXT_MODELS_CASCADE) {
        try {
            const completion = await fetchWithTimeout({
                model: model,
                messages: messages,
                temperature: 0.5,
                response_format: { type: "json_object" }
            }, 8000);

            let content = completion.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonResponse = JSON.parse(content);
            return res.json(jsonResponse);
        } catch (error) {
            console.error(`❌ Falló o tardó demasiado ${model}: ${error.message}`);
        }
    }
    return res.json({ type: 'question', message: "No pude procesar los datos por alta demanda. Intenta en unos minutos." });
};

// ==========================================
// 🪄 ANALIZAR TEXTO DE COMIDA (CASCADA IA)
// ==========================================
const analyzeFoodText = async (req, res) => {
    const { text } = req.body;

    const TEXT_MODELS_CASCADE = [
        "deepseek/deepseek-r1-distill-llama-70b:free",
        "google/gemini-2.0-flash-exp:free",
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "mistralai/mistral-7b-instruct:free"
    ];

    const SYSTEM_PROMPT = `
    Eres un experto nutricionista y analista de alimentos.
    Tu tarea es analizar el texto del usuario: "${text}".
    
    Calcula o estima las calorías y macronutrientes (Proteína, Carbohidratos, Grasa, Fibra).
    Si el usuario no especifica cantidad, asume una ración estándar lógica.
    
    ⚠️ REGLAS CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido. Nada de texto extra.
    2. Usa números enteros (sin decimales).
    3. Formato exacto:
    {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "fiber": 0,
        "name": "Nombre corto y claro del plato"
    }
    `;

    for (const model of TEXT_MODELS_CASCADE) {
        try {
            console.log(`🤖 Analizando comida con: ${model}...`);
            const completion = await fetchWithTimeout({
                model: model,
                messages: [{ role: "system", content: SYSTEM_PROMPT }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            }, 8000);

            let content = completion.choices[0].message.content;
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                content = content.substring(firstBrace, lastBrace + 1);
            }

            const jsonResponse = JSON.parse(content);
            return res.json({ type: 'success', data: jsonResponse });

        } catch (error) {
            console.error(`❌ Falló visión ${model}: ${error.message}. Probando siguiente...`);
        }
    }

    return res.status(503).json({ message: "Sistemas IA saturados. Por favor, añádelo manualmente." });
};

// ==========================================
// 📷 ANÁLISIS DE IMAGEN (MEGA CASCADA EN RAM)
// ==========================================
const analyzeImage = async (req, res) => {
    const VISION_MODELS = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "qwen/qwen-2.5-vl-72b-instruct:free",
        "meta-llama/llama-3.2-90b-vision-instruct:free",
        "mistralai/pixtral-12b:free"
    ];

    try {
        if (!req.file) return res.status(400).json({ message: 'No hay imagen' });

        const userContext = req.body.context || "Sin contexto extra.";

        // 🔥 FIX ARQUITECTÓNICO: Leemos directamente de la RAM (req.file.buffer) sin tocar el disco.
        // Ya NO usamos fs.readFileSync ni req.file.path
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        let foodData = null;

        const finalPrompt = `
        Analiza esta imagen de comida o etiqueta nutricional.
        Contexto del usuario: "${userContext}".
        Identifica el alimento y calcula sus macros totales aproximados.
        
        Responde SOLO con un JSON válido:
        { 
            "name": "Nombre corto del plato", 
            "calories": int, 
            "protein": int, 
            "carbs": int, 
            "fat": int, 
            "fiber": int, 
            "servingSize": "string" 
        }
        `;

        for (const modelName of VISION_MODELS) {
            try {
                console.log(`👁️ Intentando analizar imagen con: ${modelName}...`);
                const completion = await fetchWithTimeout({
                    model: modelName,
                    messages: [
                        { role: "user", content: [{ type: "text", text: finalPrompt }, { type: "image_url", image_url: { url: base64Image } }] }
                    ],
                    temperature: 0.1
                }, 12000);

                let text = completion.choices[0].message.content;
                const startIndex = text.indexOf('{');
                const endIndex = text.lastIndexOf('}');

                if (startIndex !== -1 && endIndex !== -1) {
                    const jsonStr = text.substring(startIndex, endIndex + 1);
                    foodData = JSON.parse(jsonStr);

                    if (foodData.name && (typeof foodData.calories === 'number')) {
                        console.log(`✅ ÉXITO con ${modelName}`);
                        break;
                    }
                }
            } catch (e) {
                console.error(`❌ Falló visión ${modelName}: ${e.message}`);
            }
        }

        if (foodData) {
            foodData.calories = Math.round(foodData.calories || 0);
            foodData.protein = Math.round(foodData.protein || 0);
            foodData.carbs = Math.round(foodData.carbs || 0);
            foodData.fat = Math.round(foodData.fat || 0);
            foodData.fiber = Math.round(foodData.fiber || 0);

            return res.json(foodData);
        } else {
            return res.status(503).json({ message: 'Ninguna IA pudo leer la imagen. Inténtalo de nuevo o usa texto.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno procesando la imagen' });
    }
};

// ==========================================
// 🔥 CRUD NUTRICIÓN (REMASTERIZADO Y ATÓMICO) 🔥
// ==========================================

const getNutritionLog = async (req, res) => {
    try {
        const today = getTodayStr();
        const log = await NutritionLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            {
                $setOnInsert: {
                    user: req.user._id,
                    date: today,
                    meals: [
                        { name: 'DESAYUNO', foods: [] },
                        { name: 'SNACK', foods: [] },
                        { name: 'COMIDA', foods: [] },
                        { name: 'MERIENDA', foods: [] },
                        { name: 'CENA', foods: [] }
                    ],
                    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0
                }
            },
            { new: true, upsert: true }
        );
        res.json(log);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando nutrición' });
    }
};

const addMealCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const today = getTodayStr();
        const log = await NutritionLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            { $push: { meals: { name: name.toUpperCase(), foods: [] } } },
            { new: true }
        );
        res.json(log);
    } catch (error) { res.status(500).json({ message: 'Error creando categoría' }); }
};

// 🟢 FIX: AÑADIR ALIMENTO DE FORMA 100% ATÓMICA
const addFoodToLog = async (req, res) => {
    try {
        const { mealId } = req.params;
        const { name, calories, protein, carbs, fat, fiber, quantity } = req.body;
        const today = getTodayStr();

        const newFood = {
            name,
            calories: Number(calories),
            protein: Number(protein || 0),
            carbs: Number(carbs || 0),
            fat: Number(fat || 0),
            fiber: Number(fiber || 0),
            quantity: Number(quantity || 1)
        };

        // Operación atómica de MongoDB: Push al array e incremento de totales matemáticos EN UN SOLO PASO.
        const log = await NutritionLog.findOneAndUpdate(
            { user: req.user._id, date: today, "meals._id": mealId },
            {
                $push: { "meals.$.foods": newFood },
                $inc: {
                    totalCalories: newFood.calories,
                    totalProtein: newFood.protein,
                    totalCarbs: newFood.carbs,
                    totalFat: newFood.fat,
                    totalFiber: newFood.fiber
                }
            },
            { new: true }
        );

        if (!log) return res.status(404).json({ message: 'Registro o categoría no encontrada' });

        // Sincronizamos el DailyLog también atómicamente
        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            { $set: { "nutrition.totalKcal": log.totalCalories } }
        );

        res.json(log);
    } catch (error) {
        console.error("Error addFoodToLog:", error);
        res.status(500).json({ message: 'Error guardando alimento' });
    }
};

// 🟢 FIX: ELIMINAR ALIMENTO DE FORMA 100% ATÓMICA
const removeFoodFromLog = async (req, res) => {
    try {
        const { mealId, foodItemId } = req.params;
        const today = getTodayStr();

        // 1. Buscamos usando proyecciones (muy rápido) SOLO para saber cuánto restarle a los totales
        const logData = await NutritionLog.findOne(
            { user: req.user._id, date: today, "meals.foods._id": foodItemId },
            { "meals.$": 1 }
        ).lean();

        if (!logData) return res.status(404).json({ message: 'Alimento no encontrado' });

        const meal = logData.meals[0];
        const foodItem = meal.foods.find(f => f._id.toString() === foodItemId);

        // 2. Operación Atómica Inversa ($pull para sacar del array, $inc negativo para matemáticas)
        const updatedLog = await NutritionLog.findOneAndUpdate(
            { user: req.user._id, date: today, "meals._id": mealId },
            {
                $pull: { "meals.$.foods": { _id: foodItemId } },
                $inc: {
                    totalCalories: -Math.abs(foodItem.calories),
                    totalProtein: -Math.abs(foodItem.protein),
                    totalCarbs: -Math.abs(foodItem.carbs),
                    totalFat: -Math.abs(foodItem.fat),
                    totalFiber: -Math.abs(foodItem.fiber)
                }
            },
            { new: true }
        );

        // Sincronizamos el DailyLog
        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            { $set: { "nutrition.totalKcal": Math.max(0, updatedLog.totalCalories) } }
        );

        res.json(updatedLog);
    } catch (error) {
        console.error("Error removeFoodFromLog:", error);
        res.status(500).json({ message: 'Error eliminando alimento' });
    }
};

const searchFoods = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);
        const foods = await Food.find({
            name: { $regex: query, $options: 'i' },
            $or: [{ user: req.user._id }, { user: null }, { user: { $exists: false } }]
        }).limit(20);
        res.json(foods);
    } catch (error) { res.status(500).json({ message: 'Error en búsqueda' }); }
};

const getSavedFoods = async (req, res) => {
    try {
        const foods = await Food.find({ user: req.user._id }).sort({ _id: -1 }).limit(50);
        res.json(foods);
    } catch (error) { res.status(500).json({ message: 'Error cargando lista' }); }
};

const saveCustomFood = async (req, res) => {
    try {
        const { name, calories, protein, carbs, fat, fiber, servingSize, folder } = req.body;

        const newFood = await Food.create({
            user: req.user._id,
            name,
            calories,
            protein,
            carbs,
            fat,
            fiber: fiber || 0,
            servingSize: servingSize || '1 ración',
            icon: '🍽️',
            folder: folder || 'General'
        });
        res.status(201).json(newFood);
    } catch (error) { res.status(500).json({ message: 'Error guardando comida' }); }
};

const deleteSavedFood = async (req, res) => {
    try {
        await Food.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        res.json({ message: 'Eliminado' });
    } catch (error) { res.status(500).json({ message: 'Error eliminando' }); }
};

const updateSavedFood = async (req, res) => {
    try {
        const updated = await Food.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
        res.json(updated);
    } catch (error) { res.status(500).json({ message: 'Error actualizando' }); }
};

const seedFoods = async (req, res) => { res.json({ message: 'Seed desactivado' }); };
const addFoodEntry = async (req, res) => { res.status(404).json({ message: "Usar addFoodToLog (/log/:id)" }); };

module.exports = {
    getNutritionLog, addMealCategory, seedFoods,
    analyzeImage, getSavedFoods, saveCustomFood, deleteSavedFood,
    updateSavedFood, chatMacroCalculator,
    addFoodToLog, searchFoods, addFoodEntry,
    analyzeFoodText,
    removeFoodFromLog
};