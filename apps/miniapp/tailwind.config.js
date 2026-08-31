/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        themePrimary: 'var(--color-primary, #0ea5e9)',
        themeAccent: 'var(--color-accent, #38bdf8)',
        themeBg: 'var(--color-bg, #0f172a)',
        themeText: 'var(--color-text, #f8fafc)',
      },
    },
  },
  plugins: [],
};
