/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cat: {
          yellow: "#FFCD00",
          black: "#080808",
          dark: "#111111",
          surface: "#161616",
          gray: "#6B6B6B",
          light: "#F5F5F5",
        },
        status: {
          good: "#34C759",
          fair: "#FF9F0A",
          poor: "#FF6B00",
          critical: "#FF3B30",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
        "scan-line": "scanLine 2s ease-in-out infinite",
      },
      keyframes: {
        scanLine: {
          "0%, 100%": { top: "10%" },
          "50%": { top: "85%" },
        },
      },
    },
  },
  plugins: [],
};
