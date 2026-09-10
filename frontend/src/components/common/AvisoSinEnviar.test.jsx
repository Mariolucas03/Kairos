import { render, screen, act } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

import AvisoSinEnviar from './AvisoSinEnviar';
import { encolar, vaciarCola } from '../../utils/colaEnvios';

/**
 * "TIENES COSAS SIN SUBIR"
 *
 * ⚠️ ESTE AVISO ES LO ÚNICO QUE TE DICE QUE TU ENTRENO SIGUE VIVO.
 *
 * Guardas un entreno en el sótano del gimnasio, se queda en la cola, y a partir
 * de ahí la única prueba de que no se ha perdido es esta pastilla. Si deja de
 * salir, el fallo no se ve: la app se comporta exactamente igual que si todo
 * hubiera subido bien, y el entreno desaparece sin que nadie se entere.
 *
 * Por eso se prueba entero y no solo la cola. `colaEnvios.test.js` ya comprueba
 * que lo pendiente se guarda y se reintenta; lo que falta es lo que ve el
 * usuario, que es otra cosa y puede romperse sola.
 *
 * ⚠️ LO MÁS FRÁGIL ES EL AVISO DE "YA ESTÁ SUBIDO".
 *
 * Vive en `useColaPendiente` y depende de mirar el número ANTERIOR: se enseña
 * cuando la cola pasa de tener algo a estar a cero. Un `useRef` mal llevado
 * ahí no da error, simplemente deja de cerrar el círculo, y el usuario se queda
 * con la duda que este aviso venía a quitarle.
 */

// La cola vive en localStorage; jsdom trae uno, pero conviene dejarlo limpio
// entre pruebas para que una no herede lo pendiente de la anterior.
beforeEach(() => {
    localStorage.clear();
    // Relojes falsos y NO `shouldAdvanceTime`: con el avance automatico, el
    // temporizador de 4 s del "ya esta subido" saltaba fuera de `act()` a mitad
    // de otra prueba y dejaba un aviso de React en cada tanda. Un aviso que sale
    // siempre acaba ensenando a no mirar los avisos.
    vi.useFakeTimers();
});

afterEach(() => {
    // Dentro de `act()` porque lo que queda pendiente es un `setSubidas(0)`:
    // vaciarlo es un cambio de estado como cualquier otro.
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const guardarAlgo = async (etiqueta = 'entreno', clienteId = 'a1') => {
    await act(async () => {
        encolar({
            ruta: '/gym/log',
            envio: { clienteId },
            etiqueta
        });
    });
};

describe('El aviso de lo que está sin subir', () => {

    test('con la cola vacía no se enseña nada', () => {
        const { container } = render(<AvisoSinEnviar />);
        // Un aviso permanente de "todo bien" es ruido: lo normal es que no haya
        // nada esperando, y eso no merece ocupar sitio encima del menú.
        // Sin jest-dom en el proyecto, se mira el HTML directamente: añadir una
        // dependencia entera para un `toBeEmptyDOMElement` no compensa.
        expect(container.innerHTML).toBe('');
    });

    test('un entreno esperando se dice POR SU NOMBRE', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo('entreno');

        // "1 entreno sin subir" tranquiliza; "1 cosa sin subir" no dice nada.
        expect(screen.getByText(/1 entreno sin subir/i)).toBeDefined();
    });

    test('dos clases de cosas se enumeran', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo('entreno', 'a1');
        await guardarAlgo('alimento', 'a2');

        expect(screen.getByText(/1 entreno y 1 alimento sin subir/i)).toBeDefined();
    });

    test('cuando la lista se hace larga se resume en una línea', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo('alimento', 'a1');
        await guardarAlgo('alimento', 'a2');
        await guardarAlgo('entreno', 'a3');
        await guardarAlgo('misión', 'a4');

        // En mayúsculas y a este tamaño, el detalle entero se partía en dos
        // líneas y la pastilla crecía hasta parecer un error.
        expect(screen.getByText(/4 cosas sin subir/i)).toBeDefined();
    });

    test('sin conexión se dice que se sube solo, no que lo reintentes', async () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        render(<AvisoSinEnviar />);
        await guardarAlgo();

        // Sin red se arregla saliendo del sótano y no hay nada que hacer.
        expect(screen.getByText(/Sin conexión/i)).toBeDefined();
    });

    test('con red, el que no está es el servidor', async () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        render(<AvisoSinEnviar />);
        await guardarAlgo();

        // Decir "sin conexión" aquí mandaría a buscar cobertura para nada.
        expect(screen.getByText(/No se ha podido enviar/i)).toBeDefined();
        expect(screen.queryByText(/Sin conexión/i)).toBeNull();
    });

    test('EL CÍRCULO SE CIERRA: al subir se dice que ya está', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo();
        expect(screen.getByText(/1 entreno sin subir/i)).toBeDefined();

        // La cola se vacía sola al volver la red. Esto es lo que ve el usuario
        // cuando eso pasa: sin este aviso, lo pendiente desaparece de la
        // pantalla sin decir si subió o si se perdió.
        await act(async () => { localStorage.clear(); vaciarCola(); });

        expect(screen.getByText(/Ya está subido/i)).toBeDefined();
    });

    test('y ese aviso se va solo, no se queda de adorno', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo();
        await act(async () => { localStorage.clear(); vaciarCola(); });
        expect(screen.getByText(/Ya está subido/i)).toBeDefined();

        await act(async () => { vi.advanceTimersByTime(4500); });

        expect(screen.queryByText(/Ya está subido/i)).toBeNull();
    });

    test('el botón de forzar el envío sale solo si hay algo que forzar', async () => {
        render(<AvisoSinEnviar />);
        await guardarAlgo();

        // Sin él, quien está en un sótano con cobertura intermitente no tiene
        // forma de intentarlo a mano.
        const boton = screen.getByLabelText(/Reintentar el envío ahora/i);
        expect(boton.disabled).toBe(false);

        await act(async () => { localStorage.clear(); vaciarCola(); });

        // Y en el aviso de "ya está subido" no pinta nada: no queda nada que
        // reintentar, y un botón que no hace nada invita a pulsarlo.
        expect(screen.queryByLabelText(/Reintentar el envío ahora/i)).toBeNull();
    });
});
