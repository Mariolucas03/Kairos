# -*- coding: utf-8 -*-
"""
Genera public/body/muscles-mujer.jpg a partir de public/body/muscles.jpg.

Es la MISMA deformacion que aplica src/components/body/siluetaMujer.js a los
poligonos: fila a fila, cada figura se ensancha o se estrecha alrededor de su
eje segun `anchura(y)`. Si se cambia la tabla de control, hay que cambiarla
en los dos sitios y volver a ejecutar esto:

    python scripts/generar-silueta-mujer.py
"""
import math
from PIL import Image

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

origen = Image.open('public/body/muscles.jpg').convert('RGB')
W, H = origen.size
fondo = origen.getpixel((5, 5))
salida = Image.new('RGB', (W, H), fondo)
px_o = origen.load()
px_s = salida.load()
MITAD = 585   # donde se parte la lamina en dos figuras

for y in range(H):
    f = anchura(y)
    for x in range(W):
        vista = 'front' if x < MITAD else 'back'
        eje = EJE[vista]
        # Muestreo inverso: el pixel de salida x viene del pixel de origen xo
        xo = eje + (x - eje) / f
        # Que no se cuele la otra figura al ensanchar
        if vista == 'front' and xo >= MITAD:
            px_s[x, y] = fondo; continue
        if vista == 'back' and xo < MITAD:
            px_s[x, y] = fondo; continue
        xi = int(round(xo))
        if 0 <= xi < W:
            px_s[x, y] = px_o[xi, y]

salida.save('public/body/muscles-mujer.jpg', quality=92)
print('ok', salida.size)
