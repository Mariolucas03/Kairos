import reactHooks from 'eslint-plugin-react-hooks';

/**
 * REVISOR AUTOMÁTICO DE CÓDIGO
 *
 * Existe por una razón muy concreta: en esta app han aparecido SEIS pantallas
 * rotas por usar una variable que no estaba declarada en ninguna parte
 * (errorMsg, ACENTO, DAY_LABELS, estiloMision, carpetaDestino y
 * especificosDelGrupo). Todas se descubrieron igual: un usuario entra, la
 * pantalla se cae, y alguien lo reporta días después. Cualquiera de ellas se
 * habría visto en un segundo con esto.
 *
 * ⚠️ Solo hay reglas de FALLO REAL, ninguna de estilo. Nada de comillas,
 * sangrías, puntos y comas ni preferencias personales: eso genera ruido, se
 * acaba ignorando, y un revisor que se ignora no sirve para nada. Si esto se
 * queja, es que algo está roto de verdad.
 *
 * Va enganchado al `build`, así que un fallo de estos PARA el despliegue en
 * Vercel en vez de publicar una pantalla que revienta al abrirla.
 */

const globalesDelNavegador = {};
for (const nombre of [
    'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch',
    'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'alert', 'confirm', 'prompt',
    'FormData', 'FileReader', 'Image', 'Audio', 'Blob', 'URL', 'URLSearchParams',
    'AbortController', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver',
    'Notification', 'caches', 'self', 'atob', 'btoa', 'crypto', 'performance',
    'location', 'history', 'screen', 'matchMedia', 'getComputedStyle',
    'HTMLElement', 'Element', 'Event', 'CustomEvent', 'TouchEvent', 'KeyboardEvent',
    'MouseEvent', 'DOMParser', 'XMLHttpRequest', 'WebSocket', 'structuredClone',
    'queueMicrotask', 'globalThis', 'process'
]) globalesDelNavegador[nombre] = 'readonly';

export default [
    { ignores: ['dist/**', 'node_modules/**', 'public/**'] },

    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globalesDelNavegador,
            parserOptions: { ecmaFeatures: { jsx: true } }
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            // --- LO QUE PARA EL DESPLIEGUE (fallos que revientan la pantalla) ---
            'no-undef': 'error',              // el de las seis pantallas rotas
            'no-const-assign': 'error',       // reasignar una constante
            'no-dupe-keys': 'error',          // dos claves iguales: una se pierde en silencio
            'no-dupe-args': 'error',
            'no-dupe-class-members': 'error',
            'no-func-assign': 'error',
            'no-import-assign': 'error',
            'no-obj-calls': 'error',
            'no-unreachable': 'error',        // código detrás de un return: nunca se ejecuta
            'no-unsafe-negation': 'error',
            'use-isnan': 'error',             // x === NaN es SIEMPRE falso
            'valid-typeof': 'error',          // typeof x === 'strnig'
            'no-cond-assign': 'error',        // if (x = 1) en vez de if (x === 1)
            'no-self-assign': 'error',
            'no-dupe-else-if': 'error',
            'no-duplicate-case': 'error',

            // --- LO QUE SOLO AVISA (huele mal, pero no rompe nada) ---
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'react-hooks/rules-of-hooks': 'warn',
            'react-hooks/exhaustive-deps': 'warn'
        }
    }
];
