const OpenAI = require('openai');

/**
 * SERVICIO ÚNICO DE IA
 *
 * Antes cada feature tenía su propia cascada de modelos (había 4 listas
 * distintas), su propio `fetchWithTimeout` duplicado con timeouts diferentes
 * (5 s en gym, 8 s en comida) y su propia forma de limpiar el JSON. Resultado:
 * unas funciones aguantaban caídas y otras no, y era imposible saber qué modelo
 * usaba cada cosa.
 *
 * Aquí queda todo centralizado: una sola cascada, un solo timeout, una sola
 * limpieza de JSON y un único sitio donde cambiar de modelo el día que
 * OpenRouter retire alguno.
 */

/**
 * ⚠️ El cliente se crea a la PRIMERA petición, no al importar el módulo.
 *
 * Antes se instanciaba aquí arriba, y el constructor de OpenAI LANZA si falta la
 * clave. Como este servicio lo importa gymController y ese a su vez lo importa
 * server.js, quedarse sin OPENROUTER_API_KEY no dejaba la app "sin IA": impedía
 * que arrancara el servidor ENTERO. Ahora, sin clave, solo fallan las funciones
 * de IA y cada una ya tiene su plan B determinista.
 */
let clienteIA = null;
const getClienteIA = () => {
    if (!process.env.OPENROUTER_API_KEY) return null;
    if (!clienteIA) {
        clienteIA = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'https://kairos.app',
                'X-Title': 'Kairos'
            }
        });
    }
    return clienteIA;
};

/**
 * ⚠️ MODELOS VERIFICADOS EN VIVO CONTRA OPENROUTER.
 *
 * Los que usaba la app (gemini-2.0-flash-exp:free, llama-3.3-70b:free,
 * deepseek-r1-distill:free, mistral-7b:free, qwen-2.5-vl:free...) **ya no
 * existen o dejaron de ser gratuitos**: OpenRouter devolvía 404 en TODOS, así
 * que la IA de la app llevaba tiempo sin funcionar y siempre caía al plan B.
 *
 * Estos están probados uno a uno (respuesta correcta y tiempo medido).
 * El último de cada lista es `openrouter/free`, un enrutador automático que
 * elige por su cuenta un modelo gratis disponible: es la red de seguridad para
 * que esto no se vuelva a romper cuando retiren alguno de los otros.
 */
const TEXT_MODELS = [
    'nvidia/nemotron-3-super-120b-a12b:free', // ~1,4 s, el más rápido
    'openai/gpt-oss-20b:free',                // ~4 s, muy fiable siguiendo formato
    'openrouter/free'                         // comodín automático
];

const VISION_MODELS = [
    'nvidia/nemotron-nano-12b-v2-vl:free',    // ~1 s
    'google/gemma-4-26b-a4b-it:free',         // ~8 s
    'openrouter/free'                         // comodín automático
];

const DEFAULT_TEXT_TIMEOUT = 9000;
const DEFAULT_VISION_TIMEOUT = 15000;

// Aborta la petición si el modelo tarda demasiado, para pasar al siguiente
// en vez de dejar al usuario esperando indefinidamente.
const callWithTimeout = async (config, timeoutMs) => {
    const cliente = getClienteIA();
    // Sin clave configurada no hay IA: se avisa y cada función usa su plan B
    if (!cliente) throw new Error('IA no configurada (falta OPENROUTER_API_KEY)');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await cliente.chat.completions.create(config, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Extrae un objeto JSON de la respuesta del modelo.
 * Los modelos suelen envolverlo en ```json ... ``` o añadir texto antes/después,
 * así que recortamos desde la primera llave hasta la última.
 */
const parseJsonResponse = (raw) => {
    if (!raw) return null;
    let content = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    try {
        return JSON.parse(content.substring(first, last + 1));
    } catch {
        return null;
    }
};

/**
 * Recorre la cascada de modelos hasta que uno responde algo válido.
 * NUNCA lanza: devuelve { ok:false } para que quien llama aplique su plan B.
 *
 * @returns {Promise<{ok: boolean, data: any, text: string, model: string|null}>}
 */
const runCascade = async ({ models, buildConfig, timeout, validate, expectJson }) => {
    for (const model of models) {
        try {
            const completion = await callWithTimeout(buildConfig(model), timeout);
            const text = completion?.choices?.[0]?.message?.content;
            if (!text) continue;

            if (!expectJson) return { ok: true, data: null, text, model };

            const data = parseJsonResponse(text);
            if (!data) {
                console.warn(`⚠️ ${model} devolvió algo que no es JSON válido. Siguiente...`);
                continue;
            }
            if (validate && !validate(data)) {
                console.warn(`⚠️ ${model} devolvió JSON incompleto. Siguiente...`);
                continue;
            }
            return { ok: true, data, text, model };
        } catch (error) {
            console.warn(`❌ ${model} falló (${error.message}). Siguiente...`);
        }
    }
    console.error('🛑 Toda la cascada de IA falló; se usará el plan B.');
    return { ok: false, data: null, text: '', model: null };
};

/**
 * Pregunta de texto.
 * @param {string} system      Instrucciones del sistema
 * @param {Array}  messages    Historial opcional [{role, content}]
 * @param {boolean} json       Si se espera respuesta JSON (por defecto true)
 * @param {Function} validate  Comprobación extra del JSON recibido
 */
const askAI = async ({ system, messages = [], json = true, temperature = 0.2, timeout = DEFAULT_TEXT_TIMEOUT, validate } = {}) => {
    const baseMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

    return runCascade({
        models: TEXT_MODELS,
        timeout,
        expectJson: json,
        validate,
        buildConfig: (model) => ({
            model,
            messages: baseMessages,
            temperature,
            ...(json ? { response_format: { type: 'json_object' } } : {})
        })
    });
};

/**
 * Pregunta con imagen (análisis de fotos de comida / etiquetas).
 * @param {string} prompt      Qué debe hacer con la imagen
 * @param {string} imageDataUrl  "data:image/jpeg;base64,...."
 */
const askVisionAI = async ({ prompt, imageDataUrl, timeout = DEFAULT_VISION_TIMEOUT, validate } = {}) => {
    return runCascade({
        models: VISION_MODELS,
        timeout,
        expectJson: true,
        validate,
        buildConfig: (model) => ({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: imageDataUrl } }
                ]
            }],
            temperature: 0.1
        })
    });
};

module.exports = { askAI, askVisionAI, parseJsonResponse, TEXT_MODELS, VISION_MODELS };
