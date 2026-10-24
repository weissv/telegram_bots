/**
 * Every colour comes from a CSS variable that resolves to the Telegram theme
 * (see src/index.css), so the app follows the user's light/dark theme natively.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--c-bg)',
      secondary: 'var(--c-secondary)',
      section: 'var(--c-section)',
      text: 'var(--c-text)',
      hint: 'var(--c-hint)',
      subtitle: 'var(--c-subtitle)',
      link: 'var(--c-link)',
      brand: 'var(--c-brand)',
      'brand-ink': 'var(--c-brand-ink)',
      'brand-text': 'var(--c-brand-text)',
      destructive: 'var(--c-destructive)',
      'section-header': 'var(--c-section-header)',
      separator: 'var(--c-separator)',
    },
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
  plugins: [],
};
