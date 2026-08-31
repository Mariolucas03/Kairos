import { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

/**
 * Piezas del formulario de acceso, compartidas por login y registro.
 *
 * El foco se notaba solo por el color del borde. Ahora además crece una línea
 * del acento por debajo del campo: es lo que hace que escribir se sienta como
 * algo que la pantalla acusa, y no como rellenar una tabla.
 */

export function CampoAuth({
    etiqueta,
    icono: Icono,
    acento,
    tipo = 'text',
    nombre,
    valor,
    onChange,
    placeholder,
    esClave = false,
    maxLength,
    autoComplete,
    contador,
    children
}) {
    const [enfocado, setEnfocado] = useState(false);
    const [verClave, setVerClave] = useState(false);

    const tipoReal = esClave ? (verClave ? 'text' : 'password') : tipo;

    return (
        <div>
            <div className="flex items-baseline justify-between mb-2">
                <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] not-italic">
                    {etiqueta}
                </label>
                {contador}
            </div>

            <div className="relative">
                <Icono
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 z-10"
                    size={17}
                    style={{
                        color: enfocado ? acento : '#52525b',
                        transform: `translateY(-50%) scale(${enfocado ? 1.12 : 1})`
                    }}
                />

                <input
                    type={tipoReal}
                    name={nombre}
                    value={valor}
                    onChange={onChange}
                    onFocus={() => setEnfocado(true)}
                    onBlur={() => setEnfocado(false)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    autoComplete={autoComplete}
                    required
                    className={`w-full bg-black/60 border rounded-[16px] py-[14px] pl-12 text-white font-semibold text-sm outline-none transition-colors duration-200 placeholder:text-zinc-700 ${esClave ? 'pr-12' : 'pr-4'}`}
                    style={{ borderColor: enfocado ? acento + '73' : 'rgba(255,255,255,0.09)' }}
                />

                {esClave && (
                    <button
                        type="button"
                        onClick={() => setVerClave(v => !v)}
                        aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors z-10"
                    >
                        {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                )}

                {/* La línea que crece bajo el campo al enfocarlo */}
                <span
                    className="absolute left-4 right-4 -bottom-px h-[2px] rounded-full origin-left transition-transform duration-300 pointer-events-none"
                    style={{
                        background: `linear-gradient(90deg, ${acento}, transparent)`,
                        transform: `scaleX(${enfocado ? 1 : 0})`
                    }}
                />
            </div>

            {children}
        </div>
    );
}

/**
 * Botón de enviar, con un destello que lo cruza cada pocos segundos.
 *
 * El destello se para mientras carga: una animación alegre encima de un botón
 * que está esperando al servidor parece que la pantalla no se ha enterado.
 */
export function BotonAuth({ cargando, acento, textoCargando, colorTexto = '#000', children }) {
    return (
        <button
            type="submit"
            disabled={cargando}
            className="relative w-full rounded-[18px] py-4 mt-6 font-black uppercase tracking-[0.16em] text-[12px] overflow-hidden active:scale-[0.985] transition-transform flex items-center justify-center gap-2 disabled:cursor-not-allowed not-italic"
            style={{ background: acento, color: colorTexto, opacity: cargando ? 0.75 : 1 }}
        >
            {!cargando && (
                <span
                    className="auth-destello absolute top-0 left-0 h-full w-1/3 pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }}
                    aria-hidden="true"
                />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
                {cargando
                    ? <><Loader2 size={16} className="animate-spin" /> {textoCargando}</>
                    : <>{children} <ArrowRight size={18} strokeWidth={3} /></>}
            </span>
        </button>
    );
}
