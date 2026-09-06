import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SelectorApuesta from './SelectorApuesta';

/**
 * LA CASILLA DE LA APUESTA
 *
 * Tiene tres reglas que no se parecen entre si y que son justo donde se
 * esconden los fallos con dinero:
 *
 *   1. el TOPE se aplica tecla a tecla
 *   2. el MINIMO no se aplica nunca al teclear
 *   3. la apuesta baja sola si pierdes, pero NO con el juego en marcha
 *
 * Ninguna es evidente, las tres se pueden romper con un cambio de una linea, y
 * cuando se rompen se rompen hacia "manda al servidor una apuesta que no era".
 * Por eso se prueban aqui y no a ojo.
 */

/**
 * El selector es un componente controlado: sin un padre que le devuelva el
 * valor, teclear no cambia nada y las pruebas medirian el vacio.
 */
function ConPadre({ alCambiar, ...props }) {
    const [valor, setValor] = useState(props.valorInicial ?? 10);
    return (
        <SelectorApuesta
            {...props}
            valor={valor}
            onChange={(v) => { setValor(v); alCambiar?.(v); }}
        />
    );
}

const casilla = () => screen.getByLabelText('Cantidad apostada');

describe('SelectorApuesta', () => {

    test('escribir una cantidad normal la manda tal cual', async () => {
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre saldo={12000} alCambiar={v => visto.push(v)} />);

        await user.click(casilla());
        await user.keyboard('300');

        expect(casilla().value).toBe('300');
        expect(visto.at(-1)).toBe(300);
    });

    test('EL TOPE SE APLICA AL TECLEAR: no te puedes pasar de tu saldo', async () => {
        // Si el tope esperase a que sales del campo, un numero imposible seguiria
        // siendo el valor apostado mientras la casilla tuviera el foco, y
        // bastaria con que el boton de jugar no lo quitase para mandarlo.
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre saldo={12000} alCambiar={v => visto.push(v)} />);

        await user.click(casilla());
        await user.keyboard('999999');

        expect(casilla().value).toBe('12000');
        expect(Math.max(...visto)).toBe(12000);
        expect(visto.every(v => v <= 12000)).toBe(true);
    });

    test('EL MINIMO NO: escribir "300" pasa por "3" y ese 3 no sale', async () => {
        // Aplicarlo tecla a tecla haria imposible escribir 300 con un minimo de
        // 10: al pulsar el "1" el valor saltaria a 10 y el resto se pegaria a eso.
        // La solucion no es aplicarlo mas tarde, es NO MANDAR lo que no vale.
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre saldo={5000} minimo={10} alCambiar={v => visto.push(v)} />);

        await user.click(casilla());
        await user.keyboard('300');

        expect(casilla().value).toBe('300');
        expect(visto).not.toContain(3);
        expect(visto.every(v => v >= 10)).toBe(true);
    });

    test('y al salir del campo, un numero demasiado bajo sube al minimo', async () => {
        const user = userEvent.setup();
        render(<ConPadre saldo={5000} minimo={10} />);

        await user.click(casilla());
        await user.keyboard('3');
        await user.tab();

        expect(casilla().value).toBe('10');
    });

    test('si pierdes y ya no te llega, la apuesta baja sola', async () => {
        // Apostabas 500, perdias, te quedaban 200, y la casilla seguia marcando
        // 500 con el boton de jugar apagado y sin decir por que.
        const visto = [];
        const { rerender } = render(
            <ConPadre valorInicial={500} saldo={5000} alCambiar={v => visto.push(v)} />
        );
        rerender(<ConPadre valorInicial={500} saldo={200} alCambiar={v => visto.push(v)} />);

        expect(visto.at(-1)).toBe(200);
    });

    test('...pero NUNCA con el juego en marcha', async () => {
        // Las tragaperras y el blackjack ensenan un saldo que baja mientras
        // giran. Recortar con ese numero cambiaria la apuesta a mitad de jugada,
        // que es peor que el problema que esto arregla.
        const visto = [];
        const { rerender } = render(
            <ConPadre valorInicial={500} saldo={5000} deshabilitado alCambiar={v => visto.push(v)} />
        );
        rerender(
            <ConPadre valorInicial={500} saldo={200} deshabilitado alCambiar={v => visto.push(v)} />
        );

        expect(visto).toHaveLength(0);
    });

    test('los atajos son cuatro, y solo los que caben en tu saldo', async () => {
        const { rerender } = render(<ConPadre saldo={12000} />);
        for (const v of [10, 25, 50, 100]) {
            expect(screen.getByRole('button', { name: String(v) })).toBeTruthy();
        }

        // Con 60 fichas, ensenar un boton de 100 es ensenar uno que no se puede
        // pulsar.
        rerender(<ConPadre saldo={60} />);
        expect(screen.queryByRole('button', { name: '100' })).toBeNull();
        expect(screen.getByRole('button', { name: '50' })).toBeTruthy();
    });

    test('el atajo pone su cantidad', async () => {
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre saldo={12000} alCambiar={v => visto.push(v)} />);

        await user.click(screen.getByRole('button', { name: '100' }));

        expect(visto.at(-1)).toBe(100);
        expect(casilla().value).toBe('100');
    });

    test('los botones de -/+ se mueven de paso en paso y respetan los limites', async () => {
        const user = userEvent.setup();
        render(<ConPadre valorInicial={20} saldo={12000} minimo={10} paso={10} />);

        await user.click(screen.getByLabelText('Subir la apuesta'));
        expect(casilla().value).toBe('30');

        await user.click(screen.getByLabelText('Bajar la apuesta'));
        await user.click(screen.getByLabelText('Bajar la apuesta'));
        expect(casilla().value).toBe('10');

        // Y no baja del minimo por mucho que se insista
        await user.click(screen.getByLabelText('Bajar la apuesta'));
        expect(casilla().value).toBe('10');
    });

    test('si no te llega ni para la apuesta minima, se dice', async () => {
        render(<ConPadre saldo={4} minimo={10} />);
        expect(screen.getByText(/No te llegan las fichas/i)).toBeTruthy();
    });

    test('las letras no entran en la casilla', async () => {
        const user = userEvent.setup();
        render(<ConPadre saldo={5000} />);

        await user.click(casilla());
        await user.keyboard('12a3b');

        expect(casilla().value).toBe('123');
    });
});
