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
            'M85,75 C94,70 102,70 107,71 L107,100 C99,102 90,99 85,93 C82,87 82,80 85,75 Z',
            'M135,75 C126,70 118,70 113,71 L113,100 C121,102 130,99 135,93 C138,87 138,80 135,75 Z'
        ],
        // Deltoides: la "bola" del hombro
        Hombro: [
            'M72,68 C62,72 56,82 53,94 L51,104 C60,106 68,100 71,90 C72,82 72,74 73,69 Z',
            'M148,68 C158,72 164,82 167,94 L169,104 C160,106 152,100 149,90 C148,82 148,74 147,69 Z'
        ],
        // Bíceps: cara frontal del brazo, entre hombro y codo
        'Bíceps': [
            'M57,86 C54,97 52,107 51,119 L61,121 C63,108 65,97 67,87 C64,81 60,81 57,86 Z',
            'M163,86 C166,97 168,107 169,119 L159,121 C157,108 155,97 153,87 C156,81 160,81 163,86 Z'
        ],
        // Abdominales: la "tableta" en dos columnas de tres, más los oblicuos
        // a los lados. Antes eran tres franjas de lado a lado, que se leían
        // como cajones y no como un abdomen.
        Abdomen: [
            'M99,108 C99,106 108,106 108,108 L108,122 C108,124 99,124 99,122 Z',
            'M112,108 C112,106 121,106 121,108 L121,122 C121,124 112,124 112,122 Z',
            'M99,127 C99,125 108,125 108,127 L108,142 C108,144 99,144 99,142 Z',
            'M112,127 C112,125 121,125 121,127 L121,142 C121,144 112,144 112,142 Z',
            'M100,147 C100,145 108,145 108,147 L108,165 C108,167 100,167 100,165 Z',
            'M112,147 C112,145 120,145 120,147 L120,165 C120,167 112,167 112,165 Z',
            // Oblicuos
            'M91,114 C88,128 88,146 92,160 L97,159 C94,145 94,128 96,114 Z',
            'M129,114 C132,128 132,146 128,160 L123,159 C126,145 126,128 124,114 Z'
        ],
        // Cuádriceps: recto femoral (interior) y vasto externo, uno por pierna
        Pierna: [
            'M92,206 C90,230 90,252 92,272 L101,272 C102,250 102,228 102,206 Z',
            'M82,206 C80,228 80,248 82,268 L90,268 C90,248 90,228 91,206 Z',
            'M128,206 C130,230 130,252 128,272 L119,272 C118,250 118,228 118,206 Z',
            'M138,206 C140,228 140,248 138,268 L130,268 C130,248 130,228 129,206 Z'
        ]
    },
    back: {
        // Trapecio (el rombo de arriba) y los dos dorsales que forman la V.
        // Antes era una única mancha que ocupaba toda la espalda.
        Espalda: [
            'M96,66 L124,66 L134,87 C126,97 94,97 86,87 Z',
            'M78,91 C75,107 82,125 96,137 C101,141 105,143 108,144 L108,100 C97,99 86,96 78,91 Z',
            'M142,91 C145,107 138,125 124,137 C119,141 115,143 112,144 L112,100 C123,99 134,96 142,91 Z'
        ],
        Hombro: [
            'M72,68 C62,72 56,82 53,94 L51,104 C60,106 68,100 71,90 C72,82 72,74 73,69 Z',
            'M148,68 C158,72 164,82 167,94 L169,104 C160,106 152,100 149,90 C148,82 148,74 147,69 Z'
        ],
        // Tríceps: cara posterior del brazo
        'Tríceps': [
            'M57,86 C54,97 52,107 51,119 L61,121 C63,108 65,97 67,87 C64,81 60,81 57,86 Z',
            'M163,86 C166,97 168,107 169,119 L159,121 C157,108 155,97 153,87 C156,81 160,81 163,86 Z'
        ],
        // Glúteos: dos masas redondeadas sobre el muslo
        'Glúteo': [
            'M108,166 C97,166 86,168 79,174 C73,181 75,193 83,198 C91,203 102,203 108,199 Z',
            'M112,166 C123,166 134,168 141,174 C147,181 145,193 137,198 C129,203 118,203 112,199 Z'
        ],
        // Femoral y gemelo
        Pierna: [
            'M82,208 C79,230 79,250 82,270 L100,270 C101,250 102,230 102,208 Z',
            'M84,290 C81,302 81,316 85,328 L97,328 C99,316 99,302 97,290 Z',
            'M138,208 C141,230 141,250 138,270 L120,270 C119,250 118,230 118,208 Z',
            'M136,290 C139,302 139,316 135,328 L123,328 C121,316 121,302 123,290 Z'
        ]
    }
};

// Qué grupos se ven en cada cara (para avisar de que hay que girar el cuerpo)
export const GROUPS_BY_VIEW = {
    front: ['Pecho', 'Hombro', 'Bíceps', 'Abdomen', 'Pierna'],
    back: ['Espalda', 'Hombro', 'Tríceps', 'Glúteo', 'Pierna']
};
