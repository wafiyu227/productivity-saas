/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                "background-light": "#FFFFFF",
                "background-dark": "#0f1e23",
                "soft-lavender": "#E6E6FA",
                "deep-indigo": "#4B0082",
                "vibrant-cyan": "#00BFFF",
                "dark-gray": "#333333",
                "highlight": "#00BFFF",
                "text-primary": "#1C1C1E",
                "text-secondary": "#6C6C70",
                "segment-bg": "#E6E6FA",
                "indigo-brand": "#4B0082",
                "cyan-brand": "#00BFFF",
                "lavender-border": "#E6E6FA",
                "primary-login": "#4a0080",
                "primary-signup": "#0400ff",
                primary: {
                    DEFAULT: "#4c0082",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [],
}
