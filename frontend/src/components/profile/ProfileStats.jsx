import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, Search, Dumbbell, X } from 'lucide-react';
import api from '../../services/api';

export default function ProfileStats({ mini = false, onClick, onCloseExternal }) {
    const [exercises, setExercises] = useState([]);
    const [selectedExercise, setSelectedExercise] = useState('');
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bestPR, setBestPR] = useState(0);

    // --- ESTILO VISUAL "TITANIUM GOLD" ---
    const gradientClasses = "from-yellow-500 via-amber-400 to-yellow-600";

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
                setChartData(data);
                if (data.length > 0) {
                    const max = Math.max(...data.map(d => d.pr));
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
                    w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.99] transition-all duration-200
                    p-[2px] h-[160px]
                    bg-gradient-to-br from-zinc-100 via-zinc-400 to-zinc-600
                    shadow-[0_0_25px_rgba(255,255,255,0.15)]
                `}
            >
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">
                    <div className="px-5 pt-5 flex justify-between items-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md flex items-center gap-2">
                            FUERZA 1RM
                        </h2>
                        <div className="bg-yellow-500/20 p-2 rounded-full border border-yellow-500/50 text-yellow-400">
                            <Dumbbell size={18} />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center z-10 -mt-2">
                        <div className="flex items-baseline gap-1 animate-in zoom-in duration-300">
                            <span className="text-6xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 drop-shadow-lg not-italic">
                                {bestPR || '--'}
                            </span>
                            <span className="text-2xl font-black uppercase text-yellow-500 tracking-tighter not-italic">KG</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            {selectedExercise || 'Sin datos'}
                        </span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className="h-full w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-white shadow-[0_-2px_20px_rgba(234,179,8,0.5)]"></div>
                    </div>
                </div>
            </div>
        );
    }

    // --- MODO FULL (MODAL INTERNO) ---
    return (
        <div className="bg-[#09090b] border border-white/10 w-full rounded-[40px] p-6 shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden h-[500px]">

            {/* Decoración Fondo */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
            <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-10`}></div>

            {/* HEADER CON BOTÓN X DENTRO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-20 shrink-0">
                <div className="flex justify-between w-full items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 not-italic">
                            PROGRESO <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>FUERZA</span>
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
            <div className="flex-1 w-full bg-zinc-900/30 rounded-[32px] p-4 border border-white/5 relative z-10">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 animate-pulse font-bold text-xs uppercase"><Activity size={24} className="mr-2" /> Cargando datos...</div>
                ) : chartData.length < 2 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs font-bold uppercase border-2 border-dashed border-zinc-800 rounded-2xl">
                        <p>Faltan datos para la gráfica</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525b" tick={{ fontSize: 10, fill: '#71717a' }} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#52525b" tick={{ fontSize: 10, fill: '#71717a' }} domain={['dataMin - 5', 'dataMax + 5']} unit="kg" axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', padding: '12px' }}
                                itemStyle={{ color: '#EAB308', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px' }}
                                labelStyle={{ color: '#a1a1aa', marginBottom: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            />
                            <Area type="monotone" dataKey="pr" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorPr)" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* FOOTER STATS */}
            {chartData.length >= 2 && (
                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/5 relative z-10">
                    <div className="text-center bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Inicio</p>
                        <p className="text-lg font-black text-zinc-400">{chartData[0].pr} <span className="text-[10px]">KG</span></p>
                    </div>
                    <div className="text-center bg-yellow-900/10 p-2 rounded-xl border border-yellow-500/20">
                        <p className="text-[9px] text-yellow-600 uppercase font-black tracking-wider">Actual</p>
                        <p className="text-xl font-black text-white">{chartData[chartData.length - 1].pr} <span className="text-[10px]">KG</span></p>
                    </div>
                    <div className="text-center bg-zinc-900/50 p-2 rounded-xl border border-white/5">
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