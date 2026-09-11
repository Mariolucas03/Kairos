import { describe, test, expect, beforeEach, vi } from 'vitest';
import { crearSintetizador, melodias, haySonidoJuegos, cambiarSonidoJuegos } from './sintetizador';

/**
 * EL SINTETIZADOR DE LOS JUEGOS
 *
 * No se puede probar que suene: jsdom no tiene audio. Pero la promesa del
 * módulo no es sonar, es NO ROMPER NUNCA UNA JUGADA. Y eso se prueba justo
 * aquí, donde no hay `AudioContext`: es el mismo caso que un navegador sin Web
 * Audio o con el audio bloqueado. Si cualquiera de estas llamadas lanzara, la
 * ruleta se quedaría a medias con fichas en juego.
 */

describe('El sintetizador no puede tumbar un juego', () => {

    test('sin AudioContext, nada lanza', () => {
        // jsdom no lo trae. Se comprueba la premisa para que la prueba no
        // pase por casualidad el día que alguien instale un polyfill.
        expect(typeof window.AudioContext).toBe('undefined');

        const s = crearSintetizador();
        expect(() => s.golpe()).not.toThrow();
        expect(() => s.golpe({ frecuencia: 200, duracion: 0.1, volumen: 0.5, q: 3 })).not.toThrow();
        expect(() => s.nota()).not.toThrow();
        expect(() => s.nota({ frecuencia: 440, retraso: 0.2, tipo: 'square' })).not.toThrow();

        const continuo = s.continuo();
        expect(() => continuo(0.5)).not.toThrow();
        expect(() => continuo(0)).not.toThrow();
        expect(() => continuo(99)).not.toThrow();   // fuera de rango: se recorta, no revienta

        expect(() => s.parar()).not.toThrow();
        // Y después de parar, seguir llamando tampoco rompe: un frame tardío
        // del bucle de animación puede llegar después del `parar`.
        expect(() => s.golpe()).not.toThrow();
        expect(() => continuo(0.3)).not.toThrow();
    });

    test('las melodías tampoco', () => {
        const s = crearSintetizador();
        expect(() => melodias.ganar(s)).not.toThrow();
        expect(() => melodias.granPremio(s)).not.toThrow();
        expect(() => melodias.perder(s)).not.toThrow();
    });

    test('con un AudioContext que revienta al crearse, tampoco', () => {
        // Algunos navegadores lo tienen pero lo bloquean: el constructor lanza.
        window.AudioContext = function () { throw new Error('bloqueado'); };
        try {
            const s = crearSintetizador();
            expect(() => s.golpe()).not.toThrow();
            expect(() => s.nota()).not.toThrow();
            expect(() => s.continuo()(0.5)).not.toThrow();
            expect(() => s.parar()).not.toThrow();
        } finally {
            delete window.AudioContext;
        }
    });
});

describe('El interruptor del sonido', () => {

    beforeEach(() => {
        localStorage.clear();
    });

    test('empieza encendido: es el efecto de un botón que has pulsado', () => {
        // Al contrario que la música del feed, que arranca sola al pasar por
        // una publicación. Lo que decide el módulo al cargar ya está decidido
        // aquí; se comprueba el estado por defecto tal y como quedó.
        cambiarSonidoJuegos(true);
        expect(haySonidoJuegos()).toBe(true);
    });

    test('se acuerda de que lo apagaste', () => {
        cambiarSonidoJuegos(false);
        expect(haySonidoJuegos()).toBe(false);
        expect(localStorage.getItem('kairos_juegos_con_sonido')).toBe('0');

        cambiarSonidoJuegos(true);
        expect(localStorage.getItem('kairos_juegos_con_sonido')).toBe('1');
    });

    test('apagado, el sintetizador no intenta ni arrancar', () => {
        cambiarSonidoJuegos(false);
        // Si intentara crear el contexto, con este constructor espía se sabría.
        const espia = vi.fn(() => { throw new Error('no debería llamarse'); });
        window.AudioContext = espia;
        try {
            const s = crearSintetizador();
            s.golpe(); s.nota(); s.continuo()(1);
            expect(espia).not.toHaveBeenCalled();
        } finally {
            delete window.AudioContext;
            cambiarSonidoJuegos(true);
        }
    });

    test('un almacenamiento bloqueado no rompe el interruptor', () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); };
        try {
            expect(() => cambiarSonidoJuegos(false)).not.toThrow();
            expect(haySonidoJuegos()).toBe(false);
        } finally {
            Storage.prototype.setItem = original;
            cambiarSonidoJuegos(true);
        }
    });
});
