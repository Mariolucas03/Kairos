import { useState, useEffect } from 'react';

export function useSmoothMount() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Le damos al navegador 50ms para hacer la transición de pestaña sin congelarse
        const timer = setTimeout(() => {
            setIsMounted(true);
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    return isMounted;
}