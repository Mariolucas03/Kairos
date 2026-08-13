import { useEffect, useState } from 'react';

/**
 * Animación mientras la IA analiza la foto.
 *
 * Existe porque analizar tarda entre 3 y 10 segundos y antes no pasaba
 * absolutamente nada en pantalla: te quedabas mirando sin saber si se había
 * colgado. Aquí ves la foto con una línea de escáner recorriéndola y un texto
 * que va contando en qué punto va.
 */
const PASOS = [
    'Leyendo la foto...',
    'Identificando el plato...',
    'Estimando la ración...',
    'Calculando proteína, hidratos y grasa...',
    'Cuadrando las calorías...',
    'Casi está...'
];

export default function ScanAnimation({ preview }) {
    const [paso, setPaso] = useState(0);

    useEffect(() => {
        // Se queda clavado en el último para no dar la sensación de bucle
        const id = setInterval(() => setPaso(p => Math.min(p + 1, PASOS.length - 1)), 1800);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-6 animate-in fade-in">
            <div className="relative w-48 h-48 rounded-3xl overflow-hidden border border-blue-500/30 bg-black">
                {preview && <img src={preview} alt="" className="w-full h-full object-cover opacity-70" />}

                {/* Línea de escáner */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_18px_#60a5fa] animate-[escaneo_2s_ease-in-out_infinite]" />

                {/* Esquinas de mira */}
                {[
                    'top-2 left-2 border-t-2 border-l-2 rounded-tl-lg',
                    'top-2 right-2 border-t-2 border-r-2 rounded-tr-lg',
                    'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-lg',
                    'bottom-2 right-2 border-b-2 border-r-2 rounded-br-lg'
                ].map((c, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-blue-400/70 ${c}`} />
                ))}
            </div>

            <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mt-5 text-center px-6 min-h-[16px] animate-in fade-in" key={paso}>
                {PASOS[paso]}
            </p>

            {/* Puntitos de avance */}
            <div className="flex gap-1.5 mt-3">
                {PASOS.map((_, i) => (
                    <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= paso ? 'bg-blue-400 w-4' : 'bg-zinc-800 w-1.5'}`} />
                ))}
            </div>

            <style>{`
                @keyframes escaneo {
                    0%   { top: 4%;  opacity: 0.2; }
                    50%  { top: 92%; opacity: 1; }
                    100% { top: 4%;  opacity: 0.2; }
                }
            `}</style>
        </div>
    );
}
