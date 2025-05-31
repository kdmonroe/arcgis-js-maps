module.exports = {
  content: [
    './demos/wildfires/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          '50': '#fef3ee',
          '100': '#fde6d9',
          '200': '#facdab',
          '300': '#f7ac77',
          '400': '#f28243',
          '500': '#e05e1f',
          '600': '#c84c15',
          '700': '#a53815',
          '800': '#882f18',
          '900': '#722b18',
          '950': '#3f120a',
        },
      },
      spacing: {
        '112': '28rem',
        '128': '32rem',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      boxShadow: {
        'widget': '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      opacity: {
        '85': '0.85',
        '95': '0.95',
      },
      borderRadius: {
        'widget': '10px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      }
    },
  },
  plugins: [],
} 