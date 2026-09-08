import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';

/**
 * LA CANCIÓN DE UNA PUBLICACIÓN.
 *
 * ⚠️ NO SUENA SOLA AL PASAR POR ENCIMA, COMO EN INSTAGRAM.
 *
 * Y no es que no se pueda: es que no se debe. Los navegadores bloquean el audio
 * automático precisamente porque una web que se pone a sonar sola es una web que
 * se cierra — y una app que lo hace en el metro es una app que se desinstala.
 * Hay botón de play, y suena cuando tú lo dices.
 *
 * ⚠️ SOLO PUEDE SONAR UNA A LA VEZ EN TODO EL FEED.
 *
 * Cada tarjeta tiene su propio reproductor, así que sin coordinación bastaba con
 * bajar y dar a play en dos posts para tener dos canciones solapadas. Se avisan
 * entre ellas con un evento del navegador: al empezar una, las demás se paran.
 * Un `<audio>` compartido en un contexto de React sería más "correcto" y mucho
 * más código para el mismo resultado.
 */
const AVISO = 'kairos:cancion-sonando';

export default function CancionDelPost({ cancion }) {
    const [sonando, setSonando] = useState(false);
    const audio = useRef(null);
    const mio = useRef(Symbol('reproductor'));

    const parar = () => {
        if (audio.current) { audio.current.pause(); audio.current = null; }
        setSonando(false);
    };

    useEffect(() => {
        const alSonarOtra = (e) => { if (e.detail !== mio.current) parar(); };
        window.addEventListener(AVISO, alSonarOtra);
        // Y al salir de la pantalla se corta: nada peor que una canción sonando
        // desde una tarjeta que ya no está.
        return () => { window.removeEventListener(AVISO, alSonarOtra); parar(); };
    }, []);

    if (!cancion?.preview) return null;

    const alternar = () => {
        if (sonando) { parar(); return; }

        window.dispatchEvent(new CustomEvent(AVISO, { detail: mio.current }));

        const a = new Audio(cancion.preview);
        a.volume = 0.7;
        a.onended = () => setSonando(false);
        a.play().catch(() => setSonando(false));
        audio.current = a;
        setSonando(true);
    };

    return (
        <div className="flex items-center gap-2.5 px-4 pb-2">
            <button
                type="button"
                onClick={alternar}
                aria-label={sonando ? `Parar ${cancion.titulo}` : `Escuchar ${cancion.titulo}`}
                className="relative w-8 h-8 shrink-0 rounded-lg overflow-hidden active:scale-90 transition-transform"
            >
                {cancion.caratula
                    ? <img src={cancion.caratula} alt="" className="w-full h-full object-cover" />
                    : <span className="w-full h-full bg-zinc-900 flex items-center justify-center"><Music size={13} className="text-zinc-600" /></span>}
                <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white">
                    {sonando ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                </span>
            </button>

            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-zinc-300 truncate leading-tight">
                    {cancion.titulo}
                    <span className="text-zinc-600"> · {cancion.artista}</span>
                </p>
            </div>

            {/* Las barritas solo se mueven mientras suena: es el aviso de que el
                sonido sale de AQUI y no de otra pestaña. */}
            {sonando && (
                <div className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden="true">
                    <style>{`@keyframes kairosOnda { 0%,100% { height: 25%; } 50% { height: 100%; } }`}</style>
                    {[0, 0.15, 0.3].map(r => (
                        <span
                            key={r}
                            className="w-[3px] bg-yellow-500 rounded-full"
                            style={{ animation: `kairosOnda 0.7s ease-in-out ${r}s infinite` }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
