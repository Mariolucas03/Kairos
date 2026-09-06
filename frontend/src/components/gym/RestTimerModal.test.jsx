import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RestTimerModal from './RestTimerModal';

/**
 * EL DESCANSO, Y EL RIR QUE SE PREGUNTA DENTRO
 *
 * `esfuerzo` y `tipoEsfuerzo` llevaban meses en el modelo del entreno, con su
 * validacion y hasta una prueba llamada "tiene sitio para cuando haya
 * pantalla". Nunca hubo pantalla, asi que el campo llegaba vacio siempre.
 *
 * Ahora se pregunta en el descanso. Lo que se comprueba aqui es que se pueda no
 * contestar —no contestar y contestar 0 son cosas MUY distintas: 0 significa
 * que fuiste al fallo— y que se pueda cambiar de idea.
 */

const props = {
    targetTime: Date.now() + 90000,
    initialDefaultRest: 90,
    onSkip: () => { },
    onUpdateDefaultRest: () => { }
};

/** El padre que guarda la respuesta, como hace ActiveWorkout. */
function ConPadre({ alResponder, inicial }) {
    const [esfuerzo, setEsfuerzo] = useState(inicial);
    return (
        <RestTimerModal
            {...props}
            esfuerzo={esfuerzo}
            onEsfuerzo={(v) => { setEsfuerzo(v); alResponder?.(v); }}
        />
    );
}

describe('RestTimerModal: el RIR', () => {

    test('se pregunta en el descanso, con las cinco opciones', () => {
        render(<ConPadre />);

        expect(screen.getByText(/¿Cuántas más podías hacer\?/i)).toBeTruthy();
        for (const t of ['0', '1', '2', '3', '4+']) {
            expect(screen.getByRole('button', { name: new RegExp(`^${t.replace('+', '\\+')} repeticiones`) })).toBeTruthy();
        }
    });

    test('responder guarda el numero', async () => {
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre alResponder={v => visto.push(v)} />);

        await user.click(screen.getByRole('button', { name: /^2 repeticiones/ }));

        expect(visto).toEqual([2]);
    });

    test('CERO ES UNA RESPUESTA, no "sin contestar"', () => {
        // Es la distincion que hace util todo esto: 0 significa que llegaste al
        // fallo. Si se tratara como "vacio", la serie mas dura del entreno seria
        // justo la que no se guarda.
        render(<ConPadre inicial={0} />);

        const boton = screen.getByRole('button', { name: /^0 repeticiones/ });
        expect(boton.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('Al fallo')).toBeTruthy();
    });

    test('volver a pulsar la misma opcion la quita', async () => {
        // Te equivocas de boton con el movil en la mano sudando: tiene que poder
        // deshacerse sin salir del descanso.
        const user = userEvent.setup();
        const visto = [];
        render(<ConPadre alResponder={v => visto.push(v)} />);

        await user.click(screen.getByRole('button', { name: /^3 repeticiones/ }));
        await user.click(screen.getByRole('button', { name: /^3 repeticiones/ }));

        expect(visto).toEqual([3, null]);
        expect(screen.getByRole('button', { name: /^3 repeticiones/ }).getAttribute('aria-pressed')).toBe('false');
    });

    test('se puede cambiar de idea', async () => {
        const user = userEvent.setup();
        render(<ConPadre />);

        await user.click(screen.getByRole('button', { name: /^1 repeticiones/ }));
        await user.click(screen.getByRole('button', { name: /^4\+ repeticiones/ }));

        expect(screen.getByRole('button', { name: /^1 repeticiones/ }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('button', { name: /^4\+ repeticiones/ }).getAttribute('aria-pressed')).toBe('true');
    });

    test('sin `onEsfuerzo` no se pregunta nada', () => {
        // El descanso tambien salta sin una serie detras (al saltarlo a mano).
        // Preguntar por el esfuerzo de una serie que no existe no tiene sentido.
        render(<RestTimerModal {...props} />);

        expect(screen.queryByText(/¿Cuántas más podías hacer\?/i)).toBeNull();
    });

    test('el descanso sigue funcionando: cuenta atras y saltar', async () => {
        const user = userEvent.setup();
        let saltado = false;
        render(<RestTimerModal {...props} onSkip={() => { saltado = true; }} />);

        expect(screen.getByText('Segundos')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: /saltar/i }));
        expect(saltado).toBe(true);
    });
});
