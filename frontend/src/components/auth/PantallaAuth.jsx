import { Check } from 'lucide-react';

/**
 * CHASIS DE LAS PANTALLAS DE ACCESO.
 *
 * Login y registro eran dos ficheros con la misma pantalla copiada y un color
 * distinto: cualquier retoque había que hacerlo dos veces, y se acababan
 * separando. Aquí vive lo que comparten —el fondo, la marca, la tarjeta, el
 * error y la confirmación— y cada pantalla pone solo su formulario.
 *
 * El color entra por la variable --acento, así que las animaciones del CSS
 * valen para las dos sin duplicar ni una regla.
 *
 * Las animaciones son CSS puro a propósito: son las dos primeras pantallas que
 * ve alguien, y cargar una librería para moverlas retrasaría justo lo que hay
 * que enseñar rápido.
 */
export default function PantallaAuth({
    acento,
    icono: Icono,
    titulo,
    subtitulo,
    tarjetaIcono: TarjetaIcono,
    tarjetaTitulo,
    error,
    exito,
    children,
    pie
}) {
    return (
        <div
            className="relative min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10 select-none overflow-hidden"
            style={{ '--acento': acento }}
        >
            {/* ── FONDO VIVO ────────────────────────────────────────────────
                Tres manchas a la deriva y una rejilla que baja. Va detrás de
                todo y sin capturar toques (pointer-events: none en el CSS). */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div
                    className="auth-mancha auth-mancha-a w-[70vw] h-[70vw] max-w-[420px] max-h-[420px] -top-[12vh] -left-[18vw]"
                    style={{ background: acento, opacity: 0.14 }}
                />
                <div
                    className="auth-mancha auth-mancha-b w-[60vw] h-[60vw] max-w-[360px] max-h-[360px] top-[45vh] -right-[16vw]"
                    style={{ background: acento, opacity: 0.1 }}
                />
                <div
                    className="auth-mancha auth-mancha-c w-[55vw] h-[55vw] max-w-[320px] max-h-[320px] -bottom-[10vh] left-[10vw]"
                    style={{ background: '#ffffff', opacity: 0.035 }}
                />
                <div className="auth-rejilla" />
                {/* Oscurece los bordes para que el texto del centro siempre
                    tenga contraste, se muevan las manchas donde se muevan. */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.85)_100%)]" />
            </div>

            <div className="relative z-10 w-full max-w-sm">

                {/* ── MARCA ─────────────────────────────────────────────── */}
                <div className="flex flex-col items-center mb-9">
                    <div className="relative auth-entra" style={{ animationDelay: '0.05s' }}>
                        {/* Halo que late por detrás del emblema */}
                        <div
                            className="auth-late absolute inset-0 rounded-[20px] blur-xl"
                            style={{ background: acento }}
                            aria-hidden="true"
                        />
                        <div
                            className="auth-flota relative w-16 h-16 rounded-[20px] flex items-center justify-center border"
                            style={{ background: 'rgba(255,255,255,0.04)', borderColor: acento + '4d' }}
                        >
                            <Icono size={30} style={{ color: acento }} />
                        </div>
                    </div>

                    <h1
                        className="auth-entra mt-5 text-[40px] font-black text-white tracking-[-0.055em] leading-none not-italic"
                        style={{ animationDelay: '0.13s' }}
                    >
                        {titulo}
                    </h1>
                    <p
                        className="auth-entra mt-3 text-[9px] font-black text-zinc-500 uppercase tracking-[0.24em] not-italic"
                        style={{ animationDelay: '0.19s' }}
                    >
                        {subtitulo}
                    </p>
                </div>

                {/* ── TARJETA ───────────────────────────────────────────── */}
                <div
                    className="auth-entra relative bg-[#0a0a0c]/90 backdrop-blur-xl border border-white/[0.08] rounded-[28px] p-6 overflow-hidden shadow-2xl shadow-black/60"
                    style={{ animationDelay: '0.25s' }}
                >
                    <div
                        className="absolute top-0 left-0 w-full h-[2px] pointer-events-none"
                        style={{ background: `linear-gradient(90deg, ${acento}, transparent)` }}
                    />
                    <div
                        className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.13] pointer-events-none"
                        style={{ background: acento }}
                    />

                    {/* CONFIRMACIÓN — sustituye al formulario al entrar bien.
                        Sin esto, acertar la contraseña y equivocarse se sentían
                        igual: la pantalla se quedaba quieta hasta que cargaba la
                        siguiente, que en Render dormido son treinta segundos. */}
                    {exito ? (
                        <div className="relative z-10 py-10 flex flex-col items-center text-center">
                            <div
                                className="auth-sello w-16 h-16 rounded-full flex items-center justify-center border-2"
                                style={{ background: acento + '1f', borderColor: acento }}
                            >
                                <Check size={30} strokeWidth={3.5} style={{ color: acento }} />
                            </div>
                            <p className="mt-4 text-white font-black uppercase tracking-[0.14em] text-sm not-italic">
                                {exito}
                            </p>
                            <p className="mt-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                Entrando...
                            </p>
                        </div>
                    ) : (
                        <>
                            <h2 className="relative z-10 text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] flex items-center gap-2 mb-6 not-italic">
                                <TarjetaIcono size={16} style={{ color: acento }} /> {tarjetaTitulo}
                            </h2>

                            {error && (
                                <div
                                    key={error}
                                    className="auth-tiembla relative z-10 mb-5 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-400 text-[11px] font-bold text-center not-italic"
                                >
                                    {error}
                                </div>
                            )}

                            <div className="relative z-10">{children}</div>
                        </>
                    )}
                </div>

                {/* ── PIE ───────────────────────────────────────────────── */}
                {!exito && (
                    <div className="auth-entra mt-7 text-center" style={{ animationDelay: '0.33s' }}>
                        {pie}
                    </div>
                )}
            </div>
        </div>
    );
}
