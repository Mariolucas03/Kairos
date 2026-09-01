import { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import { Flame, X, Dumbbell, Target, CalendarCheck, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import WidgetCard from '../common/WidgetCard';
import { Z } from '../../utils/zLayers';

const fetcher = url => api.get(url).then(r => r.data);

/**
 * MAPA DE ACTIVIDAD — un cuadradito por día, como el de GitHub.
 *
 * Es la vista que hace que se vea de un golpe si estás siendo constante o
 * llevas dos semanas de excusas. Un número ("18 entrenos") no dice nada;
 * cuatro columnas en blanco seguidas, sí.
 *
 * Cuenta entrenos, misiones completadas y comida registrada, no solo entrenos:
 * un mapa que solo mirase el gimnasio dejaría en blanco los días de descanso en
 * los que sí cumpliste todo lo demás, que es justo lo contrario de lo que anima
 * a seguir.
 *
 * Vive en dos sitios: en el perfil y como widget del home. Por eso usa el
 * chasis comun (WidgetCard) en vez de pintarse su propia tarjeta: en el home
 * comparte fila con las demas y una tarjeta distinta se nota.
 *
 * AL PULSARLO SE ABRE. Un mapa de colores sin explicación es bonito y no dice
 * nada: nadie sabe por qué un día es ámbar y otro amarillo. El detalle cuenta
 * cómo se calcula y, de paso, saca las cifras que el mapa insinúa pero no dice
 * — la racha, la mejor racha, cuántos entrenos hay ahí dentro.
 */

// Del apagado al encendido. El nivel 0 no se pinta con color, se deja hueco.
const COLORES = ['#18181b', '#3f3f46', '#a16207', '#eab308', '#fde047'];

// Qué significa cada tono, para poder contarlo en el detalle
const QUE_ES_CADA_COLOR = [
    'Nada registrado',
    'Algo suelto: una misión, o la comida',
    'Un día normal: comida y un par de misiones',
    'Buen día: entreno más lo demás',
    'Día completo: entreno, misiones y comida'
];

const DIAS_SEMANA = ['L', '', 'X', '', 'V', '', 'D'];

// Amarillo, el mismo de los cuadraditos: el acento de la tarjeta tiene que
// ser el color de lo que hay dentro.
const ACENTO = '#eab308';

/** Clave YYYY-MM-DD en hora local (toISOString daría la de UTC). */
const claveDe = (f) => f.getFullYear() + '-' +
    String(f.getMonth() + 1).padStart(2, '0') + '-' +
    String(f.getDate()).padStart(2, '0');

export default function MapaActividad({ semanas = 26 }) {
    const dias = semanas * 7;
    const { data, isLoading, error } = useSWR(`/daily/actividad?dias=${dias}`, fetcher);
    const [abierto, setAbierto] = useState(false);

    // Seis meses no caben de ancho, asi que hay que elegir por donde empieza.
    // Se empieza por el final: lo que quieres ver de un vistazo es como vas
    // ESTA semana, no como ibas en marzo. Arrancando por la izquierda, el
    // cuadradito de hoy quedaba fuera de la pantalla.
    const carril = useRef(null);
    const carrilDetalle = useRef(null);
    useEffect(() => {
        if (carril.current) carril.current.scrollLeft = carril.current.scrollWidth;
    }, [data]);
    useEffect(() => {
        if (abierto && carrilDetalle.current) {
            carrilDetalle.current.scrollLeft = carrilDetalle.current.scrollWidth;
        }
    }, [abierto, data]);

    // Diccionario fecha -> nivel, para no recorrer el array por cada cuadradito
    const porFecha = {};
    for (const d of (data?.mapa || [])) porFecha[d.fecha] = d;

    // Se construye hacia atrás desde HOY y se completa hasta el domingo, para
    // que la última columna quede alineada con el resto.
    const hoy = new Date();
    const columnas = [];
    let columna = [];

    for (let i = dias - 1; i >= 0; i--) {
        const f = new Date(hoy);
        f.setDate(f.getDate() - i);
        const clave = claveDe(f);

        // getDay(): 0 = domingo. Se pasa a 0 = lunes para leerlo como una semana.
        const diaSemana = (f.getDay() + 6) % 7;

        if (diaSemana === 0 && columna.length > 0) {
            columnas.push(columna);
            columna = [];
        }

        columna.push({ clave, diaSemana, info: porFecha[clave] });
    }
    if (columna.length > 0) columnas.push(columna);

    const totalActivos = data?.activos || 0;

    /**
     * Las cifras que el mapa insinúa pero no dice.
     *
     * Salen del MISMO dato que ya se pidió para pintarlo: no hay ninguna
     * petición extra por abrir el detalle.
     */
    const resumen = useMemo(() => {
        const activos = new Set((data?.mapa || []).map(d => d.fecha));
        const entrenos = (data?.mapa || []).reduce((t, d) => t + (d.entrenos || 0), 0);
        const misiones = (data?.mapa || []).reduce((t, d) => t + (d.misiones || 0), 0);

        // Racha actual: días seguidos hacia atrás desde hoy. Se permite que hoy
        // esté vacío todavía — a media mañana no has hecho nada aún y decir que
        // tu racha es cero sería mentira.
        let racha = 0;
        const desde = new Date();
        if (!activos.has(claveDe(desde))) desde.setDate(desde.getDate() - 1);
        for (let i = 0; i < dias; i++) {
            const f = new Date(desde);
            f.setDate(f.getDate() - i);
            if (!activos.has(claveDe(f))) break;
            racha++;
        }

        // Mejor racha del periodo
        let mejor = 0, corriendo = 0;
        for (let i = dias - 1; i >= 0; i--) {
            const f = new Date();
            f.setDate(f.getDate() - i);
            if (activos.has(claveDe(f))) { corriendo++; mejor = Math.max(mejor, corriendo); }
            else corriendo = 0;
        }

        return { racha, mejor, entrenos, misiones, porcentaje: Math.round((activos.size / dias) * 100) };
    }, [data, dias]);

    const rejilla = (ref, lado) => (
        <div className="flex gap-2">
            <div className="flex flex-col gap-[3px] pt-[1px] shrink-0" style={{ width: lado }}>
                {DIAS_SEMANA.map((d, i) => (
                    <span key={i} className="text-[8px] text-zinc-700 font-bold" style={{ height: lado, lineHeight: lado + 'px' }}>{d}</span>
                ))}
            </div>
            <div ref={ref} className="flex-1 overflow-x-auto no-scrollbar">
                <div className="flex gap-[3px] min-w-min">
                    {columnas.map((col, ci) => (
                        <div key={ci} className="flex flex-col gap-[3px]">
                            {Array.from({ length: 7 }, (_, fila) => {
                                const dia = col.find(d => d.diaSemana === fila);
                                if (!dia) return <div key={fila} style={{ width: lado, height: lado }} />;
                                const nivel = dia.info?.nivel || 0;
                                return (
                                    <div
                                        key={fila}
                                        title={dia.clave + (dia.info ? ` · ${dia.info.entrenos} entrenos, ${dia.info.misiones} misiones` : ' · sin actividad')}
                                        className="rounded-[3px]"
                                        style={{ width: lado, height: lado, backgroundColor: COLORES[nivel] }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <WidgetCard
                accent={ACENTO}
                padding="p-5"
                className="h-full"
                onClick={isLoading ? undefined : () => setAbierto(true)}
            >
                <div className="relative z-10 flex items-center justify-between mb-4">
                    <h2 className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] flex items-center gap-2">
                        <Flame size={13} className="text-yellow-500" /> Constancia
                    </h2>
                    {/* Si la peticion fallo NO se dice "0 dias activos": eso es una
                        mentira, y encima desanima justo a quien si ha entrenado.
                        La cache guardada puede traer un cero de un intento fallido
                        anterior, asi que se mira el error y no solo el dato. */}
                    {!isLoading && (
                        <span className="text-[10px] text-zinc-500 font-bold">
                            {error ? 'sin conexión' : totalActivos + ' días activos'}
                        </span>
                    )}
                </div>

                {isLoading
                    ? <div className="h-[110px] rounded-xl bg-zinc-900/50 animate-pulse" />
                    : <div className="relative z-10">{rejilla(carril, 12)}</div>}

                <div className="relative z-10 flex items-center justify-between mt-4">
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wide">
                        Toca para ver más
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-zinc-600 font-bold uppercase mr-1">Menos</span>
                        {COLORES.map((c, i) => (
                            <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: c }} />
                        ))}
                        <span className="text-[8px] text-zinc-600 font-bold uppercase ml-1">Más</span>
                    </div>
                </div>
            </WidgetCard>

            {/* ── EL DETALLE ─────────────────────────────────────────────── */}
            {abierto && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in"
                    style={{ zIndex: Z.modal }}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setAbierto(false)} />

                    <div className="relative z-10 w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-[28px] p-5 shadow-2xl shadow-black/70 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">

                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Flame size={16} style={{ color: ACENTO }} /> Constancia
                                </h2>
                                <p className="text-[10px] text-zinc-500 mt-0.5">Las últimas {semanas} semanas</p>
                            </div>
                            <button
                                onClick={() => setAbierto(false)}
                                className="p-2 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform shrink-0"
                            ><X size={16} /></button>
                        </div>

                        {/* Las cifras */}
                        <div className="grid grid-cols-2 gap-2 mb-5">
                            <Cifra icono={Flame} color="#f97316" valor={resumen.racha} etiqueta="Racha ahora" pie="días seguidos" />
                            <Cifra icono={TrendingUp} color="#22c55e" valor={resumen.mejor} etiqueta="Mejor racha" pie="en este periodo" />
                            <Cifra icono={Dumbbell} color={ACENTO} valor={resumen.entrenos} etiqueta="Entrenos" pie="gym y otros deportes" />
                            <Cifra icono={Target} color="#f43f5e" valor={resumen.misiones} etiqueta="Misiones" pie="completadas" />
                        </div>

                        <div className="bg-black border border-white/[0.06] rounded-[20px] p-4 mb-5">
                            <div className="flex items-baseline justify-between mb-3">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">El mapa</span>
                                <span className="text-[10px] font-black" style={{ color: ACENTO }}>
                                    {totalActivos} de {dias} días · {resumen.porcentaje}%
                                </span>
                            </div>
                            {rejilla(carrilDetalle, 14)}
                            <p className="text-[9px] text-zinc-600 mt-3">
                                Se puede arrastrar hacia atrás. Cada cuadrado es un día; el último es hoy.
                            </p>
                        </div>

                        {/* Cómo se calcula */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Cómo se calcula</p>
                            <p className="text-[12px] text-zinc-400 leading-relaxed">
                                No cuenta solo entrenos. Cada día suma puntos:
                            </p>
                            <div className="bg-black border border-white/[0.06] rounded-2xl p-3 mt-2 space-y-1.5">
                                {[
                                    ['Cada entreno', '2 puntos'],
                                    ['Cada misión completada', '1 punto'],
                                    ['Registrar comida', '1 punto']
                                ].map(([q, v]) => (
                                    <div key={q} className="flex items-baseline justify-between gap-3">
                                        <span className="text-[11px] text-zinc-400">{q}</span>
                                        <span className="text-[11px] font-black text-white tabular-nums shrink-0">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
                                Un entreno pesa el doble porque es lo que de verdad cuesta. Y la comida y
                                las misiones entran a propósito: un mapa que solo mirase el gimnasio te
                                dejaría <strong className="text-zinc-300">en blanco los días de descanso</strong> en
                                los que sí cumpliste lo demás.
                            </p>
                        </div>

                        {/* Qué significa cada color */}
                        <div>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Los colores</p>
                            <div className="space-y-1.5">
                                {COLORES.map((c, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-[14px] h-[14px] rounded-[3px] shrink-0" style={{ backgroundColor: c }} />
                                        <span className="text-[9px] font-black text-zinc-600 tabular-nums w-8 shrink-0">
                                            {i === 0 ? '0' : i === 4 ? '7+' : `${i * 2 - 1}-${i * 2}`}
                                        </span>
                                        <span className="text-[11px] text-zinc-400 leading-tight">{QUE_ES_CADA_COLOR[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const Cifra = ({ icono: Icono, color, valor, etiqueta, pie }) => (
    <div className="bg-black border border-white/[0.06] rounded-[18px] p-3">
        <Icono size={13} style={{ color }} />
        <p className="text-xl font-black text-white mt-1 leading-none tabular-nums">{valor}</p>
        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wide mt-1.5">{etiqueta}</p>
        <p className="text-[9px] text-zinc-600 mt-0.5 leading-tight">{pie}</p>
    </div>
);
