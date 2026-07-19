/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f5f5f7',
        card: '#ffffff',
        border: '#e5e5ea',
        accent: {
          blue: '#0071e3',
          indigo: '#5856d6',
          cyan: '#32ade6',
          emerald: '#34c759',
          rose: '#ff3b30',
          amber: '#ff9500',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%)",
      },
      boxShadow: {
        'glow-indigo': '0 4px 12px rgba(88, 86, 214, 0.15)',
        'glow-cyan': '0 4px 12px rgba(50, 173, 230, 0.15)',
        'glow-rose': '0 4px 12px rgba(255, 59, 48, 0.15)',
        'apple-card': '0 4px 20px rgba(0, 0, 0, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
