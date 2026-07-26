import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Cabecera común de las subpáginas de la sección social (Amigos, Clanes, Ranking, Perfil)
export default function SocialSubHeader({ title, subtitle, icon: Icon, accent = 'text-yellow-500', right = null }) {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-3 mb-6">
            <button
                onClick={() => navigate('/social')}
                className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 hover:text-white active:scale-95 transition-all shrink-0"
                aria-label="Volver al feed"
            >
                <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2 truncate">
                    {Icon && <Icon size={20} className={accent} />} {title}
                </h1>
                {subtitle && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{subtitle}</p>}
            </div>
            {right}
        </div>
    );
}
