/**
 * SILUETA HUMANA EN SVG
 *
 * Sustituye al PNG + rectángulos dibujados a ojo que tenía RPGBody (sus propios
 * comentarios decían "Cuadrado rojo aprox"). Cada grupo muscular es una zona
 * vectorial propia, así que se colorea con precisión y se ve nítido a cualquier
 * tamaño.
 *
 * El cuerpo se dibuja por PARTES (cabeza, torso, brazos, piernas) en vez de con
 * un único contorno gigante: es mucho más fácil que cada músculo caiga justo
 * encima de la extremidad que le corresponde.
 *
 * Lienzo: viewBox "0 0 220 400", figura centrada en x=110.
 */

// --- ESTRUCTURA BASE (silueta) ---
export const BODY_PARTS = [
    // Cabeza
    { type: 'ellipse', cx: 110, cy: 34, rx: 17, ry: 21 },
    // Cuello
    { type: 'path', d: 'M101,50 L119,50 L119,64 L101,64 Z' },
    // Torso: hombros anchos que estrechan en cintura y vuelven a abrir en cadera
    { type: 'path', d: 'M74,66 C86,60 134,60 146,66 L152,110 C150,132 146,150 144,166 L146,196 C138,202 82,202 74,196 L76,166 C74,150 70,132 68,110 Z' },
    // Brazo izquierdo (del espectador): hombro -> bíceps -> antebrazo -> mano
    { type: 'path', d: 'M72,68 C62,72 56,82 53,94 L46,140 C44,158 42,176 41,192 L54,194 C57,178 60,160 63,142 L70,104 C71,90 72,78 74,70 Z' },
    // Brazo derecho
    { type: 'path', d: 'M148,68 C158,72 164,82 167,94 L174,140 C176,158 178,176 179,192 L166,194 C163,178 160,160 157,142 L150,104 C149,90 148,78 146,70 Z' },
    // Pierna izquierda: muslo -> rodilla -> gemelo -> pie
    { type: 'path', d: 'M78,198 C74,226 74,254 78,282 L82,318 C84,342 85,364 85,380 L104,380 C104,364 103,342 101,318 L99,282 C102,254 103,226 104,198 Z' },
    // Pierna derecha
    { type: 'path', d: 'M142,198 C146,226 146,254 142,282 L138,318 C136,342 135,364 135,380 L116,380 C116,364 117,342 119,318 L121,282 C118,254 117,226 116,198 Z' }
];

/**
 * Zonas musculares por vista. Cada grupo puede tener varias piezas
 * (izquierda/derecha) y van encajadas dentro de la silueta de arriba.
 */
export const MUSCLE_SHAPES = {
    front: {
        // Pectorales: dos placas bajo la clavícula, sin invadir los hombros
        Pecho: [
            'M84,76 C93,72 101,71 107,71 L107,101 C98,101 90,98 84,93 C81,87 81,81 84,76 Z',
            'M136,76 C127,72 119,71 113,71 L113,101 C122,101 130,98 136,93 C139,87 139,81 136,76 Z'
        ],
        // Deltoides: la "bola" del hombro
        Hombro: [
            'M72,68 C62,72 56,82 53,94 L51,104 C60,106 68,100 71,90 C72,82 72,74 73,69 Z',
            'M148,68 C158,72 164,82 167,94 L169,104 C160,106 152,100 149,90 C148,82 148,74 147,69 Z'
        ],
        // Bíceps: cara frontal del brazo, entre hombro y codo
        'Bíceps': [
            'M53,90 C51,102 49,114 47,126 L58,128 C60,114 62,102 64,92 C60,88 56,87 53,90 Z',
            'M167,90 C169,102 171,114 173,126 L162,128 C160,114 158,102 156,92 C160,88 164,87 167,90 Z'
        ],
        // Abdominales: tres bloques + oblicuos
        Abdomen: [
            'M96,106 L124,106 L123,128 L97,128 Z',
            'M97,132 L123,132 L122,152 L98,152 Z',
            'M98,156 L122,156 L121,178 L99,178 Z'
        ],
        // Cuádriceps: cara frontal del muslo
        Pierna: [
            'M82,206 C79,230 79,252 82,274 L98,274 C100,252 101,230 102,206 Z',
            'M138,206 C141,230 141,252 138,274 L122,274 C120,252 119,230 118,206 Z'
        ]
    },
    back: {
        // Dorsales + trapecio: la "V" de la espalda
        Espalda: [
            'M76,68 C88,62 132,62 144,68 L150,112 C140,124 126,130 110,130 C94,130 80,124 70,112 Z'
        ],
        Hombro: [
            'M72,68 C62,72 56,82 53,94 L51,104 C60,106 68,100 71,90 C72,82 72,74 73,69 Z',
            'M148,68 C158,72 164,82 167,94 L169,104 C160,106 152,100 149,90 C148,82 148,74 147,69 Z'
        ],
        // Tríceps: cara posterior del brazo
        'Tríceps': [
            'M53,90 C51,102 49,114 47,126 L58,128 C60,114 62,102 64,92 C60,88 56,87 53,90 Z',
            'M167,90 C169,102 171,114 173,126 L162,128 C160,114 158,102 156,92 C160,88 164,87 167,90 Z'
        ],
        // Glúteos: justo encima del muslo
        'Glúteo': [
            'M78,160 C72,172 73,186 80,194 C88,199 100,200 108,198 L108,160 Z',
            'M142,160 C148,172 147,186 140,194 C132,199 120,200 112,198 L112,160 Z'
        ],
        // Femoral + gemelo
        Pierna: [
            'M82,210 C79,232 79,252 82,272 L98,272 C100,252 101,232 102,210 Z',
            'M84,292 C82,306 82,318 84,330 L98,330 C99,318 99,306 98,292 Z',
            'M138,210 C141,232 141,252 138,272 L122,272 C120,252 119,232 118,210 Z',
            'M136,292 C138,306 138,318 136,330 L122,330 C121,318 121,306 122,292 Z'
        ]
    }
};

// Qué grupos se ven en cada cara (para avisar de que hay que girar el cuerpo)
export const GROUPS_BY_VIEW = {
    front: ['Pecho', 'Hombro', 'Bíceps', 'Abdomen', 'Pierna'],
    back: ['Espalda', 'Hombro', 'Tríceps', 'Glúteo', 'Pierna']
};
