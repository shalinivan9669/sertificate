import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const css = await readFile(
  new URL("../assets/css/editorial.css", import.meta.url),
  "utf8",
);
const variables = Object.fromEntries(
  [...css.slice(css.indexOf('.editorial-site {'), css.indexOf('}', css.indexOf('.editorial-site {'))).matchAll(/(--ed-[\w-]+):([^;\n}]+)/g)]
    .map((match) => [match[1], match[2].trim()]),
);
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const pairs = [
  ["ink", "paper"],
  ["muted", "paper"],
  ["cream", "night"],
  ["muted-dark", "night"],
  ["night", "amber"],
  ["success", "success-bg"],
  ["error", "error-bg"],
  ["warning", "warning-bg"],
].map(([foreground, background]) => {
  const a = luminance(variables["--ed-" + foreground]),
    b = luminance(variables["--ed-" + background]);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert(ratio >= 4.5, foreground + " / " + background);
  return {
    foreground,
    background,
    contrast: Number(ratio.toFixed(2)),
    minimum: 4.5,
  };
});
const tokens = {
  name: "OT Center / Знания, на которых держится дело",
  version: 2,
  scope: ".editorial-site",
  variables,
  textPairs: pairs,
  typography: {
    display: {
      family: "OT Display",
      source: "Noto Serif Display",
      weight: 500,
      desktop: "clamp(72px,6.65vw,104px)",
      phone: "clamp(44px,12vw,67px)",
    },
    interface: { family: "OT Sans", source: "Noto Sans", size: 16 },
    reading: { size: 18, phone: 17, lineHeight: 1.85, maxMeasure: "66ch" },
    license: "SIL OFL 1.1",
    requiredCharacters: "ӘәҒғҚқҢңӨөҰұҮүҺһІіЁё№₸«»—–",
  },
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
  grid: {
    maxWidth: 1360,
    columns: 12,
    phoneGutter: 20,
    coverRatio: "desktop: copy on a calm left area, scene to the right; phone: copy above scene",
    breakpoints: [640, 700, 900, 1000, 1200],
    verificationWidths: [360, 390, 820, 1280, 1440],
  },
  borders: {
    width: 1,
    radius: 4,
    round: "only isolated direction controls and symbols",
  },
  layers: { art: -2, shade: -1, content: 0, dialog: "native top layer" },
  motion: {
    interaction: 180,
    easing: variables["--ed-ease"],
    reducedMotion: "no animation or smooth scrolling",
  },
  states: {
    control: [
      "default",
      "hover",
      "focus-visible",
      "pressed",
      "selected",
      "disabled",
      "loading",
    ],
    data: ["empty", "error", "saving", "conflict", "success"],
  },
};
await mkdir(new URL("../design-system/ot-center/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../design-system/ot-center/editorial.tokens.json", import.meta.url),
  JSON.stringify(tokens, null, 2) + "\n",
);
console.log(JSON.stringify(pairs, null, 2));
