export const ARROW_PATTERNS = [
  ["<->", "↔"], ["->", "→"], ["<-", "←"], ["=>", "⇒"], ["<=", "⇐"],
] as const;

export function editorImageUrl(project: string, documentPath: string, source: string) {
  if (/^(?:https?:|data:|\/api\/)/i.test(source)) return source;
  const base = documentPath.split("/").slice(0, -1);
  for (const part of source.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop(); else base.push(part);
  }
  return `/api/projects/${encodeURIComponent(project)}/files?path=${encodeURIComponent(base.join("/"))}`;
}

export function markdownForEditor(markdown: string, project: string, documentPath: string) {
  return markdown.replace(/!\[([^\]]*)\]\((?!https?:|data:|\/api\/)([^)\s]+)(?:\s+"([^"]*)")?\)/gi,
    (_, alt, source, title) => `![${alt}](${editorImageUrl(project, documentPath, source)}${title ? ` "${title}"` : ""})`);
}

export function markdownForSave(markdown: string, project: string, documentPath: string) {
  const prefix = `/api/projects/${encodeURIComponent(project)}/files?path=`;
  const directory = documentPath.split("/").slice(0, -1);
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/gi, (match, alt, source, title) => {
    if (!source.startsWith(prefix)) return match;
    const target = decodeURIComponent(source.slice(prefix.length)).split("/");
    let common = 0;
    while (common < directory.length && directory[common] === target[common]) common++;
    const relative = [...directory.slice(common).map(() => ".."), ...target.slice(common)].join("/") || ".";
    return `![${alt}](${relative}${title ? ` "${title}"` : ""})`;
  });
}
