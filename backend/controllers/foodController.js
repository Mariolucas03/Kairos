const Food = require('../models/Food');
const NutritionLog = require('../models/NutritionLog');
const DailyLog = require('../models/DailyLog');
const fs = require('fs');

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

const getTodayStr = () => new Date().toISOString().split('T')[0];

// ==========================================
// 🧠 CÁLCULO MATEMÁTICO LOCAL (PLAN Z)
// ==========================================
const calculateLocalMacros = (text) => {
    console.log("⚠️ IAs caídas. Usando Plan Z (Matemático)...");
    return null;
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
            const completion = await openrouter.chat.completions.create({
                model: model,
                messages: messages,
                temperature: 0.5,
                response_format: { type: "json_object" }
            });
            let content = completion.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonResponse = JSON.parse(content);
            return res.json(jsonResponse);
        } catch (error) {
            console.error(`❌ Falló ${model}: ${error.message}`);
        }
    }
    return res.json({ type: 'question', message: "No pude procesar los datos." });
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
        "fiber": 0
    }
    `;

    for (const model of TEXT_MODELS_CASCADE) {
        try {
            console.log(`🤖 Analizando comida con: ${model}...`);

            const completion = await openrouter.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

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
            console.error(`❌ Falló ${model}: ${error.message}. Probando siguiente...`);
        }
    }

    return res.status(500).json({ message: "No se pudo calcular. Intenta ponerlo manual." });
};

// ==========================================
// 📷 ANÁLISIS DE IMAGEN (MEGA CASCADA)
// ==========================================
const analyzeImage = async (req, res) => {
    // 🔥 LISTA MASIVA DE MODELOS DE VISIÓN (Prioridad: Calidad -> Velocidad)
    // Si uno falla, pasa al siguiente. Es casi imposible que fallen todos.
    const VISION_MODELS = [
        "google/gemini-2.0-flash-exp:free",           // Top tier
        "google/gemini-2.0-pro-exp-02-05:free",       // Experimental potente
        "qwen/qwen-2.5-vl-72b-instruct:free",         // Excelente open source
        "meta-llama/llama-3.2-90b-vision-instruct:free", // Llama Vision Grande
        "meta-llama/llama-3.2-11b-vision-instruct:free", // Llama Vision Rápida
        "mistralai/pixtral-12b:free",                 // Mistral Vision
        "microsoft/phi-3.5-vision-instruct:free",     // Microsoft Vision
        "google/gemini-flash-1.5-8b:free"             // Gemini Ligero
    ];

    try {
        if (!req.file) return res.status(400).json({ message: 'No hay imagen' });

        const userContext = req.body.context || "Sin contexto extra.";
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
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

                const completion = await openrouter.chat.completions.create({
                    model: modelName,
                    messages: [
                        { role: "user", content: [{ type: "text", text: finalPrompt }, { type: "image_url", image_url: { url: base64Image } }] }
                    ],
                    temperature: 0.1
                });

                let text = completion.choices[0].message.content;
                const startIndex = text.indexOf('{');
                const endIndex = text.lastIndexOf('}');

                if (startIndex !== -1 && endIndex !== -1) {
                    const jsonStr = text.substring(startIndex, endIndex + 1);
                    foodData = JSON.parse(jsonStr);

                    // Validación simple para saber si la IA funcionó
                    if (foodData.name && (typeof foodData.calories === 'number')) {
                        console.log(`✅ ÉXITO con ${modelName}`);
                        break; // Salimos del bucle si encontramos datos válidos
                    }
                }
            } catch (e) {
                console.error(`❌ Falló visión ${modelName}: ${e.message}`);
            }
        }

        // Borramos la imagen temporal del servidor
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (foodData) {
            // Aseguramos enteros
            foodData.calories = Math.round(foodData.calories || 0);
            foodData.protein = Math.round(foodData.protein || 0);
            foodData.carbs = Math.round(foodData.carbs || 0);
            foodData.fat = Math.round(foodData.fat || 0);
            foodData.fiber = Math.round(foodData.fiber || 0);

            return res.json(foodData);
        } else {
            return res.status(503).json({ message: 'Ninguna IA pudo leer la imagen. Inténtalo de nuevo.' });
        }
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Error interno imagen' });
    }
};

// ==========================================
// 🔥 CRUD NUTRICIÓN COMPLETO 🔥
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

const addFoodToLog = async (req, res) => {
    try {
        const { mealId } = req.params;
        const { name, calories, protein, carbs, fat, fiber, quantity } = req.body;
        const today = getTodayStr();

        let log = await NutritionLog.findOne({ user: req.user._id, date: today });
        if (!log) return res.status(404).json({ message: 'Registro no encontrado' });

        const meal = log.meals.id(mealId);
        if (!meal) return res.status(404).json({ message: 'Comida no encontrada' });

        const newFood = {
            name,
            calories: Number(calories),
            protein: Number(protein || 0),
            carbs: Number(carbs || 0),
            fat: Number(fat || 0),
            fiber: Number(fiber || 0),
            quantity: Number(quantity || 1)
        };

        meal.foods.push(newFood);

        log.totalCalories = Math.round(log.totalCalories + newFood.calories);
        log.totalProtein = Math.round(log.totalProtein + newFood.protein);
        log.totalCarbs = Math.round(log.totalCarbs + newFood.carbs);
        log.totalFat = Math.round(log.totalFat + newFood.fat);
        log.totalFiber = Math.round(log.totalFiber + newFood.fiber);

        await log.save();

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
        const { name, calories, protein, carbs, fat, fiber, servingSize } = req.body;
        const newFood = await Food.create({
            user: req.user._id,
            name, calories, protein, carbs, fat, fiber: fiber || 0, servingSize: servingSize || '1 ración', icon: '🍽️'
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
    analyzeFoodText
};