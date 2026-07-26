import BackButton from '../common/BackButton';

// Cabecera común de las subpáginas de la sección social (Amigos, Clanes, Ranking, Perfil)
export default function SocialSubHeader({ title, subtitle, icon: Icon, accent = 'text-yellow-500', right = null }) {
    return (
        <div className="flex items-center gap-3 mb-6">
            <BackButton to="/social" />
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
