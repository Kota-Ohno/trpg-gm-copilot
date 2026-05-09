// @ts-expect-error Vitest runs in Node, but this Vite app intentionally does not include @types/node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function readHslVar(name: string): [number, number, number] {
  const match = styles.match(new RegExp(`${name}:\\s*([0-9.]+)\\s+([0-9.]+)%\\s+([0-9.]+)%`));

  if (!match) {
    throw new Error(`Missing CSS color token: ${name}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) {
    [red, green, blue] = [chroma, x, 0];
  } else if (h < 120) {
    [red, green, blue] = [x, chroma, 0];
  } else if (h < 180) {
    [red, green, blue] = [0, chroma, x];
  } else if (h < 240) {
    [red, green, blue] = [0, x, chroma];
  } else if (h < 300) {
    [red, green, blue] = [x, 0, chroma];
  } else {
    [red, green, blue] = [chroma, 0, x];
  }

  return [red + m, green + m, blue + m].map((value) => Math.round(value * 255)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  return rgb
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const foregroundLuminance = relativeLuminance(hslToRgb(foreground));
  const backgroundLuminance = relativeLuminance(hslToRgb(background));

  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe("CSS color tokens", () => {
  it("keeps primary text/control pairs above WCAG AA contrast for normal text", () => {
    const pairs = [
      ["foreground on background", "--foreground", "--background"],
      ["muted foreground on muted", "--muted-foreground", "--muted"],
      ["primary foreground on primary", "--primary-foreground", "--primary"],
      ["destructive foreground on destructive", "--destructive-foreground", "--destructive"],
      ["public ink on public paper", "--public-ink", "--public-paper"],
      ["white on public seaglass", "--primary-foreground", "--public-seaglass"],
      ["public ink on public signal", "--public-ink", "--public-signal"],
    ] as const;

    for (const [label, foreground, background] of pairs) {
      expect(contrastRatio(readHslVar(foreground), readHslVar(background)), label).toBeGreaterThanOrEqual(4.5);
    }
  });
});
