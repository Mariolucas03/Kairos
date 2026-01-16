import React from 'react';

export default function StreakWidget({ streak = 0 }) {
    const isSingular = streak === 1;

    // --- COLORES FLOW "FIRE" ---
    const gradientClasses = "from-red-700 via-orange-600 to-yellow-500";
    const textGradient = "from-red-600 via-orange-500 to-yellow-400";

    return (
        // Contenedor Principal con el Borde de Fuego
        <div className={`
            h-full w-full relative rounded-[32px] overflow-hidden
            group cursor-pointer active:scale-[0.98] transition-all duration-200
            p-[2px] 
            bg-gradient-to-tr ${gradientClasses}
            shadow-[0_0_20px_rgba(234,88,12,0.3)]
        `}>
            {/* Contenedor Interior (Fondo Negro) */}
            <div className="h-full w-full bg-zinc-950 rounded-[30px] p-5 relative overflow-hidden flex flex-col justify-between z-10">

                {/* --- CABECERA --- */}
                <div className="flex justify-start w-full relative z-20 pt-1">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                        RACHA
                    </h3>
                </div>

                {/* --- CONTENIDO CENTRAL: NÚMERO MÁS GRANDE Y DESPLAZADO A LA DERECHA --- */}
                <div className="flex-1 flex items-center justify-center relative z-20 pb-4">
                    {/* ml-6 para mover el bloque un poco a la derecha */}
                    <div className="flex items-baseline gap-2 animate-in zoom-in duration-300 ml-6">
                        {/* NÚMERO RECTO MÁS GRANDE (text-8xl) */}
                        <span className={`text-8xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-t ${textGradient} drop-shadow-md not-italic`}>
                            {streak}
                        </span>
                        {/* UNIDAD RECTA Y BLANCA */}
                        <span className="text-2xl font-black uppercase text-white tracking-tighter not-italic">
                            {isSingular ? 'DÍA' : 'DÍAS'}
                        </span>
                    </div>
                </div>

                {/* --- BARRA INFERIOR ARDIENTE --- */}
                <div className="absolute bottom-0 left-0 w-full h-3 z-10">
                    <div
                        className={`h-full bg-gradient-to-r ${gradientClasses} shadow-[0_-4px_15px_rgba(220,38,38,0.6)]`}
                        style={{ width: '100%' }}
                    ></div>
                </div>

                {/* Luz de fondo ambiental */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-tr from-red-600/20 to-orange-600/20 rounded-full blur-3xl pointer-events-none z-0"></div>
            </div>
        </div>
    );
}