import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

let openLayers = 0;
let previousBodyStyle;

// Dialogs must escape page animation/stacking contexts. Keep the background
// still until the last layer closes, including an inline tenant child dialog.
export default function ModalPortal({ children }) {
    useLayoutEffect(() => {
        if (openLayers === 0) {
            previousBodyStyle = {
                overflow: document.body.style.overflow,
                paddingRight: document.body.style.paddingRight
            };
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            const padding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
            document.body.style.overflow = "hidden";
            if (scrollbarWidth > 0) document.body.style.paddingRight = `${padding + scrollbarWidth}px`;
        }
        openLayers += 1;
        return () => {
            openLayers -= 1;
            if (openLayers === 0) {
                document.body.style.overflow = previousBodyStyle.overflow;
                document.body.style.paddingRight = previousBodyStyle.paddingRight;
                previousBodyStyle = undefined;
            }
        };
    }, []);

    return createPortal(children, document.body);
}
