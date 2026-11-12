const space = {
  0: "0px",
  px: "1px",
  0.5: "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    padding: space,
    margin: { ...space, auto: "auto" },
    gap: space,
    space,
    extend: {
      colors: {
        canvas: "#000000",
        warm: "#131209",
        surface: "#181818",
        raised: "#1F1F1F",
        hover: "#272727",
        line: "#313131",
        fg: "#FFFFFF",
        "fg-muted": "#A8A8A8",
        "fg-subtle": "#8F8F8F",
        ok: "#34D399",
        warn: "#FBBF24",
        bad: "#F87171",
        info: "#818CF8",
        violet: "#A78BFA",
        cyan: "#22D3EE",
      },
      fontFamily: {
        sans: ['"Geist Variable"', "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono Variable"', '"Geist Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      transitionTimingFunction: {
        ghost: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      maxWidth: {
        hero: "680px",
      },
    },
  },
  plugins: [],
};
