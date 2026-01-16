import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';

export default function IosInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // 1. Detectar si es iOS (iPhone, iPad)
        const isIOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;

        // 2. Detectar si YA está instalada (Modo Standalone)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        // 3. Solo mostrar si es iOS y NO está instalada
        if (isIOS && !isStandalone) {
            // Esperamos 3 segundos para no ser intrusivos nada más entrar
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[100] bg-zinc-900/95 backdrop-blur-md border border-yellow-500/30 p-5 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-700">
            <button
                onClick={() => setShowPrompt(false)}
                className="absolute top-2 right-2 text-zinc-500 hover:text-white bg-black/20 p-1 rounded-full"
            >
                <X size={16} />
            </button>

            <div className="flex gap-4">
                <div className="bg-black w-12 h-12 rounded-xl flex items-center justify-center border border-zinc-800 shrink-0">
                    <span className="text-2xl">🔥</span>
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide">Instalar App</h3>
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                        Para la mejor experiencia RPG, añade esta app a tu inicio.
                    </p>
                </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-zinc-300 font-medium">
                <div className="flex items-center gap-3">
                    <span className="bg-zinc-800 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black">1</span>
                    <span>Toca el botón <Share size={14} className="inline mx-1 text-blue-400" /> en la barra inferior.</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-zinc-800 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black">2</span>
                    <span>Selecciona <span className="text-white font-bold">"Añadir a pantalla de inicio"</span>.</span>
                </div>
            </div>

            {/* Flechita apuntando abajo (hacia la barra de safari) */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-b border-r border-yellow-500/30 rotate-45"></div>
        </div>
    );
}