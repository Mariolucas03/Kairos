import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const { mismaClave } = await import('./pushNotifications');

/**
 * LA AVERIA SILENCIOSA DEL PUSH.
 *
 * El navegador se suscribe con una clave publica y el servidor firma con la
 * privada. Si no son pareja no salta ningun error en ningun sitio: la
 * suscripcion se crea, se guarda, el boton dice "activadas"... y no llega
 * nada, nunca. El fallo ocurre en los servidores de Apple o Google.
 *
 * Por eso el movil ahora pide la clave al servidor y comprueba que la
 * suscripcion que ya tenia se hizo con esa misma. Si no, la rehace. Estas
 * pruebas cubren esa comparacion, que es lo unico que separa "funciona" de
 * "movil mudo para siempre".
 */

// Dos claves VAPID reales, con la misma pinta y distintas.
const CLAVE_A = 'BHuNNV8fKxiIeIuObGJTavYPhf1G1Kpj4LN1TTCnaowLlmEJH6edktAmF0CcU5sZhpQZ5JxqzIK0qQ5sVSwmCuQ';
const CLAVE_B = 'BK8rL2mQxvTnY4pZc7hJd1WsE6gFaU3oI9bN0kMvR5tXyC2eH8jD4lP7qS1zA6wG3uV9nB0fK5rT2mY8xJcQdLs';

/** Convierte la clave en el ArrayBuffer que devuelve el navegador. */
const comoLaGuardaElNavegador = (clave) => {
    const relleno = '='.repeat((4 - clave.length % 4) % 4);
    const base64 = (clave + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(base64);
    const bytes = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return bytes.buffer;
};

const suscripcionCon = (clave) => ({ options: { applicationServerKey: comoLaGuardaElNavegador(clave) } });

describe('¿la suscripción del móvil se hizo con la clave del servidor?', () => {
    it('la misma clave se reconoce', () => {
        expect(mismaClave(suscripcionCon(CLAVE_A), CLAVE_A)).toBe(true);
    });

    it('una clave distinta se detecta: esa suscripción hay que rehacerla', () => {
        expect(mismaClave(suscripcionCon(CLAVE_A), CLAVE_B)).toBe(false);
    });

    it('ante la duda no se toca: si el navegador no dice con qué clave se hizo, se deja', () => {
        // Los navegadores viejos no exponen `options`. Tirar una suscripción
        // que a lo mejor funciona es peor que dejarla.
        expect(mismaClave({}, CLAVE_A)).toBe(true);
        expect(mismaClave({ options: {} }, CLAVE_A)).toBe(true);
        expect(mismaClave(null, CLAVE_A)).toBe(true);
    });

    it('sin clave del servidor tampoco se toca nada', () => {
        expect(mismaClave(suscripcionCon(CLAVE_A), '')).toBe(true);
    });

    it('una clave corrupta no revienta la app', () => {
        expect(() => mismaClave(suscripcionCon(CLAVE_A), '!!!no-es-base64!!!')).not.toThrow();
    });
});
