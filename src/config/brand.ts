/**
 * RecoVault brand configuration (from brand/BRAND_TOKENS.json). Presentation
 * only — brand strings never enter the domain namespace (`marketplace-recovery`).
 * Gold signals recovered/verified value and must stay restrained; green means
 * actually-verified recovery only.
 */
export const BRAND = {
  name: "RecoVault",
  tagline: "SCAN • PROVE • RECOVER",
  colors: {
    navy950: "#071B38",
    navy900: "#0A2854",
    navy800: "#103A73",
    blue700: "#164E9A",
    blue600: "#1D62C5",
    gold600: "#C99118",
    gold500: "#D9A62E",
    gold400: "#E6BC5A",
    ink: "#111827",
    slate700: "#334155",
    slate500: "#64748B",
    slate300: "#CBD5E1",
    slate200: "#E2E8F0",
    surface: "#FFFFFF",
    surfaceWarm: "#FBFAF7",
    background: "#F6F8FB",
    success: "#16805B",
    warning: "#A66A12",
    danger: "#B42318",
    info: "#1D62C5",
  },
  assets: {
    favicon: "/brand/favicon-master.png",
    website: "/brand/website-logo-master.png",
    wordmark: "/brand/wordmark-lockup-master.png",
    symbol: "/brand/r-symbol-master.png",
  },
} as const;

export type BrandLogoVariant = "website" | "wordmark" | "symbol" | "favicon";
