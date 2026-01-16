import React from 'react';

export default function Mascot({ petUrl }) {
    if (!petUrl) return null;

    return (
        // CAMBIO REALIZADO AQUÍ:
        // Antes: w-24 h-24 (96px)
        // Ahora:  w-20 h-20 (80px) -> La caja es más pequeña, la mascota se encoge.
        <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-20 h-20 z-40 pointer-events-none select-none">

            <img
                src={petUrl}
                alt="Mascota"
                // Mantenemos 'object-contain' y 'object-bottom' para que se ajuste
                // dentro de la nueva caja pequeña y se pegue al suelo.
                className="w-full h-full object-contain object-bottom image-pixelated"
            />

            <style>{`
                .image-pixelated { 
                    image-rendering: pixelated;
                    image-rendering: -moz-crisp-edges;
                    image-rendering: crisp-edges;
                    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
                }
            `}</style>
        </div>
    );
}