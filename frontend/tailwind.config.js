/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 纸面 · 米色调
        paper: {
          50:  "#fdfbf6", // 最浅，几乎是纸白
          100: "#faf6ee", // 主背景
          200: "#f4ecdd", // 卡片悬停
          300: "#e8dcc4", // 分隔线 / 边框
          400: "#c9b994", // 弱化边框
        },
        ink: {
          900: "#2a241c", // 主文字
          700: "#4a3f30", // 次级文字
          500: "#7a6c55", // 辅助文字
          400: "#a89779", // 占位/禁用
          300: "#c9bba0", // 极淡
        },
        // 暖橙赭石 · 主强调色
        accent: {
          50:  "#fdf3eb",
          100: "#f8e0cc",
          400: "#d89163",
          500: "#c97b4a", // 主
          600: "#b3683a",
          700: "#8f4f2c",
        },
        // 状态色（去饱和，融入米色基调）
        success: {
          50:  "#eef4ee",
          500: "#6b8e6b",
          700: "#4a6b4a",
        },
        warn: {
          50:  "#fbf2e0",
          500: "#c89a3c",
          700: "#8b6a26",
        },
        danger: {
          50:  "#f6e8e3",
          500: "#a85a45",
          700: "#7a3e2e",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI",
          "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif",
        ],
        serif: [
          '"Noto Serif SC"', '"Source Han Serif SC"',
          '"Songti SC"', '"STSong"', "Georgia", "serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(74,63,48,0.04), 0 2px 8px rgba(74,63,48,0.04)",
        warm: "0 2px 12px rgba(201,123,74,0.12)",
        lift: "0 4px 16px rgba(74,63,48,0.08)",
      },
      borderRadius: {
        DEFAULT: "6px",
        lg: "10px",
        xl: "14px",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out both",
        "shimmer": "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
