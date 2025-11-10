/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        agent: {
          peacock: '#7e3fd6',
          rant: '#d63f7e',
          vent: '#3f7ed6',
          ascii: '#3fd67e'
        }
      }
    }
  },
  plugins: []
};
