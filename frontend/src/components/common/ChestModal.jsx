import React, { useState, useEffect } from 'react';

export default function ChestModal({ isOpen, onClose, reward, chestType = 'wood', chestImage }) {
    const [animationState, setAnimationState] = useState('idle'); // idle, opening, revealed

    useEffect(() => {
        if (isOpen) setAnimationState('idle');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOpen = () => {
        if (animationState !== 'idle') return;
        setAnimationState('opening');

        // Simular tiempo de animación (1.5s de temblor) antes de mostrar premio
        setTimeout(() => {
            setAnimationState('revealed');
        }, 1500);
    };

    // Color de fondo para el premio según el tipo
    const chestColor = chestType === 'legendary' ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-amber-700 shadow-amber-900/50';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
            <div className="flex flex-col items-center relative">

                {/* --- FASE 1 & 2: EL COFRE (IMAGEN) --- */}
                {animationState !== 'revealed' && (
                    <div
                        onClick={handleOpen}
                        className={`
                            w-48 h-48 flex items-center justify-center cursor-pointer transition-transform relative z-20
                            ${animationState === 'idle' ? 'animate-bounce-slow hover:scale-105' : ''}
                            ${animationState === 'opening' ? 'animate-shake' : ''}
                        `}
                    >
                        {chestImage ? (
                            <img
                                src={chestImage}
                                alt="Cofre"
                                className="w-full h-full object-contain drop-shadow-2xl image-pixelated"
                            />
                        ) : (
                            <span className="text-8xl">📦</span>
                        )}
                    </div>
                )}

                {/* --- FASE 3: EL PREMIO --- */}
                {animationState === 'revealed' && reward && (
                    <div className="flex flex-col items-center animate-popIn relative z-30">
                        {/* Resplandor de fondo */}
                        <div className={`absolute inset-0 blur-3xl rounded-full z-0 opacity-50 ${chestType === 'legendary' ? 'bg-yellow-400' : 'bg-blue-400'}`}></div>

                        <div className="z-10 mb-6 drop-shadow-2xl">
                            {/* Si el premio es un ITEM, mostramos su icono. Si son monedas/xp, un emoji */}
                            {reward.type === 'item' && reward.icon ? (
                                <div className="w-32 h-32">
                                    <img src={reward.icon} alt="Premio" className="w-full h-full object-contain image-pixelated" />
                                </div>
                            ) : (
                                <div className="text-9xl">
                                    {reward.type === 'coins' && '💰'}
                                    {reward.type === 'xp' && '✨'}
                                </div>
                            )}
                        </div>

                        <h2 className="z-10 text-3xl font-black text-white uppercase tracking-widest drop-shadow-md mb-2">
                            {reward.type === 'item' ? '¡Objeto!' : '¡Recompensa!'}
                        </h2>

                        <div className={`z-10 text-xl font-bold px-8 py-3 rounded-full border-2 border-white/20 text-white shadow-xl ${chestColor}`}>
                            {reward.type === 'coins' && `+${reward.value} Monedas`}
                            {reward.type === 'xp' && `+${reward.value} XP`}
                            {reward.type === 'item' && reward.value}
                        </div>

                        <button
                            onClick={onClose}
                            className="z-10 mt-8 px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 hover:scale-105 transition-all shadow-lg active:scale-95"
                        >
                            RECOGER
                        </button>
                    </div>
                )}

                {/* Texto de instrucción */}
                {animationState === 'idle' && (
                    <p className="mt-4 text-white/80 font-bold animate-pulse uppercase tracking-widest text-sm">¡Toca para abrir!</p>
                )}
            </div>

            {/* Estilos CSS Inline */}
            <style>{`
                .image-pixelated { image-rendering: pixelated; }

                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
                .animate-shake { animation: shake 0.5s infinite; }
                
                @keyframes popIn {
                    0% { transform: scale(0.5); opacity: 0; }
                    60% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-popIn { animation: popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
            `}</style>
        </div>
    );
}