import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, vi } from 'vitest';

import CancionDelPost from './CancionDelPost';
import { cambiarSonido } from '../../utils/sonidoDelFeed';

/**
 * LA CANCION DE UNA PUBLICACION
 *
 * ⚠️ ESTAS PRUEBAS NACEN DE UN FALLO QUE ENCONTRO EL USUARIO USANDO LA APP.
 *
 * Salias de Kairos viendo una publicacion con musica y LA MUSICA SEGUIA
 * SONANDO. Ninguna de las tres formas de parar se disparaba: el componente no
 * se desmonta, la tarjeta no se sale de la pantalla (no has hecho scroll) y no
 * arranca ninguna otra. Solo se callaba matando la app a mano.
 *
 * Se prueba con dobles de `Audio` y de `IntersectionObserver` porque jsdom no
 * trae ninguno de los dos. Lo que se comprueba no es que "suene" —eso no se
 * puede— sino que se llame a `pause()` y a `play()` cuando toca, que es
 * exactamente donde estaba el fallo.
 */

// --- DOBLES DEL NAVEGADOR ---
const reproductores = [];

class AudioFalso {
    constructor(src) {
        this.src = src;
        this.currentTime = 0;
        this.volume = 1;
        this.loop = false;
        this.pausas = 0;
        this.reproducciones = 0;
        reproductores.push(this);
    }
    play() { this.reproducciones++; return Promise.resolve(); }
    pause() { this.pausas++; }
}

let observadores = [];

class ObservadorFalso {
    constructor(cb) { this.cb = cb; observadores.push(this); }
    observe(nodo) { this.nodo = nodo; }
    disconnect() { observadores = observadores.filter(o => o !== this); }
    /** Simula que la tarjeta entra o sale de la pantalla. */
    ver(ratio) { this.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
}

const CANCION = {
    id: '1', titulo: 'Eye of the Tiger', artista: 'Survivor',
    caratula: 'https://is1-ssl.mzstatic.com/x.jpg',
    preview: 'https://audio-ssl.itunes.apple.com/x.m4a',
    desde: 12
};

/** Pone la tarjeta a la vista, que es cuando arranca. */
const entraEnPantalla = async () => {
    await act(async () => { observadores.forEach(o => o.ver(1)); });
};

const salirDeLaApp = async () => {
    await act(async () => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

const volverALaApp = async () => {
    await act(async () => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

beforeEach(() => {
    reproductores.length = 0;
    observadores = [];
    vi.stubGlobal('Audio', AudioFalso);
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    localStorage.clear();
    cambiarSonido(false);
});

afterEach(() => {
    cambiarSonido(false);
    vi.unstubAllGlobals();
});

describe('EL FALLO: salir de la app tiene que callar la música', () => {

    test('al salir de la app se pausa', async () => {
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();

        const sonando = reproductores.at(-1);
        expect(sonando.reproducciones).toBe(1);
        expect(sonando.pausas).toBe(0);

        await salirDeLaApp();

        expect(sonando.pausas).toBe(1);
    });

    test('y al volver, retoma DONDE IBA', async () => {
        // Se pausa en vez de cortar: si vuelves a los diez segundos no quieres
        // que empiece otra vez desde el principio.
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();

        const sonando = reproductores.at(-1);
        sonando.currentTime = 20;   // como si llevara ocho segundos sonando

        await salirDeLaApp();
        await volverALaApp();

        expect(sonando.currentTime).toBe(20);
        expect(reproductores).toHaveLength(1);   // no se ha creado otro
        expect(sonando.reproducciones).toBe(2);
    });

    test('al volver NO suena si mientras tanto lo silenciaste', async () => {
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();
        const sonando = reproductores.at(-1);

        await salirDeLaApp();
        act(() => { cambiarSonido(false); });
        await volverALaApp();

        // El silencio manda: 1 del arranque y ninguna mas
        expect(sonando.reproducciones).toBe(1);
    });

    test('al volver NO suena si ya no estás en esa publicación', async () => {
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();
        const sonando = reproductores.at(-1);

        await salirDeLaApp();
        // Mientras estabas fuera, la tarjeta dejó de estar a la vista
        await act(async () => { observadores.forEach(o => o.ver(0)); });
        await volverALaApp();

        expect(sonando.reproducciones).toBe(1);
    });
});

describe('El interruptor del sonido', () => {

    test('empieza silenciado y no suena sola', async () => {
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();

        expect(reproductores).toHaveLength(0);
        expect(screen.getByText('Toca para escucharla')).toBeTruthy();
    });

    test('al encenderlo arranca por el trozo elegido', async () => {
        const user = userEvent.setup();
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();

        await user.click(screen.getByLabelText('Activar el sonido del feed'));

        const sonando = reproductores.at(-1);
        expect(sonando.currentTime).toBe(12);
        expect(sonando.loop).toBe(false);   // el bucle se hace a mano
    });

    test('silenciar corta del todo', async () => {
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();
        const sonando = reproductores.at(-1);

        act(() => { cambiarSonido(false); });

        expect(sonando.pausas).toBe(1);
    });
});

describe('Al pasar de largo', () => {

    test('salir de la pantalla corta la canción', async () => {
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);
        await entraEnPantalla();
        const sonando = reproductores.at(-1);

        await act(async () => { observadores.forEach(o => o.ver(0)); });

        expect(sonando.pausas).toBe(1);
    });

    test('verse a medias no basta para arrancar', async () => {
        // Con menos de la mitad visible, bajando rápido se disparaban y se
        // cortaban cinco canciones seguidas y sonaba a avería.
        cambiarSonido(true);
        render(<CancionDelPost cancion={CANCION} />);

        await act(async () => { observadores.forEach(o => o.ver(0.3)); });

        expect(reproductores).toHaveLength(0);
    });
});

describe('Sin canción no hay reproductor', () => {

    test('una publicación sin música no pinta nada', () => {
        const { container } = render(<CancionDelPost cancion={null} />);
        expect(container.firstChild).toBeNull();
    });

    test('ni una con los datos a medias', () => {
        const { container } = render(<CancionDelPost cancion={{ titulo: 'Sin preview' }} />);
        expect(container.firstChild).toBeNull();
    });
});
