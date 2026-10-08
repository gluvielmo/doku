// Minimal `cn` for the icon components in components/icons/ (no Tailwind in this project,
// so no class-conflict merging is needed, just a plain truthy-join).
type ClassValue = string | number | null | boolean | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(walk);
    else out.push(String(v));
  };
  inputs.forEach(walk);
  return out.join(" ");
}
