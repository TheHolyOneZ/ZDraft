const SEPARATOR = /[\\/]/;

export function baseName(path: string): string {
  const parts = path.split(SEPARATOR).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function joinPath(dir: string, name: string): string {
  const separator = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${name}`;
}

export function dirName(path: string): string {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (at < 0) return "";
  if (at === 0) return path[0]!;
  if (at === 2 && path[1] === ":") return path.slice(0, 3);
  return path.slice(0, at);
}

export function splitExtension(name: string): { stem: string; ext: string } {
  const at = name.lastIndexOf(".");
  if (at <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, at), ext: name.slice(at + 1) };
}

export function samePath(a: string, b: string): boolean {
  const windows = /^[a-z]:[\\/]/i.test(a) || a.includes("\\");
  const norm = (p: string) => {
    const unified = p.replace(/[\\/]+/g, "/").replace(/\/$/, "");
    return windows ? unified.toLowerCase() : unified;
  };
  return norm(a) === norm(b);
}
