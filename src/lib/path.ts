

const SEPARATOR = /[\\/]/;


export function baseName(path: string): string {
  const parts = path.split(SEPARATOR).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}


export function joinPath(dir: string, name: string): string {
  const separator = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${separator}${name}`;
}
