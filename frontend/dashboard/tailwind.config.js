/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pqc-primary': '#6366f1',
        'pqc-secondary': '#8b5cf6',
        'pqc-accent': '#06b6d4',
        'pqc-success': '#10b981',
        'pqc-warning': '#f59e0b',
        'pqc-danger': '#ef4444',
        'pqc-dark': '#1e1b4b',
      },
    },
  },
  plugins: [],
}
