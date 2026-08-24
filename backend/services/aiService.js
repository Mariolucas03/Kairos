const OpenAI = require('openai');
const SystemState = require('../models/SystemState');

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
 * limpieza de JSON y un único sitio donde cambiar de modelo el día que retiren
 * alguno.
 *
 * ── DOS PROVEEDORES, DOS CUOTAS ────────────────────────────────────────────
 *
 * Primero Google (Gemini) y después OpenRouter. No es capricho:
 *
 *  - Son cuotas gratuitas INDEPENDIENTES. Agotar la de uno no deja la app sin
 *    IA, que es justo lo que pasaba antes: al llegar al tope diario de los
 *    modelos `:free` de OpenRouter, TODO caía al plan B en silencio y las
 *    calorías empezaban a salir peores sin que nadie supiera por qué.
 *  - Gemini es mucho más rápido. Medido con el mismo trabajo real (analizar
 *    "un plato de pasta con tomate y 2 huevos fritos"): 652 ms contra los
 *    2.400 ms del mejor de OpenRouter. En fotos, ~1 s.
 *  - El tope diario del nivel gratuito de Google es bastante más holgado que el
 *    de los modelos `:free` de OpenRouter en una cuenta sin crédito.
 *
 * `gemini-flash-lite-latest` va primero a propósito: el alias `-latest` lo
 * mueve Google al modelo vigente. Esta app YA se quedó sin IA una vez porque
 * los modelos fijos que usaba desaparecieron y nadie se enteró (todo caía al
 * plan B). De hecho `gemini-2.5-flash-lite`, que parecía la opción obvia, hoy
 * devuelve 404.
 */

// ──────────────────────────────────────────────────────────────────────────
//  CASCADAS
// ──────────────────────────────────────────────────────────────────────────

const TEXT_CASCADE = [
    { proveedor: 'gemini', modelo: 'gemini-flash-lite-latest' },      // ~0,7 s
    { proveedor: 'gemini', modelo: 'gemini-3.1-flash-lite' },         // ~0,9 s
    { proveedor: 'openrouter', modelo: 'nvidia/nemotron-3-super-120b-a12b:free' },
    { proveedor: 'openrouter', modelo: 'openai/gpt-oss-20b:free' },
    { proveedor: 'openrouter', modelo: 'openrouter/free' }            // comodín automático
];

const VISION_CASCADE = [
    { proveedor: 'gemini', modelo: 'gemini-flash-lite-latest' },      // ~1,1 s
    { proveedor: 'gemini', modelo: 'gemini-3.1-flash-lite' },
    { proveedor: 'openrouter', modelo: 'nvidia/nemotron-nano-12b-v2-vl:free' },
    { proveedor: 'openrouter', modelo: 'google/gemma-4-26b-a4b-it:free' },
    { proveedor: 'openrouter', modelo: 'openrouter/free' }
];

// Gemini contesta por debajo del segundo y medio. Esperar nueve por cada intento
// hacía que, con la cascada entera cayendo, el usuario se comiera casi un minuto
// mirando una ruleta antes de ver el plan B.
const TIMEOUT_GEMINI = 6000;
const TIMEOUT_OPENROUTER = 9000;
const TIMEOUT_VISION_EXTRA = 6000;

// Tope del historial de chat. Lo manda el cliente entero, así que sin esto cada
// mensaje arrastra toda la conversación anterior a la cuota de IA.
const MAX_MENSAJES_HISTORIAL = 10;
const MAX_CARACTERES_MENSAJE = 800;

/**
 * TECHO DURO DE LLAMADAS AL DÍA (toda la app junta).
 *
 * Los dos proveedores son de nivel gratuito y ninguno puede cobrar sin que
 * alguien active la facturación a mano. Pero "no puede pasar" y "no va a pasar"
 * no son lo mismo cuando hay una tarjeta de por medio en algún sitio, así que
 * esto es la red de seguridad: pasado el tope, la app deja de llamar a la IA por
 * su cuenta y usa el plan B, que ya existe y funciona.
 *
 * No es por usuario, es el total del día. El límite por usuario (40 cada 15
 * minutos) evita que uno solo se lo coma todo; este evita que entre todos se
 * pase de la cuenta.
 *
 * Se cambia sin tocar código con la variable MAX_IA_DIA en Render.
 */
const MAX_LLAMADAS_DIA = Number(process.env.MAX_IA_DIA) || 300;

const claveDeHoy = () => {
    // Fecha en Madrid, igual que el resto de la app
    const f = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }).split('/');
    return 'ia-llamadas-' + f[2] + '-' + f[1] + '-' + f[0];
};

/**
 * Suma una llamada al contador del día y dice si se puede seguir.
 *
 * El contador vive en SystemState (la misma tabla que usa el mantenimiento
 * nocturno) y se incrementa de forma atómica, así que dos peticiones a la vez
 * no pueden colarse por encima del tope.
 */
const quedaCuota = async () => {
    try {
        const clave = claveDeHoy();
        const doc = await SystemState.findOneAndUpdate(
            { key: clave },
            { $inc: { contador: 1 }, $set: { updatedAt: new Date() } },
            { upsert: true, new: true }
        );

        const usadas = doc?.contador || 1;

        if (usadas === MAX_LLAMADAS_DIA + 1) {
            console.warn('🛑 Alcanzado el tope diario de IA (' + MAX_LLAMADAS_DIA + '). El resto del día se usa el plan B.');
        }

        return usadas <= MAX_LLAMADAS_DIA;
    } catch (error) {
        // Si el contador falla, NO se bloquea la IA: un fallo de la base no debe
        // apagar una función que si acaso costaria una llamada de mas.
        console.warn('No se pudo contar la llamada de IA:', error.message);
        return true;
    }
};

// ──────────────────────────────────────────────────────────────────────────
//  PROVEEDOR 1: GOOGLE (GEMINI)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Llama a Gemini por HTTP directo, sin librería.
 *
 * No hace falta dependencia nueva: es una petición POST con JSON. Añadir el SDK
 * de Google solo para esto son megas de node_modules y una cosa más que
 * mantener al día.
 */
const llamarGemini = async ({ modelo, system, messages, json, temperature, imageDataUrl, timeout }) => {
    const clave = process.env.GEMINI_API_KEY;
    if (!clave) throw new Error('Falta GEMINI_API_KEY');

    // Gemini usa 'model' donde OpenAI usa 'assistant'
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '').slice(0, MAX_CARACTERES_MENSAJE) }]
    }));

    if (imageDataUrl) {
        const [cabecera, base64] = String(imageDataUrl).split(',');
        const mime = (cabecera.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
        contents.push({ role: 'user', parts: [{ inline_data: { mime_type: mime, data: base64 } }] });
    }

    // Sin nada que decir no hay petición válida
    if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Responde.' }] });

    const cuerpo = {
        contents,
        generationConfig: {
            temperature,
            ...(json ? { responseMimeType: 'application/json' } : {})
        },
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {})
    };

    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), timeout);

    try {
        const respuesta = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo),
                signal: controller.signal
            }
        );

        if (!respuesta.ok) {
            const detalle = (await respuesta.text()).slice(0, 120);
            throw new Error('HTTP ' + respuesta.status + ' ' + detalle);
        }

        const datos = await respuesta.json();
        return datos?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    } finally {
        clearTimeout(temporizador);
    }
};

// ──────────────────────────────────────────────────────────────────────────
//  PROVEEDOR 2: OPENROUTER
// ──────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ El cliente se crea a la PRIMERA petición, no al importar el módulo.
 *
 * Antes se instanciaba arriba, y el constructor de OpenAI LANZA si falta la
 * clave. Como este servicio lo importa gymController y ese a su vez lo importa
 * server.js, quedarse sin OPENROUTER_API_KEY no dejaba la app "sin IA": impedía
 * que arrancara el servidor ENTERO.
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

const llamarOpenRouter = async ({ modelo, system, messages, json, temperature, imageDataUrl, timeout }) => {
    const cliente = getClienteIA();
    if (!cliente) throw new Error('Falta OPENROUTER_API_KEY');

    let mensajesFinales;

    if (imageDataUrl) {
        const textoPrompt = [system, ...messages.map(m => m.content)].filter(Boolean).join('\n');
        mensajesFinales = [{
            role: 'user',
            content: [
                { type: 'text', text: textoPrompt },
                { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
        }];
    } else {
        mensajesFinales = system ? [{ role: 'system', content: system }, ...messages] : messages;
    }

    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), timeout);

    try {
        const completion = await cliente.chat.completions.create({
            model: modelo,
            messages: mensajesFinales,
            temperature,
            ...(json && !imageDataUrl ? { response_format: { type: 'json_object' } } : {})
        }, { signal: controller.signal });

        return completion?.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(temporizador);
    }
};

const PROVEEDORES = { gemini: llamarGemini, openrouter: llamarOpenRouter };

// ──────────────────────────────────────────────────────────────────────────
//  CASCADA
// ──────────────────────────────────────────────────────────────────────────

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

/** Recorta el historial que llega del cliente antes de mandarlo a ninguna parte. */
const limpiarMensajes = (messages) => {
    if (!Array.isArray(messages)) return [];
    return messages
        .slice(-MAX_MENSAJES_HISTORIAL)
        .filter(m => m && typeof m.content === 'string' && m.content.trim())
        .map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim().slice(0, MAX_CARACTERES_MENSAJE)
        }));
};

/**
 * Recorre la cascada hasta que un modelo responde algo válido.
 * NUNCA lanza: devuelve { ok:false } para que quien llama aplique su plan B.
 */
const runCascade = async ({ cascada, system, messages, json, temperature, validate, imageDataUrl, extraTimeout = 0 }) => {
    if (!(await quedaCuota())) {
        return { ok: false, data: null, text: '', model: null, proveedor: null, sinCuota: true };
    }

    for (const { proveedor, modelo } of cascada) {
        const llamar = PROVEEDORES[proveedor];
        const timeout = (proveedor === 'gemini' ? TIMEOUT_GEMINI : TIMEOUT_OPENROUTER) + extraTimeout;

        try {
            const texto = await llamar({ modelo, system, messages, json, temperature, imageDataUrl, timeout });
            if (!texto) continue;

            if (!json) return { ok: true, data: null, text: texto, model: modelo, proveedor };

            const data = parseJsonResponse(texto);
            if (!data) {
                console.warn(`⚠️ ${proveedor}/${modelo} devolvió algo que no es JSON válido. Siguiente...`);
                continue;
            }
            if (validate && !validate(data)) {
                console.warn(`⚠️ ${proveedor}/${modelo} devolvió JSON incompleto. Siguiente...`);
                continue;
            }
            return { ok: true, data, text: texto, model: modelo, proveedor };
        } catch (error) {
            console.warn(`❌ ${proveedor}/${modelo} falló (${error.message}). Siguiente...`);
        }
    }

    console.error('🛑 Toda la cascada de IA falló; se usará el plan B.');
    return { ok: false, data: null, text: '', model: null, proveedor: null };
};

/**
 * Pregunta de texto.
 * @param {string} system      Instrucciones del sistema
 * @param {Array}  messages    Historial opcional [{role, content}]
 * @param {boolean} json       Si se espera respuesta JSON (por defecto true)
 * @param {Function} validate  Comprobación extra del JSON recibido
 */
const askAI = async ({ system, messages = [], json = true, temperature = 0.2, validate } = {}) =>
    runCascade({
        cascada: TEXT_CASCADE,
        system,
        messages: limpiarMensajes(messages),
        json,
        temperature,
        validate
    });

/**
 * Pregunta con imagen (análisis de fotos de comida / etiquetas).
 * @param {string} prompt        Qué debe hacer con la imagen
 * @param {string} imageDataUrl  "data:image/jpeg;base64,...."
 */
const askVisionAI = async ({ prompt, imageDataUrl, validate } = {}) =>
    runCascade({
        cascada: VISION_CASCADE,
        system: prompt,
        messages: [],
        json: true,
        temperature: 0.1,
        validate,
        imageDataUrl,
        extraTimeout: TIMEOUT_VISION_EXTRA
    });

module.exports = {
    askAI,
    askVisionAI,
    parseJsonResponse,
    TEXT_CASCADE,
    VISION_CASCADE,
    // Se mantienen los nombres viejos por si algo fuera los importaba
    TEXT_MODELS: TEXT_CASCADE.map(m => m.modelo),
    VISION_MODELS: VISION_CASCADE.map(m => m.modelo)
};
