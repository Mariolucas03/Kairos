import useSWR from 'swr';
import { Flame } from 'lucide-react';
import api from '../../services/api';

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
 */

// Del apagado al encendido. El nivel 0 no se pinta con color, se deja hueco.
const COLORES = ['#18181b', '#3f3f46', '#a16207', '#eab308', '#fde047'];

const DIAS_SEMANA = ['L', '', 'X', '', 'V', '', 'D'];

export default function MapaActividad({ semanas = 26 }) {
    const dias = semanas * 7;
    const { data, isLoading } = useSWR(`/daily/actividad?dias=${dias}`, fetcher);

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

        // Fecha local en formato YYYY-MM-DD (toISOString daría la de UTC, que
        // entre medianoche y las dos de la mañana es el día anterior)
        const clave = f.getFullYear() + '-' +
            String(f.getMonth() + 1).padStart(2, '0') + '-' +
            String(f.getDate()).padStart(2, '0');

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

    return (
        <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Flame size={13} className="text-yellow-500" /> Constancia
                </h2>
                {!isLoading && (
                    <span className="text-[10px] text-zinc-500 font-bold">
                        {totalActivos} días activos
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="h-[110px] rounded-xl bg-zinc-900/50 animate-pulse" />
            ) : (
                <div className="flex gap-2">
                    {/* Iniciales de los días, solo en las filas impares para que quepan */}
                    <div className="flex flex-col gap-[3px] pt-[1px] shrink-0">
                        {DIAS_SEMANA.map((d, i) => (
                            <span key={i} className="h-[12px] text-[8px] text-zinc-700 font-bold leading-[12px]">{d}</span>
                        ))}
                    </div>

                    {/* El mapa scrollea en horizontal: seis meses no caben en un móvil */}
                    <div className="flex-1 overflow-x-auto no-scrollbar">
                        <div className="flex gap-[3px] min-w-min">
                            {columnas.map((col, ci) => (
                                <div key={ci} className="flex flex-col gap-[3px]">
                                    {Array.from({ length: 7 }, (_, fila) => {
                                        const dia = col.find(d => d.diaSemana === fila);
                                        if (!dia) return <div key={fila} className="w-[12px] h-[12px]" />;

                                        const nivel = dia.info?.nivel || 0;
                                        return (
                                            <div
                                                key={fila}
                                                title={dia.clave + (dia.info ? ` · ${dia.info.entrenos} entrenos, ${dia.info.misiones} misiones` : ' · sin actividad')}
                                                className="w-[12px] h-[12px] rounded-[3px]"
                                                style={{ backgroundColor: COLORES[nivel] }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-1.5 mt-4">
                <span className="text-[8px] text-zinc-600 font-bold uppercase mr-1">Menos</span>
                {COLORES.map((c, i) => (
                    <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: c }} />
                ))}
                <span className="text-[8px] text-zinc-600 font-bold uppercase ml-1">Más</span>
            </div>
        </div>
    );
}
