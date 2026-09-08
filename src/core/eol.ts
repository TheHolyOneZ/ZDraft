

export type Eol = "\n" | "\r\n";


export function detectEol(source: string): Eol {
  return source.includes("\r\n") ? "\r\n" : "\n";
}


export function toLf(source: string): string {
  return source.includes("\r") ? source.replace(/\r\n?/g, "\n") : source;
}


export function withEol(source: string, eol: Eol): string {
  return eol === "\n" ? source : source.replace(/\n/g, "\r\n");
}
