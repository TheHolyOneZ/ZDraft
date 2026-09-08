import type { BoundaryShape, Rect } from "../model/geometry";
import type { NodeShape } from "../model/scene";
import { measureText } from "./text";


export interface ShapeGeometry {

  path: string;

  details: string[];

  boundary: BoundaryShape;


  textInset: { x: number; y: number };


  textBox?: Rect;
}

function n(v: number): string {


  return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : "0";
}

function poly(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)},${n(y)}`).join(" ") + " Z";
}


export function roundedRectPath(r: Rect, radius: number): string {
  const rad = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  const { x, y, w, h } = r;

  if (rad === 0) {
    return poly([
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  }

  return [
    `M${n(x + rad)},${n(y)}`,
    `H${n(x + w - rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + w)},${n(y + rad)}`,
    `V${n(y + h - rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + w - rad)},${n(y + h)}`,
    `H${n(x + rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x)},${n(y + h - rad)}`,
    `V${n(y + rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + rad)},${n(y)}`,
    "Z",
  ].join(" ");
}


export function ellipsePath(r: Rect): string {
  const rx = r.w / 2;
  const ry = r.h / 2;
  const cx = r.x + rx;
  const cy = r.y + ry;

  return [
    `M${n(cx - rx)},${n(cy)}`,
    `A${n(rx)},${n(ry)} 0 1 0 ${n(cx + rx)},${n(cy)}`,
    `A${n(rx)},${n(ry)} 0 1 0 ${n(cx - rx)},${n(cy)}`,
    "Z",
  ].join(" ");
}

export function shapeGeometry(shape: NodeShape, r: Rect, cornerRadius: number): ShapeGeometry {
  const { x, y, w, h } = r;
  const right = x + w;
  const bottom = y + h;
  const midX = x + w / 2;
  const midY = y + h / 2;

  const rect = (radius: number): ShapeGeometry => ({
    path: roundedRectPath(r, radius),
    details: [],
    boundary: "rect",
    textInset: { x: 8, y: 5 },
  });

  switch (shape) {
    case "rect":
      return rect(cornerRadius);

    case "round":
      return rect(Math.min(cornerRadius * 2.5, h / 2));

    case "stadium":
      return rect(h / 2);

    case "circle": {

      const d = Math.min(w, h);
      const box: Rect = { x: midX - d / 2, y: midY - d / 2, w: d, h: d };
      return {
        path: ellipsePath(box),
        details: [],
        boundary: "ellipse",
        textInset: { x: d * 0.15, y: d * 0.15 },
      };
    }

    case "ellipse":
      return {
        path: ellipsePath(r),
        details: [],


        boundary: "ellipse",
        textInset: { x: w * 0.146, y: h * 0.146 },
      };

    case "diamond":
      return {
        path: poly([
          [midX, y],
          [right, midY],
          [midX, bottom],
          [x, midY],
        ]),
        details: [],
        boundary: "diamond",
        textInset: { x: w * 0.25, y: h * 0.25 },
      };

    case "hexagon": {
      const cut = Math.min(w * 0.16, h * 0.5);
      return {
        path: poly([
          [x + cut, y],
          [right - cut, y],
          [right, midY],
          [right - cut, bottom],
          [x + cut, bottom],
          [x, midY],
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: cut + 6, y: 6 },
      };
    }

    case "parallelogram": {
      const skew = Math.min(w * 0.18, h * 0.8);
      return {
        path: poly([
          [x + skew, y],
          [right, y],
          [right - skew, bottom],
          [x, bottom],
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: skew + 6, y: 6 },
      };
    }

    case "trapezoid": {
      const inset = Math.min(w * 0.18, h * 0.8);
      return {
        path: poly([
          [x + inset, y],
          [right - inset, y],
          [right, bottom],
          [x, bottom],
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: inset + 6, y: 6 },
      };
    }

    case "cylinder": {


      const ry = Math.min(h * 0.16, w * 0.35);
      return {
        path: [
          `M${n(x)},${n(y + ry)}`,
          `A${n(w / 2)},${n(ry)} 0 0 1 ${n(right)},${n(y + ry)}`,
          `V${n(bottom - ry)}`,
          `A${n(w / 2)},${n(ry)} 0 0 1 ${n(x)},${n(bottom - ry)}`,
          "Z",
        ].join(" "),
        details: [
          `M${n(x)},${n(y + ry)} A${n(w / 2)},${n(ry)} 0 0 0 ${n(right)},${n(y + ry)}`,
        ],
        boundary: "rect",
        textInset: { x: 8, y: ry + 5 },
      };
    }

    case "note": {
      const fold = Math.min(w * 0.2, h * 0.42, 22);
      return {
        path: poly([
          [x, y],
          [right - fold, y],
          [right, y + fold],
          [right, bottom],
          [x, bottom],
        ]),
        details: [`M${n(right - fold)},${n(y)} V${n(y + fold)} H${n(right)}`],
        boundary: "rect",
        textInset: { x: 8, y: 7 },
      };
    }

    case "folder": {
      const tab = Math.min(h * 0.22, 16);
      const tabW = Math.min(w * 0.4, 60);
      return {
        path: poly([
          [x, y + tab],
          [x + tabW, y + tab],
          [x + tabW + tab, y],
          [right, y],
          [right, bottom],
          [x, bottom],
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: tab + 5 },
        textBox: { x: 8, y: tab + 5, w: Math.max(w - 16, 4), h: Math.max(h - tab - 10, 4) },
      };
    }

    case "doc": {

      const wave = Math.min(h * 0.18, 16);
      return {
        path: [
          `M${n(x)},${n(y)}`,
          `H${n(right)}`,
          `V${n(bottom - wave)}`,
          `C${n(right - w / 4)},${n(bottom)} ${n(x + w / 4)},${n(bottom - wave * 2)} ${n(x)},${n(bottom - wave)}`,
          "Z",
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: 5 },
      };
    }

    case "subroutine": {
      const bar = Math.min(w * 0.08, 12);
      return {
        path: roundedRectPath(r, 0),
        details: [
          `M${n(x + bar)},${n(y)} V${n(bottom)}`,
          `M${n(right - bar)},${n(y)} V${n(bottom)}`,
        ],
        boundary: "rect",
        textInset: { x: bar + 8, y: 6 },
      };
    }

    case "person": {


      const strip = Math.min(h * 0.32, 22);
      const figure = Math.max(h - strip, 8);
      const head = Math.min(w * 0.3, figure * 0.34, 14);
      const cx = x + w / 2;
      const bodyTop = y + head * 2 + 2;
      const bodyBottom = y + figure;
      const shoulder = Math.min(w * 0.34, 20);

      return {
        path: [
          `M${n(cx - shoulder)},${n(bodyBottom)}`,
          `V${n(bodyTop)}`,
          `A${n(shoulder)},${n(shoulder)} 0 0 1 ${n(cx + shoulder)},${n(bodyTop)}`,
          `V${n(bodyBottom)}`,
          "Z",
        ].join(" "),
        details: [
          `M${n(cx + head)},${n(y + head)} A${n(head)},${n(head)} 0 1 1 ${n(cx - head)},${n(y + head)} A${n(head)},${n(head)} 0 1 1 ${n(cx + head)},${n(y + head)} Z`,
        ],
        boundary: "rect",
        textInset: { x: 2, y: 2 },
        textBox: { x: 1, y: y + figure, w: Math.max(w - 2, 4), h: Math.max(strip, 4) },
      };
    }

    case "cloud": {


      const rx = w / 2;
      const ry = h / 2;
      return {
        path: [
          `M${n(x + rx * 0.5)},${n(bottom)}`,
          `A${n(rx * 0.34)},${n(ry * 0.4)} 0 0 1 ${n(x + rx * 0.2)},${n(y + ry * 1.1)}`,
          `A${n(rx * 0.4)},${n(ry * 0.5)} 0 0 1 ${n(x + rx * 0.62)},${n(y + ry * 0.42)}`,
          `A${n(rx * 0.44)},${n(ry * 0.52)} 0 0 1 ${n(x + rx * 1.42)},${n(y + ry * 0.38)}`,
          `A${n(rx * 0.4)},${n(ry * 0.5)} 0 0 1 ${n(x + w - rx * 0.16)},${n(y + ry * 1.12)}`,
          `A${n(rx * 0.34)},${n(ry * 0.4)} 0 0 1 ${n(x + w - rx * 0.5)},${n(bottom)}`,
          "Z",
        ].join(" "),
        details: [],
        boundary: "ellipse",
        textInset: { x: w * 0.16, y: h * 0.28 },
      };
    }

    case "step": {

      const notch = Math.min(w * 0.16, 20);
      return {
        path: poly([
          [x, y],
          [right - notch, y],
          [right, midY],
          [right - notch, bottom],
          [x, bottom],
          [x + notch, midY],
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: notch + 6, y: 5 },
      };
    }

    case "page": {


      const step = Math.min(w * 0.05, h * 0.09, 7);
      const face: Rect = { x, y: y + step * 2, w: w - step * 2, h: h - step * 2 };
      return {
        path: roundedRectPath(face, 0),
        details: [
          `M${n(x + step)},${n(y + step)} H${n(right - step)} V${n(bottom - step)}`,
          `M${n(x + step * 2)},${n(y)} H${n(right)} V${n(bottom - step * 2)}`,
        ],
        boundary: "rect",
        textInset: { x: 8, y: step * 2 + 5 },
      };
    }

    case "package": {

      const tab = Math.min(h * 0.2, 14);
      const tabW = Math.min(w * 0.42, 64);
      return {
        path: poly([
          [x, y],
          [x + tabW, y],
          [x + tabW, y + tab],
          [right, y + tab],
          [right, bottom],
          [x, bottom],
        ]),
        details: [`M${n(x)},${n(y + tab)} H${n(x + tabW)}`],
        boundary: "rect",
        textInset: { x: 8, y: tab + 5 },
        textBox: { x: 8, y: tab + 5, w: Math.max(w - 16, 4), h: Math.max(h - tab - 10, 4) },
      };
    }

    case "callout": {


      const tail = Math.min(h * 0.2, 14);
      const tailX = x + Math.min(w * 0.3, 40);
      const radius = Math.min(cornerRadius * 2, 10, (h - tail) / 2);
      const bodyBottom = bottom - tail;
      return {
        path: [
          `M${n(x + radius)},${n(y)}`,
          `H${n(right - radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(right)},${n(y + radius)}`,
          `V${n(bodyBottom - radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(right - radius)},${n(bodyBottom)}`,
          `H${n(tailX + tail)}`,
          `L${n(tailX)},${n(bottom)}`,
          `L${n(tailX)},${n(bodyBottom)}`,
          `H${n(x + radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(x)},${n(bodyBottom - radius)}`,
          `V${n(y + radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(x + radius)},${n(y)}`,
          "Z",
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: 5 },

        textBox: { x: 8, y: 5, w: Math.max(w - 16, 4), h: Math.max(bodyBottom - y - 10, 4) },
      };
    }

    case "queue": {


      const rx = Math.min(w * 0.12, 16);
      return {
        path: [
          `M${n(x + rx)},${n(y)}`,
          `H${n(right - rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(right - rx)},${n(bottom)}`,
          `H${n(x + rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(x + rx)},${n(y)}`,
          "Z",
        ].join(" "),
        details: [`M${n(right - rx)},${n(y)} A${n(rx)},${n(h / 2)} 0 0 0 ${n(right - rx)},${n(bottom)}`],
        boundary: "rect",
        textInset: { x: rx + 6, y: 5 },
      };
    }

    case "stored": {


      const rx = Math.min(w * 0.12, 16);
      return {
        path: [
          `M${n(x + rx)},${n(y)}`,
          `H${n(right)}`,
          `A${n(rx)},${n(h / 2)} 0 0 0 ${n(right)},${n(bottom)}`,
          `H${n(x + rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(x + rx)},${n(y)}`,
          "Z",
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: rx + 6, y: 5 },
      };
    }

    case "triangle": {
      return {
        path: poly([
          [midX, y],
          [right, bottom],
          [x, bottom],
        ]),
        details: [],
        boundary: "rect",

        textInset: { x: w * 0.24, y: h * 0.42 },
      };
    }

    case "text": {


      return {
        path: roundedRectPath(r, 0),
        details: [],
        boundary: "rect",
        textInset: { x: 2, y: 2 },
      };
    }

    default:
      return rect(cornerRadius);
  }
}


export function personRect(rect: Rect, label: string, fontSize: number): Rect {
  const labelW = measureText(label, fontSize, 500) + 10;
  const strip = fontSize + 10;

  const w = Math.max(rect.w, labelW);
  return { x: rect.x - (w - rect.w) / 2, y: rect.y, w, h: rect.h + strip };
}


export function isUnpainted(shape: NodeShape): boolean {
  return shape === "text";
}


export function boundaryFor(shape: NodeShape): BoundaryShape {
  switch (shape) {
    case "circle":
    case "ellipse":
    case "cloud":
      return "ellipse";
    case "diamond":
      return "diamond";
    default:
      return "rect";
  }
}
