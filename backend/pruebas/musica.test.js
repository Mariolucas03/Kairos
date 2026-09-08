const { test, describe } = require('node:test');
const assert = require('node:assert');

const { esDeApple } = require('../controllers/gymController');

/**
 * LA CANCION DEL ENTRENO
 *
 * ⚠️ ESTO NO ES UNA COMPROBACION DE FORMATO: ES SEGURIDAD.
 *
 * Lo que se guarda en `cancion` acaba PINTADO Y REPRODUCIDO en el movil de tus
 * amigos, en el feed. La peticion de guardar un entreno la manda el cliente, y
 * un cliente puede mandar lo que quiera: sin esta comprobacion, cualquiera
 * podria poner en `preview` o en `caratula` una URL de su propio servidor y
 * conseguir que a otra persona le sonara o le cargara lo que a el le diera la
 * gana — y de paso saber cuando y desde donde abre la app, porque su servidor
 * veria la peticion.
 *
 * El buscador solo devuelve enlaces de Apple. Esto es lo que garantiza que lo
 * que se GUARDA tambien lo sea.
 */

describe('Las URLs de la cancion tienen que ser de Apple', () => {

    test('las que devuelve el buscador pasan', () => {
        assert.ok(esDeApple('https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/88/x.m4a'));
        assert.ok(esDeApple('https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/49/300x300bb.jpg'));
        assert.ok(esDeApple('https://music.apple.com/es/album/eye-of-the-tiger/123'));
    });

    test('EL SERVIDOR DE OTRO NO', () => {
        assert.strictEqual(esDeApple('https://malo.example.com/pista.mp3'), false);
        assert.strictEqual(esDeApple('https://evil.net/rastreador.jpg'), false);
    });

    test('NI UN DOMINIO QUE SE LE PAREZCA', () => {
        // El truco de toda la vida: un dominio propio que contiene el bueno.
        // Comparar con `includes` en vez de con el hostname exacto dejaria pasar
        // todos estos.
        assert.strictEqual(esDeApple('https://itunes.apple.com.malo.net/x.m4a'), false);
        assert.strictEqual(esDeApple('https://malo.net/itunes.apple.com/x.m4a'), false);
        assert.strictEqual(esDeApple('https://audio-ssl.itunes.apple.com.evil.co/x.m4a'), false);
        assert.strictEqual(esDeApple('https://notitunes.apple.com/x.m4a'), false);
    });

    test('SOLO HTTPS', () => {
        // Por http, cualquiera en la misma wifi del gimnasio puede cambiar lo
        // que suena por el camino.
        assert.strictEqual(esDeApple('http://audio-ssl.itunes.apple.com/x.m4a'), false);
    });

    test('nada de javascript: ni data:', () => {
        // `javascript:` en un src no se ejecuta en React, pero no se deja pasar
        // igualmente: la lista blanca es de dominios, no de esquemas raros.
        assert.strictEqual(esDeApple('javascript:alert(1)'), false);
        assert.strictEqual(esDeApple('data:audio/mp3;base64,AAAA'), false);
        assert.strictEqual(esDeApple('file:///etc/passwd'), false);
    });

    test('la basura no revienta, simplemente no pasa', () => {
        for (const x of [null, undefined, '', 'no soy una url', 42, {}, []]) {
            assert.strictEqual(esDeApple(x), false, `${JSON.stringify(x)} no deberia pasar`);
        }
    });
});
