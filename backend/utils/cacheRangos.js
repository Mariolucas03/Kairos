/**
 * CACHE CORTA DE LOS RANGOS MUSCULARES.
 *
 * Calcular los rangos de alguien es leer TODOS sus entrenos y el catalogo de
 * ejercicios y sumar kilo a kilo. Lo piden la pestaña Cuerpo, tu perfil, el
 * perfil publico, el ranking y la subida de rango: varias veces seguidas con
 * el mismo resultado. Se guarda unos segundos por usuario y se tira en
 * cuanto guarda un entreno nuevo (hook del modelo), asi que nunca se ve un
 * rango viejo despues de entrenar.
 */
const TTL_MS = 90 * 1000;
const cache = new Map();

const guardar = (clave, promesa) => {
    cache.set(clave, { t: Date.now(), promesa });
    // Si la promesa falla, no se cachea el fallo
    promesa.catch(() => cache.delete(clave));
    return promesa;
};

const recordar = (clave, calcular) => {
    const hit = cache.get(clave);
    if (hit && Date.now() - hit.t < TTL_MS) return hit.promesa;
    return guardar(clave, calcular());
};

const invalidar = (userId) => {
    const prefijo = String(userId) + ':';
    for (const k of cache.keys()) if (k.startsWith(prefijo)) cache.delete(k);
};

module.exports = { recordar, invalidar, TTL_MS };
