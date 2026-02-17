/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        accent: '#f59e0b',
        bg: '#121018',
        surface: '#1e1a28',
        'surface-light': '#2a2438',
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        lavender: '#b388ff',
        crimson: '#ef5350',
      },
      fontFamily: {
        display: ['"Weiholmir"', 'cursive'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'sparkle': 'sparkle 1s infinite',
        'bounce-slow': 'bounce 3s ease-in-out infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        sparkle: {
          '0%, 19.99%': { 'background-position': '0% 0' },
          '20%, 39.99%': { 'background-position': '25% 0' },
          '40%, 59.99%': { 'background-position': '50% 0' },
          '60%, 79.99%': { 'background-position': '75% 0' },
          '80%, 99.99%': { 'background-position': '100% 0' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
};
