/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F6F8',
        surface: '#FFFFFF',
        ink: '#1B1C22',
        line: '#E3E3E9',
        // Deliberately distinct from cafe-admin-dashboard's teal accent
        // (#1F5F5B) -- this is the platform-operator surface, not a
        // restaurant's own dashboard, and should never look like it could
        // be mistaken for one.
        accent: '#3730A3',
        'accent-dark': '#2A2380',
        danger: '#C53030',
        warning: '#B7791F',
        success: '#2F855A',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
