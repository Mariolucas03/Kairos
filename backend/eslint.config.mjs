/**
 * REVISOR AUTOMÁTICO DEL SERVIDOR
 *
 * Mismo motivo que en el frontend, pero aquí un descuido de estos no rompe una
 * pantalla: devuelve un error 500 a quien esté usando la app en ese momento, y
 * puede dejar una petición a medias (dinero descontado y objeto sin entregar,
 * por ejemplo).
 *
 * Solo reglas de fallo real, ninguna de estilo.
 *
 * ⚠️ A diferencia del frontend, esto NO va enganchado al arranque del servidor.
 * Que el servidor se niegue a arrancar por un aviso del revisor sería mucho peor
 * que el propio aviso: se ejecuta a mano con `npm run lint`.
 */

const globalesDeNode = {};
for (const nombre of [
    'require', 'module', 'exports', 'process', '__dirname', '__filename',
    'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'setImmediate', 'Buffer', 'URL', 'URLSearchParams', 'fetch', 'AbortController',
    'globalThis', 'structuredClone', 'crypto', 'TextEncoder', 'TextDecoder'
]) globalesDeNode[nombre] = 'readonly';

export default [
    { ignores: ['node_modules/**'] },

    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: globalesDeNode
        },
        rules: {
            'no-undef': 'error',
            'no-const-assign': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-func-assign': 'error',
            'no-obj-calls': 'error',
            'no-unreachable': 'error',
            'no-unsafe-negation': 'error',
            'use-isnan': 'error',
            'valid-typeof': 'error',
            'no-cond-assign': 'error',
            'no-self-assign': 'error',
            'no-dupe-else-if': 'error',
            'no-duplicate-case': 'error',

            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }]
        }
    }
];
