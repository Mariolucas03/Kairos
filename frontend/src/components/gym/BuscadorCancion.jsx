import { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Pause, Music } from 'lucide-react';
import api from '../../services/api';

/**
 * LA CANCIÓN DEL ENTRENO.
 *
 * Como en las publicaciones de Instagram: eliges una canción al terminar y suena
 * en el post que ven tus amigos.
 *
 * ⚠️ NO SE SUBE NINGÚN AUDIO A KAIROS.
 *
 * Se guardan solo los datos —título, artista, carátula— y el ENLACE al fichero
 * de 30 segundos que aloja Apple, que es el mismo que suena al darle a probar en
 * cualquier tienda de música. Reproducirlo así es legal y no cuesta ni
 * almacenamiento ni derechos; subir un mp3 sería piratería y además llenaría el
 * plan gratuito de Render en una semana.
 *
 * Los 30 segundos son el límite de la vista previa, no una decisión nuestra. Da
 * de sobra para un post: en Instagram tampoco suena la canción entera.
 */

// Lo que se espera desde que dejas de teclear hasta que se busca. Sin esto,
// escribir "eye of the tiger" son 17 peticiones y 16 se tiran a la basura.
const ESPERA_MS = 400;

export default function BuscadorCancion({ cancion, onElegir }) {
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [error, setError] = useState(null);

    // Cuál se está oyendo, y el <audio> que la reproduce. Uno solo para todas:
    // dos canciones sonando a la vez es lo primero que pasa si cada fila lleva
    // el suyo.
    const [sonando, setSonando] = useState(null);
    const audio = useRef(null);

    useEffect(() => {
        // Al desmontarse se corta el sonido. Sin esto, cerrar el resumen del
        // entreno deja la canción sonando desde ninguna parte.
        return () => { if (audio.current) { audio.current.pause(); audio.current = null; } };
    }, []);

    useEffect(() => {
        const q = texto.trim();
        if (q.length < 2) { setResultados([]); setBuscando(false); return; }

        setBuscando(true);
        const id = setTimeout(async () => {
            try {
                const res = await api.get('/gym/musica', { params: { q } });
                setResultados(res.data?.canciones || []);
                setError(res.data?.error || null);
            } catch {
                setResultados([]);
                setError('No se pudo buscar ahora mismo');
            } finally {
                setBuscando(false);
            }
        }, ESPERA_MS);

        return () => clearTimeout(id);
    }, [texto]);

    const probar = (c) => {
        if (audio.current) { audio.current.pause(); audio.current = null; }

        if (sonando === c.id) { setSonando(null); return; }

        const a = new Audio(c.preview);
        a.volume = 0.7;
        a.onended = () => setSonando(null);
        // Si el navegador se niega a reproducir (sin gesto, o el fichero no
        // carga) no se deja el botón en "pausa" para siempre.
        a.play().catch(() => setSonando(null));
        audio.current = a;
        setSonando(c.id);
    };

    const elegir = (c) => {
        if (audio.current) { audio.current.pause(); audio.current = null; }
        setSonando(null);
        onElegir(c);
        setAbierto(false);
        setTexto('');
        setResultados([]);
    };

    const quitar = () => {
        if (audio.current) { audio.current.pause(); audio.current = null; }
        setSonando(null);
        onElegir(null);
    };

    // --- YA HAY UNA ELEGIDA ---
    if (cancion && !abierto) {
        return (
            <div className="flex items-center gap-3 bg-black border border-white/[0.08] rounded-2xl p-2.5">
                {cancion.caratula && (
                    <img src={cancion.caratula} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-white truncate leading-tight not-italic">
                        {cancion.titulo}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold truncate">{cancion.artista}</p>
                </div>
                <button
                    type="button"
                    onClick={() => probar(cancion)}
                    aria-label={sonando === cancion.id ? 'Parar' : 'Escuchar'}
                    className="w-9 h-9 shrink-0 rounded-xl bg-zinc-900 border border-white/[0.06] text-white flex items-center justify-center active:scale-90 transition-transform"
                >
                    {sonando === cancion.id ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>
                <button
                    type="button"
                    onClick={quitar}
                    aria-label="Quitar la canción"
                    className="w-9 h-9 shrink-0 rounded-xl text-zinc-600 hover:text-red-400 flex items-center justify-center active:scale-90 transition-transform"
                >
                    <X size={16} />
                </button>
            </div>
        );
    }

    // --- SIN CANCIÓN, SIN ABRIR ---
    if (!abierto) {
        return (
            <button
                type="button"
                onClick={() => setAbierto(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-black border border-dashed border-white/[0.12] rounded-2xl text-zinc-500 hover:text-white hover:border-white/25 transition-colors"
            >
                <Music size={15} />
                <span className="text-[11px] font-black uppercase tracking-widest">Elegir canción</span>
            </button>
        );
    }

    // --- BUSCANDO ---
    return (
        <div className="bg-black border border-white/[0.08] rounded-2xl p-2.5">
            <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-xl px-3">
                    <Search size={14} className="text-zinc-500 shrink-0" />
                    <input
                        autoFocus
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Título o artista..."
                        aria-label="Buscar una canción"
                        className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-white outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => { setAbierto(false); setTexto(''); }}
                    aria-label="Cerrar el buscador"
                    className="w-9 h-9 shrink-0 rounded-xl bg-zinc-900 border border-white/[0.06] text-zinc-400 flex items-center justify-center active:scale-90"
                >
                    <X size={16} />
                </button>
            </div>

            {buscando && (
                <p className="text-[10px] text-zinc-600 font-bold text-center py-4 uppercase tracking-widest animate-pulse">
                    Buscando...
                </p>
            )}

            {!buscando && error && (
                <p className="text-[10px] text-orange-400 font-bold text-center py-4">{error}</p>
            )}

            {!buscando && !error && texto.trim().length >= 2 && resultados.length === 0 && (
                <p className="text-[10px] text-zinc-600 font-bold text-center py-4">
                    Nada con ese nombre.
                </p>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1">
                {resultados.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.04]">
                        {/* La carátula ES el botón de escuchar: es donde va el dedo
                            de todas formas, y ahorra un botón por fila. */}
                        <button
                            type="button"
                            onClick={() => probar(c)}
                            aria-label={sonando === c.id ? `Parar ${c.titulo}` : `Escuchar ${c.titulo}`}
                            className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden active:scale-90 transition-transform"
                        >
                            <img src={c.caratula} alt="" className="w-full h-full object-cover" />
                            <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white">
                                {sonando === c.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => elegir(c)}
                            className="min-w-0 flex-1 text-left"
                        >
                            <p className="text-[12px] font-black text-white truncate leading-tight not-italic">{c.titulo}</p>
                            <p className="text-[10px] text-zinc-500 font-bold truncate">{c.artista}</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => elegir(c)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500 text-black text-[10px] font-black uppercase tracking-wider active:scale-90 transition-transform"
                        >
                            Poner
                        </button>
                    </div>
                ))}
            </div>

            <p className="text-[9px] text-zinc-600 font-bold text-center pt-2 leading-snug">
                Sonarán 30 segundos en tu publicación. Música de Apple Music.
            </p>
        </div>
    );
}
