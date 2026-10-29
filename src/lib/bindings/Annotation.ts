import type { AnnotationKind } from "./AnnotationKind";

export type Annotation = { kind: AnnotationKind, at: [number, number], size?: [number, number] | null, points?: Array<[number, number]>, text?: string | null, color?: string | null, anchor?: string | null, };
