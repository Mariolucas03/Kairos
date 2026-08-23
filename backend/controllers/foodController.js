const Food = require('../models/Food');
const NutritionLog = require('../models/NutritionLog');
const DailyLog = require('../models/DailyLog');
// Importamos el helper de fecha local (¡Asegúrate de que el archivo utils/dateHelpers.js exista!)
const { getTodayDateString } = require('../utils/dateHelpers');

// 🔥 Toda la IA pasa por el servicio único (una sola cascada de modelos gratis)
const { askAI, askVisionAI } = require('../services/aiService');

// Usamos el helper centralizado en lugar del toISOString() que falla por zona horaria
const getTodayStr = () => getTodayDateString();

// 🔥 Escapa caracteres especiales de regex para evitar ReDoS / patrones inesperados
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ==========================================
// 🍽️ HELPERS DE MACROS
// ==========================================

// Redondea y rellena huecos: los modelos a veces omiten campos o mandan decimales
const normalizeMacros = (data, fallbackName = 'Comida') => ({
    name: data.name || fallbackName.slice(0, 60),
    calories: Math.max(0, Math.round(data.calories || 0)),
    protein: Math.max(0, Math.round(data.protein || 0)),
    carbs: Math.max(0, Math.round(data.carbs || 0)),
    fat: Math.max(0, Math.round(data.fat || 0)),
    fiber: Math.max(0, Math.round(data.fiber || 0)),
    ...(data.servingSize ? { servingSize: data.servingSize } : {})
});

/**
 * Plan B cuando la IA no responde: estimación de una ración media.
 * No pretende ser exacta —el usuario la edita— pero permite seguir
 * registrando comida en vez de bloquear la pantalla con un error.
 */
const estimateFoodFallback = (text = '') => {
    const t = text.toLowerCase();
    // Perfil aproximado por tipo de plato más habitual
    const perfiles = [
        { claves: ['ensalada', 'verdura', 'lechuga', 'brocoli', 'brócoli'], kcal: 150, p: 5, c: 15, g: 7 },
        { claves: ['pollo', 'pavo', 'pescado', 'merluza', 'atun', 'atún', 'ternera', 'carne', 'huevo'], kcal: 350, p: 35, c: 5, g: 18 },
        { claves: ['pasta', 'arroz', 'patata', 'pan', 'pizza', 'bocadillo', 'macarrones'], kcal: 500, p: 15, c: 70, g: 15 },
        { claves: ['fruta', 'manzana', 'platano', 'plátano', 'naranja', 'yogur'], kcal: 120, p: 3, c: 25, g: 1 },
        { claves: ['dulce', 'chocolate', 'tarta', 'helado', 'galleta'], kcal: 400, p: 5, c: 50, g: 20 }
    ];
    const perfil = perfiles.find(p => p.claves.some(k => t.includes(k)));
    const base = perfil || { kcal: 400, p: 20, c: 40, g: 15 };

    return {
        name: text.trim().slice(0, 60) || 'Comida',
        calories: base.kcal,
        protein: base.p,
        carbs: base.c,
        fat: base.g,
        fiber: 3,
        isEstimate: true
    };
};

// ==========================================
// 🤖 CALCULADORA NUTRICIONISTA (CHAT PERFIL)
// ==========================================
const chatMacroCalculator = async (req, res) => {
    const { history } = req.body;

    const SYSTEM_PROMPT = `
    Actúa como un nutricionista experto. Extrae edad, peso, altura, género y objetivo.
    REGLAS:
    1. Si tienes TODOS los datos: Calcula TDEE, ajusta según objetivo, distribuye macros (30/40/30).
       Devuelve JSON: { "type": "final", "data": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "message": "Resumen..." } }
    2. Si FALTA dato: Devuelve JSON: { "type": "question", "message": "Pregunta qué falta..." }
    FORMATO JSON PURO SIN MARKDOWN.
    `;

    const result = await askAI({
        system: SYSTEM_PROMPT,
        messages: Array.isArray(history) ? history : [],
        temperature: 0.5,
        validate: (d) => d.type === 'final' || d.type === 'question'
    });

    if (result.ok) return res.json(result.data);

    return res.json({ type: 'question', message: "No pude procesar los datos por alta demanda. Intenta en unos minutos." });
};

// ==========================================
// 🪄 ANALIZAR TEXTO DE COMIDA (CASCADA IA)
// ==========================================
const analyzeFoodText = async (req, res) => {
    // ⚠️ El texto se mete DENTRO del prompt y no tenia limite de tamano. Con un
    // cuerpo de peticion de hasta 1 MB, cada llamada podia costar una fortuna en
    // tokens de la cuenta del duenno de la app. Una descripcion de comida no
    // necesita mas de 300 caracteres.
    const text = String(req.body.text || '').trim().slice(0, 300);

    if (!text) return res.status(400).json({ message: 'Escribe qué has comido' });

    const SYSTEM_PROMPT = `
    Eres un experto nutricionista y analista de alimentos.
    Analiza lo que ha comido el usuario: "${text}".

    Calcula las calorías y macronutrientes (proteína, carbohidratos, grasa, fibra)
    del TOTAL de lo descrito. Si menciona cantidades ("200g de pollo", "2 huevos",
    "un plato de pasta"), respétalas y súmalas todas. Si no dice cantidad, asume
    una ración estándar de esa comida.

    ⚠️ REGLAS CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido. Nada de texto extra.
    2. Números enteros, sin decimales ni unidades.
    3. Las calorías deben cuadrar con los macros: proteína×4 + carbohidratos×4 + grasa×9.
    4. Formato exacto:
    {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "fiber": 0,
        "name": "Nombre corto y claro del plato"
    }
    `;

    const result = await askAI({
        system: SYSTEM_PROMPT,
        temperature: 0.1,
        // Se rechaza lo que no tenga sentido: cero calorías, cifras de delirio,
        // o macros que no cuadran ni de lejos con las calorías declaradas.
        // Antes valía cualquier número y por eso salían resultados absurdos.
        validate: (d) => {
            if (typeof d.calories !== 'number' || d.calories <= 0 || d.calories > 15000) return false;
            const porMacros = (Number(d.protein) || 0) * 4 + (Number(d.carbs) || 0) * 4 + (Number(d.fat) || 0) * 9;
            if (porMacros === 0) return true;   // sin macros, nos fiamos de las kcal
            const desvio = Math.abs(porMacros - d.calories) / d.calories;
            return desvio < 0.45;
        }
    });

    if (result.ok) {
        return res.json({ type: 'success', data: normalizeMacros(result.data, text) });
    }

    // 🔥 PLAN B: antes esto devolvía un 503 y el usuario se quedaba sin poder
    // registrar nada. Ahora damos una estimación aproximada y avisamos de que
    // es editable, para que la app siga siendo usable con la IA caída.
    return res.json({
        type: 'estimate',
        message: 'La IA no está disponible ahora mismo. Te dejo una estimación: revísala y ajústala.',
        data: estimateFoodFallback(text)
    });
};

// ==========================================
// 📷 ANÁLISIS DE IMAGEN (MEGA CASCADA EN RAM)
// ==========================================
const analyzeImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No hay imagen' });

        // Mismo motivo que en analyzeFoodText: esto acaba dentro del prompt.
        const userContext = String(req.body.context || "").trim().slice(0, 300) || "Sin contexto extra.";

        // Leemos directamente de la RAM (req.file.buffer), sin tocar disco
        const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const prompt = `
        Mira esta imagen. Contexto del usuario: "${userContext}".

        PRIMERO decide si en la imagen hay comida, bebida o una etiqueta nutricional.

        - Si NO la hay (una persona, un paisaje, una pantalla, un animal, un objeto...),
          responde SOLO:
          { "isFood": false, "sees": "qué se ve exactamente, en 3-6 palabras y en español" }

        - Si SÍ la hay, identifica el alimento y calcula sus macros totales
          aproximados, y responde SOLO:
          {
            "isFood": true,
            "name": "Nombre corto del plato",
            "calories": int,
            "protein": int,
            "carbs": int,
            "fat": int,
            "fiber": int,
            "servingSize": "string"
          }

        Nada de texto fuera del JSON.
        `;

        const result = await askVisionAI({
            prompt,
            imageDataUrl,
            // Vale tanto un "no es comida" bien formado como un análisis completo
            validate: (d) => d.isFood === false
                ? typeof d.sees === 'string'
                : (d.name && typeof d.calories === 'number')
        });

        if (result.ok && result.data.isFood === false) {
            // 422: la petición está bien, lo que no vale es la foto. El frontend
            // lo distingue del "la IA está caída" para poder explicar el porqué.
            return res.status(422).json({
                notFood: true,
                sees: result.data.sees,
                message: `Eso no parece comida: veo ${result.data.sees}. Prueba con una foto del plato, o descríbelo por texto.`
            });
        }

        if (result.ok) return res.json(normalizeMacros(result.data));

        // Con una foto no hay forma razonable de estimar sin IA, así que aquí sí
        // devolvemos error, pero indicando la alternativa que sí funciona.
        return res.status(503).json({
            aiDown: true,
            message: 'La IA no responde ahora mismo. Descríbelo por texto y lo calculo igual.'
        });
    } catch (error) {
        console.error('Error en analyzeImage:', error);
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
/**
 * Convierte a numero lo que llega del movil, o devuelve 0.
 *
 * ⚠️ Antes se hacia Number(calories) a pelo y el resultado iba directo a un
 * $inc de los totales del dia. Number('abc') es NaN, y $inc con NaN NO da
 * error: deja totalCalories en NaN para siempre, y a partir de ahi el resumen
 * del dia, las macros y el widget de comida no vuelven a mostrar un numero
 * nunca mas. Es el mismo fallo que ya se cerro en los juegos.
 *
 * El tope existe por lo mismo: un alimento de 10 millones de kcal no es un
 * alimento, y deja el dia igual de inservible.
 */
const numeroSeguro = (valor, maximo = 100000) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, maximo);
};

const addFoodToLog = async (req, res) => {
    try {
        const { mealId } = req.params;
        const { name, calories, protein, carbs, fat, fiber, quantity } = req.body;
        const today = getTodayStr();

        const nombre = String(name || '').trim().slice(0, 120);
        if (!nombre) return res.status(400).json({ message: 'El alimento necesita un nombre' });

        const newFood = {
            name: nombre,
            calories: numeroSeguro(calories),
            protein: numeroSeguro(protein, 5000),
            carbs: numeroSeguro(carbs, 5000),
            fat: numeroSeguro(fat, 5000),
            fiber: numeroSeguro(fiber, 5000),
            quantity: numeroSeguro(quantity, 1000) || 1
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
        const safeQuery = escapeRegex(query).slice(0, 100);
        const foods = await Food.find({
            name: { $regex: safeQuery, $options: 'i' },
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

        // Por el mismo filtro que el resto: lo que se guarda hoy es lo que se
        // sumara manana a los totales del dia.
        const newFood = await Food.create({
            user: req.user._id,
            name: String(name || '').trim().slice(0, 120),
            calories: numeroSeguro(calories),
            protein: numeroSeguro(protein, 5000),
            carbs: numeroSeguro(carbs, 5000),
            fat: numeroSeguro(fat, 5000),
            fiber: numeroSeguro(fiber, 5000),
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
        // ⚠️ Antes se pasaba req.body ENTERO al update. Eso deja al cliente
        // escribir cualquier campo del esquema, incluido `user`: mandando el id
        // de otra persona, el alimento cambiaba de dueno. Se escribe solo lo que
        // tiene sentido editar, y los numeros pasan por el mismo filtro que el
        // resto para no meter NaN en la ficha.
        const cambios = {};
        const { name, servingSize, folder, icon } = req.body;

        if (name !== undefined) cambios.name = String(name).trim().slice(0, 120);
        if (servingSize !== undefined) cambios.servingSize = String(servingSize).slice(0, 40);
        if (folder !== undefined) cambios.folder = String(folder).slice(0, 60);
        if (icon !== undefined) cambios.icon = String(icon).slice(0, 8);

        for (const campo of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
            if (req.body[campo] !== undefined) cambios[campo] = numeroSeguro(req.body[campo]);
        }

        if (Object.keys(cambios).length === 0) {
            return res.status(400).json({ message: 'Nada que actualizar' });
        }

        const updated = await Food.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { $set: cambios },
            { new: true }
        );

        if (!updated) return res.status(404).json({ message: 'Alimento no encontrado' });
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