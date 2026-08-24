import { Shield } from 'lucide-react';
import BackButton from '../components/common/BackButton';

/**
 * Política de privacidad.
 *
 * Está escrita con lo que la app guarda DE VERDAD, comprobado contra el modelo
 * de datos y los servicios a los que llama, no con una plantilla copiada. Una
 * política que no coincide con lo que hace la app es peor que no tenerla: dice
 * en tu nombre algo que no cumples.
 *
 * ⚠️ Es un punto de partida honesto, no un documento revisado por un abogado.
 */

const Bloque = ({ titulo, children }) => (
    <section className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 mb-3">
        <h2 className="text-yellow-500 text-[11px] font-black uppercase tracking-widest mb-3">{titulo}</h2>
        <div className="text-zinc-400 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
);

export default function Privacidad() {
    return (
        <div className="min-h-screen bg-black pb-28 safe-top px-4 animate-in fade-in">
            <div className="flex items-center gap-3 mb-6">
                <BackButton />
                <h1 className="text-2xl font-black text-white uppercase not-italic tracking-tighter flex items-center gap-2">
                    <Shield size={20} className="text-yellow-500" /> Privacidad
                </h1>
            </div>

            <p className="text-zinc-500 text-xs mb-5 leading-relaxed">
                Kairos es una aplicación personal de entrenamiento. Aquí está, sin rodeos,
                qué se guarda de ti, dónde está y cómo te lo llevas o lo borras.
            </p>

            <Bloque titulo="Qué se guarda">
                <p><strong className="text-zinc-200">Tu cuenta:</strong> nombre de usuario y correo electrónico.
                La contraseña se guarda cifrada; nadie, tampoco quien administra la app, puede leerla.</p>

                <p><strong className="text-zinc-200">Lo que registras:</strong> entrenos (ejercicios, series, pesos y
                repeticiones), actividades deportivas, comidas y sus calorías, peso corporal, ánimo, sueño, pasos,
                misiones y hábitos.</p>

                <p><strong className="text-zinc-200">Fotos:</strong> las que subes de tus comidas o de tus entrenos.
                Se guardan dentro de la base de datos de la app.</p>

                <p><strong className="text-zinc-200">Actividad social:</strong> tus amistades, los clanes a los que
                perteneces, y los "me gusta" y comentarios que dejas.</p>

                <p><strong className="text-zinc-200">Datos técnicos:</strong> la fecha de tu última conexión (para el
                indicador de "en línea") y, si activas las notificaciones, un identificador de tu dispositivo para
                poder enviártelas.</p>

                <p className="text-zinc-500">No se recogen datos de localización, ni contactos, ni se usa ningún
                sistema de publicidad o de seguimiento entre aplicaciones.</p>
            </Bloque>

            <Bloque titulo="Quién lo ve">
                <p>Tus datos son tuyos. Otros usuarios solo ven lo que tú decides enseñar: puedes poner la cuenta en
                privado y ocultar por separado tus entrenos, tu comida, tus misiones y tus medidas corporales desde
                <strong className="text-zinc-200"> Ajustes</strong>.</p>

                <p>Quien administra la app puede ver la lista de cuentas con su correo, y puede borrar comentarios o
                suspender cuentas para moderar. No puede leer contraseñas.</p>
            </Bloque>

            <Bloque titulo="Dónde está y quién lo procesa">
                <p>La app se apoya en servicios de terceros para funcionar:</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400">
                    <li><strong className="text-zinc-200">MongoDB Atlas</strong> — guarda la base de datos.</li>
                    <li><strong className="text-zinc-200">Render</strong> — ejecuta el servidor.</li>
                    <li><strong className="text-zinc-200">Vercel</strong> — sirve la aplicación web.</li>
                    <li><strong className="text-zinc-200">Google (Gemini)</strong> y <strong className="text-zinc-200">OpenRouter</strong> —
                    analizan lo que escribes o fotografías de tus comidas y generan rutinas.</li>
                </ul>

                <p className="text-zinc-500">Importante: cuando pides analizar una comida, <strong className="text-zinc-300">el
                texto o la foto se envían a esos servicios de inteligencia artificial</strong> para calcular las
                calorías. No se les manda tu nombre, tu correo ni el resto de tu historial.</p>
            </Bloque>

            <Bloque titulo="Cuánto tiempo">
                <p>Mientras tengas la cuenta abierta. Cuando la borras, se borra todo: entrenos, comidas, fotos,
                registros diarios, rutinas, misiones y tu rastro en el contenido de otros (tus comentarios y tus
                "me gusta" desaparecen también).</p>

                <p className="text-zinc-500">Se hacen copias de seguridad periódicas de la base de datos. Una cuenta
                borrada puede seguir existiendo en una copia antigua durante un tiempo limitado hasta que esa copia
                se sustituye por otra más reciente.</p>
            </Bloque>

            <Bloque titulo="Tus derechos">
                <p><strong className="text-zinc-200">Borrar tu cuenta:</strong> Ajustes → Borrar mi cuenta. Es
                inmediato y no tiene vuelta atrás; no hace falta pedir permiso a nadie.</p>

                <p><strong className="text-zinc-200">Corregir tus datos:</strong> puedes editar tu perfil y tus
                registros desde la propia app.</p>

                <p><strong className="text-zinc-200">Pedir una copia de tus datos:</strong> escribe al correo de
                contacto y se te envía.</p>
            </Bloque>

            <Bloque titulo="Contacto">
                <p className="text-yellow-500/90">
                    ⚠️ Falta poner aquí un correo de contacto antes de publicar la app.
                </p>
                <p className="text-zinc-500">Para cualquier duda sobre tus datos, o para pedir una copia de ellos,
                escribe a esa dirección.</p>
            </Bloque>

            <p className="text-zinc-600 text-[11px] text-center mt-6 mb-2">
                Última actualización: agosto de 2026
            </p>
        </div>
    );
}
