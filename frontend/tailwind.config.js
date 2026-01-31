/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-dark': '#0a0a0f',
                'bg-elevated': '#12121a',
                'bg-hover': '#1a1a25',
                'primary': {
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                },
                'success': '#10b981',
                'warning': '#f59e0b',
                'error': '#ef4444',
            },
        },
    },
    plugins: [],
}
