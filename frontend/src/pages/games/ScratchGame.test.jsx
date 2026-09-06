import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';

import ScratchGame from './ScratchGame';

/**
 * EL RASCA
 *
 * Era el ultimo juego con la apuesta clavada en 10 fichas, y su tabla de
 * premios llevaba meses mintiendo: enseñaba 500 / 200 XP / 100 / 50 cuando el
 * servidor pagaba 150 / 75 / 30 / 15. Los premios se bajaron en el backend
 * porque el rasca regalaba dinero, y esta tabla no se toco.
 *
 * Lo que se prueba aqui es lo unico que puede volver a romperse en silencio:
 * que lo apostado LLEGUE AL SERVIDOR tal cual, y que la tabla enseñe multiplos
 * (que no dependen de la apuesta) en vez de cantidades inventadas.
 */

// ⚠️ `vi.hoisted` NO es adorno: `vi.mock` se sube al principio del fichero, por
// encima de cualquier `const` de aqui arriba, asi que una fabrica que use una
// variable normal peta con "Cannot access 'api' before initialization". Esto
// declara los dobles ARRIBA DEL TODO, donde las fabricas los pueden ver.
const dobles = vi.hoisted(() => ({
    api: { post: vi.fn() },
    setUser: vi.fn(),
    // Mutable a proposito: cada prueba decide con cuantas fichas se juega.
    estado: { user: { gameCoins: 5000 } }
}));

const { api } = dobles;

vi.mock('../../services/api', () => ({ default: dobles.api }));

vi.mock('../../store/useAuthStore', () => ({
    useAuthStore: (selector) => selector({
        user: dobles.estado.user,
        setUser: dobles.setUser,
        setIsUiHidden: () => { }
    })
}));

const pintar = () => render(<MemoryRouter><ScratchGame /></MemoryRouter>);

const carton = (premio = 0) => ({
    data: {
        grid: Array.from({ length: 9 }, () => ({ id: 's', icon: '💀', type: 'none' })),
        won: premio > 0,
        prize: premio,
        prizeType: premio > 0 ? 'coins' : 'none',
        apuesta: 10,
        user: { gameCoins: 4990 }
    }
});

beforeEach(() => {
    dobles.estado.user = { gameCoins: 5000 };
    api.post.mockReset();
    api.post.mockResolvedValue(carton());
});

describe('ScratchGame', () => {

    test('la apuesta que eliges es la que se manda', async () => {
        const user = userEvent.setup();
        pintar();

        await user.click(screen.getByRole('button', { name: '100' }));
        await user.click(screen.getByRole('button', { name: /comprar cartón/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/games/scratch', { bet: 100 });
        });
    });

    test('sin tocar nada se apuesta el minimo de siempre', async () => {
        // El rasca costaba 10 fichas. Quien no quiera pensar en la apuesta tiene
        // que seguir jugando exactamente igual que antes.
        const user = userEvent.setup();
        pintar();

        await user.click(screen.getByRole('button', { name: /comprar cartón/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/games/scratch', { bet: 10 });
        });
    });

    test('una cantidad escrita a mano tambien llega', async () => {
        const user = userEvent.setup();
        pintar();

        const casilla = screen.getByLabelText('Cantidad apostada');
        await user.click(casilla);
        await user.keyboard('250');
        await user.click(screen.getByRole('button', { name: /comprar cartón/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/games/scratch', { bet: 250 });
        });
    });

    test('LA TABLA DE PREMIOS ENSEÑA MULTIPLOS, NO CANTIDADES INVENTADAS', async () => {
        // Antes decia "500" y el servidor pagaba 150. Un multiplo no puede
        // desincronizarse con la apuesta porque no depende de ella.
        const user = userEvent.setup();
        pintar();

        await user.click(screen.getByRole('button', { name: /tabla de premios/i }));

        await waitFor(() => {
            expect(screen.getByText('×15')).toBeTruthy();
        });
        expect(screen.getByText('×3')).toBeTruthy();
        expect(screen.getByText('×1,5')).toBeTruthy();
        expect(screen.getByText('75 XP')).toBeTruthy();

        // Y ni rastro de los numeros viejos
        expect(screen.queryByText('500')).toBeNull();
        expect(screen.queryByText('200 XP')).toBeNull();
    });

    test('no se puede comprar un carton que no te puedes permitir', async () => {
        dobles.estado.user = { gameCoins: 4 };
        pintar();

        const boton = screen.getByRole('button', { name: /comprar cartón/i });
        expect(boton.disabled).toBe(true);
    });

    test('mientras rascas no se puede cambiar la apuesta', async () => {
        // La apuesta de este carton ya esta cobrada: dejar tocarla mientras
        // rascas haria pensar que el premio va a salir de la nueva.
        const user = userEvent.setup();
        // La peticion se queda colgada para poder mirar el estado "jugando"
        api.post.mockImplementation(() => new Promise(() => { }));
        pintar();

        await user.click(screen.getByRole('button', { name: /comprar cartón/i }));

        await waitFor(() => {
            expect(screen.getByLabelText('Cantidad apostada').closest('.pointer-events-none')).toBeTruthy();
        });
    });
});
