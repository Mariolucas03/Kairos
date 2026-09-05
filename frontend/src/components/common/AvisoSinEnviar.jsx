import { CloudOff, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useColaPendiente } from '../../hooks/useColaPendiente';

/**
 * "TIENES COSAS SIN SUBIR".
 *
 * El aviso que faltaba. La cola de envíos sin cobertura ya existía y funcionaba
 * sola, pero era invisible: guardabas un entreno en el sótano del gimnasio, veías
 * un aviso de tres segundos y a partir de ahí a fiarte. Nada te decía que seguía
 * esperando, ni cuándo había subido.
 *
 * Se enseña en dos momentos y ya:
 *   - mientras haya algo esperando, con el motivo y un botón para forzarlo
 *   - cuatro segundos al subir, para cerrar el círculo
 *
 * Y no se enseña nunca más, porque lo normal es que la cola esté vacía. Un aviso
 * permanente de "todo bien" es ruido.
 */

// 'misión' no hace el plural como los demás, así que las formas van escritas.
const PLURALES = {
    entreno: 'entrenos',
    alimento: 'alimentos',
    'misión': 'misiones',
    cambio: 'cambios'
};

const enPalabras = ({ nombre, cuantos }) =>
    `${cuantos} ${cuantos === 1 ? nombre : (PLURALES[nombre] || `${nombre}s`)}`;

/** "1 entreno", "1 entreno y 2 alimentos", "1 entreno, 2 alimentos y 1 misión". */
const enumerar = (partes) => {
    if (partes.length === 0) return '';
    if (partes.length === 1) return partes[0];
    return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
};

/**
 * El titular, que tiene que caber en UNA línea.
 *
 * Con una sola clase de cosa se dice cual es —"1 entreno sin subir" es mucho
 * mas tranquilizador que "1 cosa sin subir"—, y ese es ademas el caso normal:
 * lo que se queda sin cobertura suele ser el entreno del sotano. Cuando la
 * lista se hace larga se resume, porque en mayusculas y a este tamaño
 * "2 alimentos, 1 entreno y 1 mision sin subir" se partia en dos lineas y la
 * pastilla crecia hasta parecer un error.
 */
const TOPE_DE_LINEA = 24;

const titular = ({ total, etiquetas }) => {
    const detalle = enumerar(etiquetas.map(enPalabras));
    return detalle.length <= TOPE_DE_LINEA
        ? `${detalle} sin subir`
        : `${total} cosas sin subir`;
};

export default function AvisoSinEnviar() {
    const { resumen, enLinea, subidas, reintentando, reintentar } = useColaPendiente();

    const esperando = resumen.total > 0;
    if (!esperando && subidas === 0) return null;

    const subido = !esperando && subidas > 0;
    const color = subido ? '#22c55e' : '#eab308';

    return (
        // Abajo, justo encima del menú, y NO arriba: arriba está el aviso de
        // "arrancando el servidor", y dos pastillas peleándose por el mismo
        // hueco acaban tapándose la una a la otra.
        //
        // z-[60] pasa por delante del menú (z-50) y por detrás de cualquier
        // ventana que se abra dentro de una pantalla.
        <div className="fixed left-0 right-0 z-[60] px-4 pointer-events-none" style={{ bottom: '100px' }}>
            <div className="mx-auto w-full max-w-md bg-[#0a0a0c] border border-white/[0.07] rounded-[16px] px-3.5 py-2.5 flex items-center gap-3 overflow-hidden relative">
                <div
                    className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
                    style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
                />

                {subido
                    ? <Check size={16} className="shrink-0" style={{ color }} />
                    : reintentando
                        ? <Loader2 size={16} className="shrink-0 animate-spin" style={{ color }} />
                        : <CloudOff size={16} className="shrink-0" style={{ color }} />}

                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-zinc-200 uppercase tracking-[0.12em] leading-none not-italic">
                        {subido ? 'Ya está subido' : titular(resumen)}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-none mt-1.5">
                        {subido
                            ? 'Lo que estaba esperando ya está en tu cuenta'
                            : reintentando
                                ? 'Enviando…'
                                // Sin red se arregla solo al salir del sótano. Con
                                // red, el que no está es el servidor, y decir "sin
                                // conexión" mandaría a buscar cobertura para nada.
                                : enLinea
                                    ? 'No se ha podido enviar. Se reintenta solo'
                                    : 'Sin conexión. Se sube solo en cuanto vuelva'}
                    </p>
                </div>

                {esperando && (
                    <button
                        type="button"
                        onClick={reintentar}
                        disabled={reintentando}
                        aria-label="Reintentar el envío ahora"
                        className="pointer-events-auto shrink-0 w-9 h-9 rounded-xl bg-zinc-900 border border-white/[0.06] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                    >
                        <RefreshCw size={14} className={reintentando ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>
        </div>
    );
}
