import type { NodeShape } from "../model/scene";


export interface ImportedNode {

  id: string;
  label: string;
  shape: NodeShape;

  x: number;
  y: number;
  w: number;
  h: number;

  parent?: string;
}

export interface ImportedEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}


export interface ImportedGroup {
  id: string;
  label: string;
}


export interface ImportedModel {
  nodes: ImportedNode[];
  edges: ImportedEdge[];
  groups: ImportedGroup[];


  warnings: string[];
}

export function emptyModel(): ImportedModel {
  return { nodes: [], edges: [], groups: [], warnings: [] };
}


export class ImportError extends Error {
  constructor(
    message: string,

    readonly remedy: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
