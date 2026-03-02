import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        praow: {
          50: "#eef6ff",
          100: "#d9ecff",
          500: "#1d7ff2",
          600: "#1167d8",
          700: "#0f56b2"
        }
      },
      boxShadow: {
        soft: "0 20px 50px rgba(17, 103, 216, 0.12)"
      }
    }
  },
  plugins: []
};
export default config;
