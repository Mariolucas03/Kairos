# -*- coding: utf-8 -*-
"""
Genera public/body/muscles-mujer.png a partir de public/body/muscles.png.

La lamina es un PNG con solo las lineas blancas (alfa = intensidad); los
colores de los musculos se pintan DEBAJO en la app. Es la MISMA deformacion
que aplica src/components/body/siluetaMujer.js a los poligonos: fila a fila,
cada figura se ensancha o se estrecha alrededor de su eje segun `anchura(y)`.
Si se cambia la tabla de control, hay que cambiarla en los dos sitios y
volver a ejecutar esto:

    python scripts/generar-silueta-mujer.py
"""
import math
from PIL import Image
import numpy as np

EJE = {'front': 314, 'back': 857}
CONTROL = [
    (0, 1.0), (130, 1.0), (200, 0.88), (320, 0.87), (400, 0.84), (440, 0.86),
    (500, 1.06), (560, 1.08), (640, 1.03), (720, 0.98), (900, 0.97), (1150, 0.97)
]

def anchura(y):
    if y <= CONTROL[0][0]:
        return CONTROL[0][1]
    for i in range(1, len(CONTROL)):
        y1, f1 = CONTROL[i]
        if y <= y1:
            y0, f0 = CONTROL[i - 1]
            t = (y - y0) / (y1 - y0)
            s = (1 - math.cos(t * math.pi)) / 2
            return f0 + (f1 - f0) * s
    return CONTROL[-1][1]

origen = np.array(Image.open('public/body/muscles.png').convert('RGBA'))
H, W = origen.shape[:2]
MITAD = 585   # donde se parte la lamina en dos figuras
salida = np.zeros_like(origen)
salida[..., :3] = 255
xs = np.arange(W)
for y in range(H):
    f = anchura(y)
    for vista, cond in (('front', xs < MITAD), ('back', xs >= MITAD)):
        eje = EJE[vista]
        # Muestreo inverso: el pixel de salida x viene del pixel de origen xo
        xo = np.rint(eje + (xs - eje) / f).astype(int)
        # Que no se cuele la otra figura al ensanchar
        ok = cond & (xo >= 0) & (xo < W) & ((xo < MITAD) if vista == 'front' else (xo >= MITAD))
        salida[y, xs[ok], 3] = origen[y, xo[ok], 3]
Image.fromarray(salida, 'RGBA').save('public/body/muscles-mujer.png', optimize=True)
print('ok', (W, H))
