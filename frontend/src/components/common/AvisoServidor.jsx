import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useServidorStore } from '../../store/useServidorStore';

/**
 * Aviso de "el servidor está arrancando".
 *
 * El backend está en el plan gratuito de Render: se duerme a los ~15 min sin
 * uso y tarda 30-50 s en volver. Sin este aviso, esa espera se vive como una
 * app rota: pantallas vacías, contadores a cero y ningún motivo aparente.
 *
 * No acelera nada. Lo que arregla el arranque en frío es un cron externo que
 * llame a /api/cron/ping cada 10 minutos para que no llegue a dormirse.
 */
export default function AvisoServidor() {
    const despertando = useServidorStore(s => s.despertando);
    const [segundos, setSegundos] = useState(0);

    useEffect(() => {
        if (!despertando) { setSegundos(0); return; }
        const id = setInterval(() => setSegundos(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [despertando]);

    if (!despertando) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[300] safe-top pointer-events-none">
            <div className="mx-auto mt-2 w-[calc(100%-2rem)] max-w-sm bg-[#0a0a0c] border border-white/[0.07] rounded-[16px] px-4 py-2.5 flex items-center gap-3 overflow-hidden relative">
                <div
                    className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, #eab308, transparent)' }}
                />
                <Loader2 className="animate-spin shrink-0" size={16} style={{ color: '#eab308' }} />
                <div className="min-w-0">
                    <p className="text-[11px] font-black text-zinc-200 uppercase tracking-[0.12em] leading-none not-italic">
                        Arrancando el servidor
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-none mt-1.5">
                        Estaba en reposo. Suele tardar unos 30 s{segundos > 3 ? ` · ${segundos}s` : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}
