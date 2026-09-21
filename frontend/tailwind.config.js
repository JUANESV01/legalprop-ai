/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#F0F8F8',
          100: '#DDF0EF',
          200: '#BCE0DD',
          300: '#8BC6C1',
          400: '#53A6A0',
          500: '#268781',
          600: '#166E69',
          700: '#0E5450', // Noble Deep Teal
          800: '#0B423F',
          900: '#072C2A',
          950: '#041B1A',
        },
        cream: {
          50: '#FAF8F3', // Light Ivory / Card background
          100: '#F5F1E8', // Primary Canvas Beige
          150: '#EFE9DE', // Surface Beige
          200: '#E8E1D2', // Borders & Hover
          300: '#D9CFBC', // Subtle lines
          400: '#C2B49B', // Muted text
          500: '#A19073',
          600: '#7F6F54',
          700: '#5F523D',
          800: '#413728',
          900: '#261F16',
        },
        legal: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        sand: {
          50: '#FBF9F4',
          100: '#F4F0E6',
          200: '#E9E2D2',
          300: '#DCD1BD',
          400: '#C7B79D',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(40, 45, 45, 0.05), 0 1px 2px -1px rgba(40, 45, 45, 0.05)',
        'card': '0 4px 14px -2px rgba(40, 45, 45, 0.06), 0 2px 6px -2px rgba(40, 45, 45, 0.04)',
        'elevated': '0 10px 25px -5px rgba(40, 45, 45, 0.08), 0 8px 10px -6px rgba(40, 45, 45, 0.04)',
      }
    },
  },
  plugins: [],
}
