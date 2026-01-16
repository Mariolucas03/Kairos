import React from 'react';
import { Trophy, Heart, Coins, Gamepad2, Zap } from 'lucide-react';

export default function LevelWidget({
    level = 12,
    coins = 1450,
    secondaryCoins = 320,
    lives = 5,
    currentXp = 750,
    requiredXp = 1000
}) {
    const xpPercentage = Math.min((currentXp / requiredXp) * 100, 100);

    return (
        <div className="
            h-full w-full relative overflow-hidden rounded-[32px]
            bg-zinc-900 p-5
            flex flex-col justify-between cursor-pointer
            border-2 border-zinc-800 hover:border-zinc-700 transition-all duration-200
            shadow-lg
        ">

            {/* --- CABECERA: NIVEL (Izq) vs VIDAS (Der) --- */}
            {/* Usamos 'items-center' para que queden perfectamente alineados horizontalmente */}
            <div className="flex justify-between items-center w-full relative z-20">

                {/* Izquierda: Nivel + Copa (Color Bronce/Ambar) */}
                <div className="flex items-center gap-1.5">
                    <Trophy size={16} className="text-amber-500 fill-amber-500/20" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
                        NIVEL {level}
                    </h3>
                </div>

                {/* Derecha: Corazón + Vidas (Color Rojo) */}
                {/* Contenedor tipo 'píldora' para resaltarlo */}
                <div className="flex items-center gap-1.5 bg-red-500/20 px-2.5 py-1 rounded-full">
                    <Heart size={14} className="text-red-500 fill-red-500" />
                    {/* Número blanco para contraste máximo */}
                    <span className="text-sm font-black text-white leading-none pt-[1px]">
                        {lives}
                    </span>
                </div>
            </div>

            {/* --- CONTENIDO CENTRAL: MONEDAS Y GEMAS --- */}
            {/* 'flex-1' y 'justify-center' para que ocupe el espacio central */}
            <div className="flex-1 flex flex-col justify-center relative z-20 gap-2 py-2">

                {/* 1. PRINCIPAL (Monedas Amarillas) */}
                <div className="flex items-center gap-3">
                    {/* Número Gigante Blanco */}
                    <span className="text-5xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
                        {coins}
                    </span>
                    {/* Icono Monedas en círculo */}
                    <div className="bg-yellow-500/20 p-2 rounded-full border border-yellow-500/30">
                        <Coins size={22} className="text-yellow-400 fill-yellow-400" />
                    </div>
                </div>

                {/* 2. SECUNDARIO (Gemas/Mando Morado) - Perfectamente alineado debajo */}
                <div className="flex items-center gap-2 pl-1 opacity-90">
                    {/* Icono Mando Morado */}
                    <Gamepad2 size={18} className="text-purple-400" />
                    {/* Número Morado Claro */}
                    <span className="text-xl font-bold text-purple-300 tracking-tight leading-none">
                        {secondaryCoins}
                    </span>
                </div>
            </div>

            {/* --- FOOTER: BARRA XP (Azul) --- */}
            <div className="relative z-20 w-full">

                {/* Etiquetas: XP e indicadores numéricos */}
                <div className="flex justify-between items-end mb-1.5 text-[10px] font-bold uppercase">
                    <div className="flex items-center gap-1 text-blue-400">
                        <Zap size={12} className="fill-blue-400" />
                        <span>XP Progress</span>
                    </div>
                    <span className="text-zinc-500">
                        {currentXp} / {requiredXp}
                    </span>
                </div>

                {/* Barra de Progreso */}
                <div className="h-2.5 w-full bg-zinc-800/80 rounded-full overflow-hidden p-[2px]">
                    <div
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-500 ease-out"
                        style={{ width: `${xpPercentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}