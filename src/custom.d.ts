// src/custom.d.ts
// This file extends JSX intrinsic elements to include web components like w3m-button.
declare namespace JSX {
    interface IntrinsicElements {
        'w3m-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        // You can add other web components here if your project uses them
    }
} 