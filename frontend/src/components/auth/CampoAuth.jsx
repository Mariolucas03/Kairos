import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from '../../iconos';

/**
 * Piezas del formulario de acceso, compartidas por login y registro.
 * Un campo con su icono, y un boton. El foco se nota por el borde.
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
            <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-zinc-400 not-italic">
                    {etiqueta}
                </label>
                {contador}
            </div>

            <div className="relative">
                <Icono
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors z-10"
                    size={17}
                    style={{ color: enfocado ? acento : '#52525b' }}
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
                    className={`w-full bg-[#0f0f11] border rounded-xl py-[13px] pl-12 text-white font-semibold text-sm outline-none transition-colors placeholder:text-zinc-500 ${esClave ? 'pr-12' : 'pr-4'}`}
                    style={{ borderColor: enfocado ? acento : 'rgba(255,255,255,0.1)' }}
                />

                {esClave && (
                    <button
                        type="button"
                        onClick={() => setVerClave(v => !v)}
                        aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors z-10"
                    >
                        {verClave ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                )}
            </div>

            {children}
        </div>
    );
}

/** Boton de enviar. Mientras carga, la rueda y el texto de espera. */
export function BotonAuth({ cargando, acento, textoCargando, colorTexto = '#000', children }) {
    return (
        <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-xl py-[15px] mt-6 font-black uppercase tracking-[0.14em] text-[12px] active:scale-[0.985] transition-transform flex items-center justify-center gap-2 disabled:cursor-not-allowed not-italic"
            style={{ background: acento, color: colorTexto, opacity: cargando ? 0.75 : 1 }}
        >
            {cargando
                ? <><Loader2 size={16} className="animate-spin" /> {textoCargando}</>
                : children}
        </button>
    );
}
