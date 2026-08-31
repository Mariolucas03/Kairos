import { API_BASE_URL } from '../config';

/**
 * AVISA AL SERVIDOR CUANDO SE ROMPE UNA PANTALLA.
 *
 * Antes, un fallo de render pintaba "algo se ha roto" y hacía un console.error
 * en un móvil que nadie va a mirar nunca. Nadie se enteraba salvo que el
 * usuario escribiera. Ahora sale en el panel de administración.
 *
 * Tres reglas, y las tres importan:
 *
 *  1. NUNCA puede fallar. Esto se ejecuta cuando la app ya está rota; si además
 *     lanzara una excepción, se llevaría por delante la pantalla de error que
 *     es lo único que le queda al usuario. Todo va dentro de try/catch y los
 *     errores del propio envío se tragan a propósito.
 *
 *  2. NUNCA puede inundar. Un componente que peta lo hace en bucle. Se manda
 *     cada fallo distinto UNA vez por sesión, con un techo total: el servidor
 *     ya agrupa por huella, pero mil peticiones desde un móvil con datos
 *     móviles son mil peticiones aunque el servidor las junte.
 *
 *  3. Tiene que sobrevivir a la recarga. La red de seguridad recarga la página
 *     sola cuando el fallo es de carga de código, y un fetch normal se cancela
 *     al navegar. Por eso va con `keepalive`: el navegador se compromete a
 *     terminarlo aunque la página se muera.
 */

const MAX_POR_SESION = 8;
const yaEnviados = new Set();
let enviadosTotal = 0;

export function reportarFallo({ mensaje, pila = '', origen = 'render' }) {
    try {
        const texto = String(mensaje || '').slice(0, 300);
        if (!texto) return;

        // Sin sesión no hay a quién atribuirlo y el servidor devolvería 401.
        // Un fallo en la pantalla de login se queda sin contar, y es el precio
        // correcto: la alternativa es un endpoint abierto a cualquiera.
        const token = localStorage.getItem('token');
        if (!token) return;

        const ruta = window.location.pathname;

        // El origen entra en la clave a proposito. Un mismo fallo llega por dos
        // caminos: la red de seguridad de React (que trae la pila de
        // COMPONENTES, o sea cual se ha roto) y el manejador global de
        // JavaScript. Si se descartara el segundo aviso por repetido, se
        // perderia justo el dato mas util, porque el que llega primero no
        // siempre es el bueno.
        //
        // Al servidor le da igual: agrupa por mensaje y pantalla, asi que los
        // dos caen en la misma linea y la pila que queda es la ultima.
        const clave = texto + '|' + ruta + '|' + origen;

        if (yaEnviados.has(clave)) return;
        if (enviadosTotal >= MAX_POR_SESION) return;

        yaEnviados.add(clave);
        enviadosTotal++;

        fetch(API_BASE_URL + '/api/errores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({
                mensaje: texto,
                ruta,
                origen,
                pila: String(pila || '').slice(0, 1200)
            }),
            keepalive: true
        }).catch(() => { /* si no se puede avisar, no se puede: no es motivo para romper más */ });
    } catch {
        // Ni siquiera esto puede tumbar la pantalla de error
    }
}

/**
 * Errores que NO pasan por React y que hasta ahora no los veía nadie: un
 * `await` sin capturar, un fallo dentro de un manejador de eventos, un
 * setTimeout que revienta. La red de seguridad de React solo caza los de
 * render, y eso es una parte pequeña de lo que se rompe de verdad.
 */
export function escucharFallosGlobales() {
    window.addEventListener('error', (evento) => {
        // Los fallos de carga de recursos (una imagen que no está) llegan por
        // aquí con evento.error a null. No son errores de código y llenarían
        // el panel de ruido.
        if (!evento?.error) return;
        reportarFallo({
            mensaje: evento.error.message || String(evento.message || ''),
            pila: evento.error.stack,
            origen: 'global'
        });
    });

    window.addEventListener('unhandledrejection', (evento) => {
        const motivo = evento?.reason;
        // Las peticiones que fallan ya se gestionan en su sitio (axios las
        // rechaza y cada pantalla decide qué enseñar). Contarlas aquí sería
        // llenar el panel de "sin conexión" cada vez que alguien entra en el
        // metro.
        if (motivo?.isAxiosError || motivo?.response || motivo?.config) return;

        reportarFallo({
            mensaje: motivo?.message || String(motivo || 'Promesa rechazada'),
            pila: motivo?.stack,
            origen: 'promesa'
        });
    });
}
