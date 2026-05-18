/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'bricolage': ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        'jetbrains': ['"JetBrains Mono"', 'monospace'],
        'sans': ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
