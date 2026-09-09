import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../services/api';
import WorkoutPostCard from '../../components/social/WorkoutPostCard';

/**
 * UNA PUBLICACIÓN SOLA.
 *
 * ⚠️ ES A DONDE FALTABA QUE LLEVARAN LAS NOTIFICACIONES.
 *
 * Pulsar "Fulano ha comentado tu entreno" en el buzón te llevaba al perfil de
 * Fulano: a la persona, no al comentario. Y el aviso del móvil dejaba en
 * `/social`, o sea en el feed entero, a buscarlo bajando. El dato estaba
 * guardado desde el principio —la notificación siempre supo de qué entreno
 * hablaba— y no se usaba.
 *
 * Se reutiliza la MISMA tarjeta del feed: los me gusta, los comentarios y el
 * carrusel funcionan igual aquí que allí, y una segunda versión de la tarjeta
 * sería una segunda versión que mantener.
 */
export default function PublicacionPage() {
    const { workoutId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get(`/social/workout/${workoutId}`);
            setPost(res.data);
            setError(null);
        } catch (e) {
            // El servidor devuelve 404 tanto si no existe como si no puedes
            // verla —un 403 confirmaría que existe, y eso ya es información
            // sobre una cuenta privada—. Aquí se dice lo mismo en los dos casos.
            setError(e?.response?.status === 404
                ? 'Esta publicación ya no está disponible.'
                : 'No se pudo cargar. Inténtalo otra vez.');
        } finally {
            setCargando(false);
        }
    }, [workoutId]);

    useEffect(() => { cargar(); }, [cargar]);

    return (
        <div className="pt-safe-page pb-24">
            <div className="flex items-center gap-3 px-1 mb-4">
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Volver"
                    className="w-10 h-10 rounded-2xl bg-zinc-900 border border-white/[0.07] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform"
                >
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-white font-black text-lg uppercase tracking-tight not-italic">
                    Publicación
                </h1>
            </div>

            {cargando && (
                <div className="flex items-center justify-center py-20 text-zinc-600">
                    <Loader2 size={22} className="animate-spin" />
                </div>
            )}

            {!cargando && error && (
                <div className="text-center py-16 px-8 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <p className="text-[12px] text-zinc-500 font-bold leading-snug">{error}</p>
                    <button
                        onClick={() => navigate('/social')}
                        className="mt-4 text-[11px] font-black text-yellow-500 uppercase tracking-widest"
                    >
                        Ir al feed
                    </button>
                </div>
            )}

            {!cargando && post && (
                <WorkoutPostCard
                    post={post}
                    // Si la borras desde aquí no queda nada que mirar.
                    onBorrado={() => navigate('/social')}
                />
            )}
        </div>
    );
}
