

const NARROW = new Set("ijlt.,:;|!'`()[]{}/\\ ￼".split(""));
const WIDE = new Set("mwMW@%".split(""));
const CAPS = /[A-Z]/;
const DIGIT = /[0-9]/;

const RATIO = {
  narrow: 0.3,
  wide: 0.88,
  caps: 0.66,
  digit: 0.56,
  space: 0.26,
  other: 0.53,
} as const;

function charRatio(ch: string): number {
  if (ch === " ") return RATIO.space;
  if (NARROW.has(ch)) return RATIO.narrow;
  if (WIDE.has(ch)) return RATIO.wide;
  if (CAPS.test(ch)) return RATIO.caps;
  if (DIGIT.test(ch)) return RATIO.digit;

  if (ch.codePointAt(0)! > 0x2e80) return 1;
  return RATIO.other;
}

export function measureText(text: string, fontSize: number, weight = 400): number {
  let em = 0;
  for (const ch of text) em += charRatio(ch);

  return em * fontSize * (weight >= 600 ? 1.03 : 1);
}


export function measureMono(text: string, fontSize: number): number {
  return [...text].length * fontSize * 0.6;
}


export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight = 400,
  maxLines = 8,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;

      const candidate = current + word;
      if (measureText(candidate, fontSize, weight) <= maxWidth || current === "") {

        if (current === "" && measureText(word, fontSize, weight) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (measureText(chunk + ch, fontSize, weight) > maxWidth && chunk !== "") {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
          continue;
        }
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = word.trimStart();
      }
    }

    if (current.trim() !== "" || lines.length === 0) lines.push(current.trimEnd());
  }

  if (lines.length <= maxLines) return lines;


  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = truncateToWidth(kept[maxLines - 1] + "…", maxWidth, fontSize, weight);
  return kept;
}

export function truncateToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight = 400,
): string {
  if (measureText(text, fontSize, weight) <= maxWidth) return text;

  let out = "";
  for (const ch of text) {
    if (measureText(out + ch + "…", fontSize, weight) > maxWidth) break;
    out += ch;
  }
  return out.trimEnd() + "…";
}

export interface TextLine {
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  size: number;
  weight: number;

  muted?: boolean;
  italic?: boolean;
}

export const LINE_HEIGHT = 1.32;


export function centeredLines(
  lines: string[],
  box: { x: number; y: number; w: number; h: number },
  size: number,
  weight = 500,
): TextLine[] {
  const lineHeight = size * LINE_HEIGHT;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = box.y + box.h / 2 - blockHeight / 2 + size * 0.82;

  return lines.map((text, i) => ({
    text,
    x: box.x + box.w / 2,
    y: firstBaseline + i * lineHeight,
    anchor: "middle" as const,
    size,
    weight,
  }));
}

export interface FittedLabel {
  lines: string[];
  size: number;
}


export function fitLabel(
  text: string,
  box: { w: number; h: number },
  baseSize: number,
  weight = 500,
  minScale = 0.78,
  maxLines = 6,
): FittedLabel {
  const floor = baseSize * minScale;

  if (!text.includes("\n")) {
    const width = measureText(text, baseSize, weight);
    if (width <= box.w) return { lines: [text], size: baseSize };

    const scaled = baseSize * (box.w / width);
    if (scaled >= floor) return { lines: [text], size: scaled };
  }

  let size = baseSize;
  for (let attempt = 0; attempt < 4; attempt++) {
    const lines = wrapText(text, box.w, size, weight, maxLines);
    const fitsHeight = lines.length * size * LINE_HEIGHT <= box.h + 2;
    const fitsWidth = lines.every((l) => measureText(l, size, weight) <= box.w + 0.5);
    if (fitsHeight && fitsWidth) return { lines, size };

    const next = size * 0.9;
    if (next < floor) break;
    size = next;
  }

  return { lines: wrapText(text, box.w, size, weight, maxLines), size };
}
