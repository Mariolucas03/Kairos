import { Check } from 'lucide-react';

/**
 * CHASIS DE LAS PANTALLAS DE ACCESO.
 *
 * Login y registro comparten esto: fondo negro, el emblema, el titulo, el
 * error y la confirmacion. Cada pantalla pone solo su formulario.
 *
 * Es deliberadamente sencillo: son las dos primeras pantallas que ve alguien
 * y lo que tienen que hacer es dejarle entrar rapido, no impresionarle.
 */
export default function PantallaAuth({
    acento,
    icono: Icono,
    titulo,
    subtitulo,
    error,
    exito,
    children,
    pie
}) {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10 select-none">
            <div className="auth-entra w-full max-w-sm">

                {/* ── EMBLEMA Y TITULO ────────────────────────────────── */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center border"
                        style={{ borderColor: acento + '55', background: acento + '14' }}
                    >
                        <Icono size={26} style={{ color: acento }} />
                    </div>
                    <p className="mt-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.28em] not-italic">
                        Kairos
                    </p>
                    <h1 className="mt-1.5 text-[28px] font-black text-white tracking-tight leading-none not-italic">
                        {titulo}
                    </h1>
                    {subtitulo && (
                        <p className="mt-2 text-[13px] text-zinc-400 font-medium not-italic">
                            {subtitulo}
                        </p>
                    )}
                </div>

                {/* ── CONFIRMACION O FORMULARIO ───────────────────────── */}
                {exito ? (
                    <div className="py-10 flex flex-col items-center text-center">
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
                        {error && (
                            <div
                                key={error}
                                className="auth-tiembla mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-[12px] font-bold text-center not-italic"
                            >
                                {error}
                            </div>
                        )}
                        {children}
                    </>
                )}

                {/* ── PIE ──────────────────────────────────────────────── */}
                {!exito && (
                    <div className="mt-8 text-center">
                        {pie}
                    </div>
                )}
            </div>
        </div>
    );
}
