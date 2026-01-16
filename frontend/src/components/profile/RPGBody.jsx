import { useState, useEffect } from 'react';
import { Activity, Zap, Maximize2 } from 'lucide-react';

export default function RPGBody({ mini = false, onClick }) {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('front'); // 'front' o 'back'

    const BODY_IMAGE_SRC = "/assets/body/cuerpo.png";

    useEffect(() => {
        // Datos de prueba para que VEAS COLORES
        setTimeout(() => {
            setStats({
                chest: 'sore',        // ROJO
                abs: 'trained',       // VERDE
                quads: 'recovering',  // AMARILLO
                shoulders: 'trained', // VERDE
                biceps: 'sore',       // ROJO
                back: 'trained',      // VERDE (Trasera)
                glutes: 'recovering'  // AMARILLO (Trasera)
            });
            setLoading(false);
        }, 500);
    }, []);

    const getMuscleStyle = (status) => {
        const base = {
            stroke: "none",
            transition: "all 0.3s ease",
            cursor: "pointer",
            mixBlendMode: "multiply" // Esto hace que el color se fusione con el dibujo
        };

        switch (status) {
            case 'trained': return { ...base, fill: "rgba(34, 197, 94, 0.6)" }; // Verde
            case 'sore': return { ...base, fill: "rgba(239, 68, 68, 0.6)" }; // Rojo
            case 'recovering': return { ...base, fill: "rgba(234, 179, 8, 0.6)" }; // Amarillo
            default: return { ...base, fill: "transparent", className: "hover:fill-gray-500/20" };
        }
    };

    const MusclePath = ({ name, d }) => {
        const key = name.toLowerCase();
        const style = getMuscleStyle(stats[key]);
        return (
            <path d={d} fill={style.fill} style={style} className={style.className}>
                <title>{name}</title>
            </path>
        );
    };

    // --- WIDGET MINI ---
    if (mini) {
        return (
            <div onClick={onClick} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 h-48 relative overflow-hidden group cursor-pointer hover:border-blue-500/50 transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={48} /></div>
                <div className="flex justify-between items-start z-10">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-blue-400 transition-colors"><Activity size={12} /> Estado Físico</h3>
                    <Maximize2 size={12} className="text-gray-600 group-hover:text-blue-400" />
                </div>
                <div className="flex-1 flex items-center justify-center relative mt-2 overflow-hidden rounded-lg bg-white/5">
                    {loading ? <div className="animate-spin w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent" /> : (
                        <div className="relative w-24 h-32 overflow-hidden">
                            <img src={BODY_IMAGE_SRC} className="absolute max-w-none w-[180px] -top-[15px] -left-[42px] opacity-80 contrast-125" alt="Miniatura" />
                        </div>
                    )}
                </div>
                <p className="text-[9px] text-gray-500 z-10 text-center mt-1">Ver mapa completo</p>
            </div>
        );
    }

    // --- MODAL COMPLETO ---
    return (
        <div className="w-full h-full bg-gray-950 p-0 relative overflow-hidden flex flex-col items-center select-none">

            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex bg-gray-900/90 backdrop-blur border border-gray-700 rounded-full p-1 shadow-xl">
                <button onClick={() => setView('front')} className={`px-6 py-2 text-xs font-bold rounded-full transition-all ${view === 'front' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>FRONTAL</button>
                <button onClick={() => setView('back')} className={`px-6 py-2 text-xs font-bold rounded-full transition-all ${view === 'back' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>TRASERA</button>
            </div>

            {loading ? (
                <div className="flex h-full items-center justify-center"><Zap className="text-blue-500 animate-bounce" /></div>
            ) : (
                <div className="relative w-full h-full max-w-3xl mx-auto flex items-center justify-center overflow-hidden">

                    {/* Contenedor deslizante */}
                    <div
                        className="relative h-[80vh] w-[200%] flex transition-transform duration-500 ease-in-out"
                        style={{ transform: view === 'front' ? 'translateX(0)' : 'translateX(-50%)' }}
                    >
                        <img src={BODY_IMAGE_SRC} alt="Cuerpo" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none opacity-90" />

                        {/* HE AÑADIDO COORDENADAS APROXIMADAS AQUÍ ABAJO.
                           Si no encajan perfecto, ajusta los números dentro de d="M..."
                        */}
                        <svg viewBox="0 0 1000 700" className="absolute inset-0 w-full h-full z-10 overflow-visible" preserveAspectRatio="xMidYMid meet">

                            {/* === FRONTAL (Izquierda) === */}
                            <g transform="translate(0, 0)">
                                {/* Pecho (Cuadrado rojo aprox) */}
                                <MusclePath name="Chest" d="M 180 180 L 280 180 L 270 230 L 190 230 Z" />

                                {/* Abs (Rectángulo verde aprox) */}
                                <MusclePath name="Abs" d="M 205 235 L 255 235 L 250 320 L 210 320 Z" />

                                {/* Hombros */}
                                <MusclePath name="Shoulders" d="M 130 160 L 170 160 L 160 200 L 120 190 Z" />
                                <MusclePath name="Shoulders" d="M 290 160 L 330 160 L 340 190 L 300 200 Z" />

                                {/* Bíceps */}
                                <MusclePath name="Biceps" d="M 120 200 L 150 200 L 140 240 L 110 230 Z" />
                                <MusclePath name="Biceps" d="M 310 200 L 340 200 L 350 230 L 320 240 Z" />

                                {/* Cuádriceps (Piernas) */}
                                <MusclePath name="Quads" d="M 180 340 L 220 340 L 210 480 L 180 460 Z" />
                                <MusclePath name="Quads" d="M 240 340 L 280 340 L 280 460 L 250 480 Z" />
                            </g>

                            {/* === TRASERA (Derecha - Offset X ~500) === */}
                            <g transform="translate(0, 0)">
                                {/* Espalda (Dorsales) */}
                                <MusclePath name="Back" d="M 680 180 L 780 180 L 760 280 L 700 280 Z" />

                                {/* Glúteos */}
                                <MusclePath name="Glutes" d="M 690 300 L 770 300 L 760 350 L 700 350 Z" />
                            </g>
                        </svg>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 flex gap-4 bg-gray-900/90 backdrop-blur border border-gray-700 py-2 px-4 rounded-full shadow-2xl z-50">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500/60 shadow-[0_0_10px_#22c55e]"></div><span className="text-[10px] md:text-xs font-bold text-gray-300 uppercase">Bien</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500/60 shadow-[0_0_10px_#eab308]"></div><span className="text-[10px] md:text-xs font-bold text-gray-300 uppercase">Recup</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500/60 shadow-[0_0_10px_#ef4444]"></div><span className="text-[10px] md:text-xs font-bold text-gray-300 uppercase">Agujetas</span></div>
            </div>
        </div>
    );
}