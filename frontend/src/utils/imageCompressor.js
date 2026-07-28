/**
 * Comprime una imagen EN EL MÓVIL antes de subirla.
 *
 * Las fotos se guardan en la propia base de datos, así que subir el original de
 * la cámara (3-8 MB) la llenaría enseguida. Aquí se reduce a un máximo de
 * 1080 px y se recodifica en JPEG, dejándola en ~150-250 KB.
 *
 * @param {File} file        imagen elegida por el usuario
 * @param {number} maxSize   lado mayor máximo en píxeles
 * @param {number} quality   calidad JPEG (0-1)
 * @returns {Promise<string>} data URL lista para enviar
 */
export const compressImage = (file, maxSize = 1080, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('El archivo no es una imagen'));
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'));

        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Imagen no válida'));

            img.onload = () => {
                let { width, height } = img;

                // Reescalamos manteniendo la proporción
                if (width > height && width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Fondo blanco: si la imagen es PNG con transparencia, al pasar a
                // JPEG el canal alfa se volvería negro.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                // Red de seguridad: si aun así se pasa del límite del servidor
                // (~400 KB), bajamos calidad hasta que entre.
                let q = quality;
                while (dataUrl.length > 380 * 1024 && q > 0.3) {
                    q -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', q);
                }

                resolve(dataUrl);
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
};
