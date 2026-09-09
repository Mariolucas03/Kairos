import { useState, useEffect } from 'react';
// ⚠️ AQUI SE IMPORTABA RECHARTS: 101 kB COMPRIMIDOS PARA UNA LINEA.
//
// Era el unico sitio del proyecto que la usaba de verdad, y para una sola
// grafica de area con una serie. `ProgressChart` ya dibujaba exactamente eso a
// mano —su comentario dice "la libreria pesa ~300 KB y aqui solo hace falta una
// linea con puntos"— asi que se reutiliza y recharts sale del package.json.
//
// Se notaba: abrir tu perfil descargaba 101 kB que ya no se descargan.
import ProgressChart from '../gym/ProgressChart';
import { TrendingUp, Activity, Search, Dumbbell, X } from 'lucide-react';
import api from '../../services/api';

export default function ProfileStats({ mini = false, onClick, onCloseExternal }) {
    const [exercises, setExercises] = useState([]);
    const [selectedExercise, setSelectedExercise] = useState('');
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bestPR, setBestPR] = useState(0);



    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const res = await api.get('/gym/exercises?muscle=Todos');
                setExercises(res.data);
                if (res.data.length > 0) setSelectedExercise(res.data[0].name);
            } catch (error) { console.error(error); }
        };
        fetchExercises();
    }, []);

    useEffect(() => {
        if (!selectedExercise) return;
        const fetchData = async () => {
            if (!mini) setLoading(true);
            try {
                const res = await api.get(`/gym/exercise-history?exerciseName=${selectedExercise}`);
                const data = res.data;
                // ⚠️ Los dias sin 1RM fiable se saltan.
                //
                // El servidor manda `pr: null` cuando ninguna serie de ese dia
                // se puede estimar (todas por encima de 12 repeticiones, o sin
                // peso). Pintarlos daria un cero en la grafica, que se lee como
                // "ese dia no pudiste" cuando en realidad es "ese dia no se
                // puede calcular".
                setChartData(data.filter(d => typeof d.pr === 'number'));
                if (data.length > 0) {
                    const max = Math.max(...data.filter(d => typeof d.pr === 'number').map(d => d.pr), 0);
                    setBestPR(max);
                }
            } catch (error) { console.error(error); }
            finally { if (!mini) setLoading(false); }
        };
        fetchData();
    }, [selectedExercise, mini]);

    // --- MODO MINI (WIDGET PERFIL) ---
    if (mini) {
        return (
            <div
                onClick={onClick}
                className={`
                    w-full relative rounded-4xl overflow-hidden
                    group cursor-pointer active:scale-[0.99] transition-all duration-200
                    p-[2px] h-[160px]
                    bg-zinc-300
                `}
            >
                <div className="h-full w-full bg-zinc-950 rounded-3xl flex flex-col justify-between relative overflow-hidden z-10">
                    <div className="px-5 pt-5 flex justify-between items-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white not-italic uppercase tracking-tighter leading-none drop-shadow-md flex items-center gap-2">
                            FUERZA 1RM
                        </h2>
                        <div className="bg-yellow-500/20 p-2 rounded-full border border-yellow-500/50 text-yellow-400">
                            <Dumbbell size={18} />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center z-10 -mt-2">
                        <div className="flex items-baseline gap-1 animate-in zoom-in duration-300">
                            <span className="text-6xl font-black tracking-[-0.05em] leading-none text-white not-italic">
                                {bestPR || '--'}
                            </span>
                            <span className="text-2xl font-black uppercase text-yellow-500 tracking-tighter not-italic">KG</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            {selectedExercise || 'Sin datos'}
                        </span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className="h-full w-full bg-yellow-500"></div>
                    </div>
                </div>
            </div>
        );
    }

    // --- MODO FULL (MODAL INTERNO) ---
    return (
        <div className="bg-[#09090b] border border-white/10 w-full rounded-4xl p-6 shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden h-[500px]">

            {/* Decoración Fondo */}
            <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'linear-gradient(90deg, #eab308, transparent)' }}></div>
            <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none" style={{ background: '#eab308', opacity: 0.11 }}></div>

            {/* HEADER CON BOTÓN X DENTRO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-20 shrink-0">
                <div className="flex justify-between w-full items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 not-italic">
                            PROGRESO <span className="text-yellow-500">FUERZA</span>
                        </h2>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Tu evolución histórica</p>
                    </div>

                    {/* 🔥 BOTÓN X CORREGIDO: DENTRO DEL FLUJO VISUAL */}
                    {onCloseExternal && (
                        <button
                            onClick={onCloseExternal}
                            className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-colors active:scale-95"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* SELECTOR */}
                <div className="relative w-full sm:w-auto min-w-[200px] mt-2 sm:mt-0">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><Search size={14} /></div>
                    <select
                        value={selectedExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                        className="w-full bg-black text-white text-xs font-bold uppercase tracking-wide rounded-xl py-3 pl-9 pr-8 border border-zinc-800 focus:outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                    >
                        {exercises.map(ex => <option key={ex._id} value={ex.name}>{ex.name}</option>)}
                    </select>
                </div>
            </div>

            {/* GRÁFICA */}
            <div className="flex-1 w-full bg-zinc-900/30 rounded-4xl p-4 border border-white/[0.07] relative z-10">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 animate-pulse font-bold text-xs uppercase"><Activity size={24} className="mr-2" /> Cargando datos...</div>
                ) : chartData.length < 2 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs font-bold uppercase border-2 border-dashed border-zinc-800 rounded-2xl">
                        <p>Faltan datos para la gráfica</p>
                    </div>
                ) : (
                    <ProgressChart points={chartData} metric="pr" unit="kg" />
                )}
            </div>

            {/* FOOTER STATS */}
            {chartData.length >= 2 && (
                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/[0.07] relative z-10">
                    <div className="text-center bg-zinc-900/50 p-2 rounded-xl border border-white/[0.07]">
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Inicio</p>
                        <p className="text-lg font-black text-zinc-400">{chartData[0].pr} <span className="text-[10px]">KG</span></p>
                    </div>
                    <div className="text-center bg-yellow-900/10 p-2 rounded-xl border border-yellow-500/20">
                        <p className="text-[9px] text-yellow-600 uppercase font-black tracking-wider">Actual</p>
                        <p className="text-xl font-black text-white">{chartData[chartData.length - 1].pr} <span className="text-[10px]">KG</span></p>
                    </div>
                    <div className="text-center bg-zinc-900/50 p-2 rounded-xl border border-white/[0.07]">
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Mejora</p>
                        <p className={`text-lg font-black ${chartData[chartData.length - 1].pr >= chartData[0].pr ? 'text-green-400' : 'text-red-400'}`}>
                            {chartData[chartData.length - 1].pr - chartData[0].pr > 0 ? '+' : ''}
                            {chartData[chartData.length - 1].pr - chartData[0].pr} <span className="text-[10px]">KG</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}