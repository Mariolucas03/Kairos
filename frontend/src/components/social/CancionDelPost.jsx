import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { haySonido, cambiarSonido, suscribirseAlSonido } from '../../utils/sonidoDelFeed';

/**
 * LA CANCIÓN DE UNA PUBLICACIÓN.
 *
 * Suena sola al llegar a ella, como en Instagram, y se corta al pasar de largo.
 * El altavoz silencia TODO el feed de una vez, no solo esta.
 *
 * ⚠️ EMPIEZA SILENCIADO Y LO PRIMERO QUE HACES ES ENCENDERLO.
 *
 * No es un capricho: los navegadores bloquean el sonido hasta que has tocado la
 * pantalla, y con razón — una app que se pone a sonar sola en el metro es una
 * app que se desinstala. Pero en cuanto le das al altavoz una vez, esa es la
 * autorización: a partir de ahí las siguientes suenan solas al pasar por ellas,
 * sin volver a tocar nada. Exactamente el comportamiento de Instagram.
 *
 * ⚠️ SOLO SUENA LA QUE MÁS SE VE.
 *
 * Con IntersectionObserver a secas, tres tarjetas a la vez en pantalla eran tres
 * canciones sonando encima. Se avisan entre ellas: al arrancar una, las demás
 * se paran.
 */
const AVISO = 'kairos:cancion-sonando';

// Cuánto tiene que verse la tarjeta para que arranque. La mitad: con menos, al
// bajar rápido se disparan y se cortan cinco canciones seguidas, que suena a
// avería.
const VISIBLE_MINIMO = 0.55;

export default function CancionDelPost({ cancion }) {
    const conSonido = useSyncExternalStore(suscribirseAlSonido, haySonido, () => false);

    const [sonando, setSonando] = useState(false);
    const caja = useRef(null);
    const audio = useRef(null);
    const mio = useRef(Symbol('reproductor'));
    // Si está a la vista ahora mismo. Se guarda en una ref además del estado
    // porque lo consultan los efectos, y con el estado leerían el valor viejo.
    const aLaVista = useRef(false);

    const parar = () => {
        if (audio.current) { audio.current.pause(); audio.current = null; }
        setSonando(false);
    };

    /**
     * Pausa PERO NO TIRA el reproductor.
     *
     * La diferencia con `parar` es lo que pasa al volver: aquí se conserva el
     * segundo por el que iba, para retomarla donde estaba en vez de empezar de
     * cero. `parar` es para cuando la canción ya no pinta nada (te fuiste de la
     * publicación); esto es para cuando vuelves enseguida.
     */
    const pausar = () => {
        if (audio.current) audio.current.pause();
        setSonando(false);
    };

    const arrancar = () => {
        if (!cancion?.preview || audio.current) return;

        window.dispatchEvent(new CustomEvent(AVISO, { detail: mio.current }));

        const desde = Number(cancion.desde) || 0;

        const a = new Audio(cancion.preview);
        a.volume = 0.7;
        a.currentTime = desde;

        // ⚠️ Se repite A MANO, no con `loop`.
        //
        // Con `a.loop = true` el navegador vuelve al SEGUNDO CERO, no al trozo
        // elegido: quien hubiera puesto el estribillo en el segundo 15 lo oiría
        // una vez y luego la intro para siempre. Se vuelve al punto elegido.
        a.loop = false;
        a.onended = () => { a.currentTime = desde; a.play().catch(() => setSonando(false)); };
        a.onerror = () => setSonando(false);
        a.play().then(() => setSonando(true)).catch(() => {
            // El navegador aún no da permiso (no has tocado nada todavía).
            // No se insiste: en cuanto le des al altavoz, arranca.
            audio.current = null;
            setSonando(false);
        });
        audio.current = a;
    };

    // --- QUIÉN ESTÁ A LA VISTA ---
    useEffect(() => {
        const nodo = caja.current;
        if (!nodo || !cancion?.preview) return;

        const vigilante = new IntersectionObserver(([e]) => {
            aLaVista.current = e.isIntersecting && e.intersectionRatio >= VISIBLE_MINIMO;
            if (aLaVista.current && haySonido()) arrancar();
            else if (!aLaVista.current) parar();
        }, { threshold: [0, VISIBLE_MINIMO, 1] });

        vigilante.observe(nodo);
        return () => vigilante.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancion?.preview]);

    // --- EL INTERRUPTOR GENERAL ---
    useEffect(() => {
        if (conSonido && aLaVista.current) arrancar();
        if (!conSonido) parar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conSonido]);

    // --- QUE NO SUENEN DOS ---
    useEffect(() => {
        const alSonarOtra = (e) => { if (e.detail !== mio.current) parar(); };
        window.addEventListener(AVISO, alSonarOtra);
        // Y al salir de la pantalla se corta: nada peor que una canción sonando
        // desde una tarjeta que ya no está.
        return () => { window.removeEventListener(AVISO, alSonarOtra); parar(); };
    }, []);

    // --- AL SALIR DE LA APP ---
    //
    // ⚠️ NINGUNA DE LAS OTRAS TRES FORMAS DE PARAR SE DISPARA AQUÍ.
    //
    // Al cambiar de app, bloquear el móvil o cerrar la pestaña: el componente no
    // se desmonta, la tarjeta no se sale de la pantalla (no has hecho scroll) y
    // no arranca ninguna otra. Así que la canción seguía sonando desde una app
    // que ya no estabas mirando, y solo se callaba matando Kairos a mano.
    //
    // Los navegadores dejan seguir sonando a propósito —lo necesitan Spotify y
    // los pódcast— pero eso vale para una app de música, no para un feed.
    //
    // Se PAUSA, no se corta: al volver retoma donde iba, y solo si sigues en la
    // publicación y con el sonido puesto.
    useEffect(() => {
        const alCambiarDeApp = () => {
            if (document.hidden) { pausar(); return; }
            if (aLaVista.current && haySonido() && audio.current) {
                audio.current.play().then(() => setSonando(true)).catch(() => setSonando(false));
            }
        };

        document.addEventListener('visibilitychange', alCambiarDeApp);
        // `pagehide` es la red de seguridad de iOS: al cerrar la pestaña o
        // navegar fuera no siempre llega a dispararse `visibilitychange`.
        window.addEventListener('pagehide', pausar);

        return () => {
            document.removeEventListener('visibilitychange', alCambiarDeApp);
            window.removeEventListener('pagehide', pausar);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!cancion?.preview) return null;

    return (
        <div ref={caja} className="flex items-center gap-2.5 px-4 pb-2">
            <button
                type="button"
                onClick={() => cambiarSonido(!conSonido)}
                aria-label={conSonido ? 'Silenciar el feed' : 'Activar el sonido del feed'}
                aria-pressed={conSonido}
                className={`relative w-8 h-8 shrink-0 rounded-lg overflow-hidden active:scale-90 transition-transform ${sonando ? 'ring-1 ring-yellow-500/60' : ''}`}
            >
                {cancion.caratula
                    ? <img src={cancion.caratula} alt="" className="w-full h-full object-cover" />
                    : <span className="w-full h-full bg-zinc-900 flex items-center justify-center"><Music size={13} className="text-zinc-600" /></span>}
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                    {conSonido ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </span>
            </button>

            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-zinc-300 truncate leading-tight">
                    {cancion.titulo}
                    <span className="text-zinc-600"> · {cancion.artista}</span>
                </p>
                {/* Se dice UNA vez lo que hay que hacer. Sin esto, el altavoz
                    tachado sobre una carátula no se lee como "toca aquí para
                    oírla": se lee como un icono decorativo. */}
                {!conSonido && (
                    <p className="text-[9px] text-zinc-600 font-bold leading-tight">
                        Toca para escucharla
                    </p>
                )}
            </div>

            {/* Las barritas solo se mueven mientras suena de verdad: es el aviso
                de que el sonido sale de AQUÍ y no de otra pestaña. */}
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
