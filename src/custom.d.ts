import 'react'; // Ensures React's JSX namespace is in scope

// src/custom.d.ts
// This file extends JSX intrinsic elements to include web components.
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            // You can add other web components here if your project uses them
        }
    }
}

export { }; // Ensures file is treated as a module, good practice. 