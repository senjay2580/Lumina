/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './shared/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './types/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif'],
        mono: ['Roboto', 'monospace'],
      },
      colors: {
        background: '#FDFCF8',
        surface: '#FFFFFF',
        text: '#1A1A1A',
        subtext: '#666666',
        primary: '#FF6B00',
        'primary-light': '#FFF0E5',
        glass: 'rgba(255, 255, 255, 0.65)',
      },
      screens: {
        // Tailwind 默认 mobile-first；保留默认断点，桌面端样式继续生效
        // 显式定义 max-md 反向断点以便给桌面端写"移动端独占"覆盖
        'max-md': { max: '767px' },
        'max-sm': { max: '639px' },
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        dash: 'dash 20s linear infinite',
        slideIn: 'slideIn 0.3s ease-out',
        float: 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.02)', filter: 'brightness(1.05)' },
        },
        dash: {
          to: { strokeDashoffset: '1000' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'pulse-subtle': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 107, 0, 0.2)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255, 107, 0, 0)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
    },
  },
  plugins: [],
};
