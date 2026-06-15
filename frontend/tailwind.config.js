/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        alexa: {
          // Real Alexa app palette
          blue: '#00A8E0',        // Alexa cyan-blue
          ring: '#00CAFF',        // Ring glow (brighter)
          dark: '#121212',        // App background
          surface: '#1A1A1A',     // Surface / side panel
          card: '#242424',        // Card background
          card2: '#2E2E2E',       // Elevated card
          border: '#383838',      // Subtle borders
          text: '#FFFFFF',
          muted: '#8A8A8A',       // Secondary text
          accent: '#1A3A4A',      // Highlight accent bg
          green: '#1DB954',       // On/success
          orange: '#FF8C00',      // Warning / routines
          red: '#F44336',         // Alert
          purple: '#7B2FBE',      // Scenes
        },
      },
      animation: {
        'ring-pulse': 'ringPulse 2s ease-in-out infinite',
        'ring-listen': 'ringListen 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        ringPulse: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        ringListen: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0,168,224,0.5)' },
          '50%': { opacity: '1', transform: 'scale(1.08)', boxShadow: '0 0 0 12px rgba(0,168,224,0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.5rem',
      },
    },
  },
  plugins: [],
};
