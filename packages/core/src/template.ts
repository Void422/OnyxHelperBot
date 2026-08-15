export const templatePlaceholders = [
  "user",
  "mention",
  "username",
  "server",
  "memberCount",
  "level",
  "xp",
  "moderator",
  "reason",
  "ticket",
  "prize",
] as const;

export type TemplatePlaceholder = (typeof templatePlaceholders)[number];
export type TemplateValues = Partial<Record<TemplatePlaceholder, string | number>>;

const placeholderPattern = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const supported = new Set<string>(templatePlaceholders);

export function unknownTemplatePlaceholders(template: string) {
  return [...new Set([...template.matchAll(placeholderPattern)].map((match) => match[1]).filter((name) => !supported.has(name)))];
}

export function renderTemplate(template: string, values: TemplateValues) {
  return template.replace(placeholderPattern, (match, name: string) => {
    if (!supported.has(name)) return match;
    const value = values[name as TemplatePlaceholder];
    return value === undefined ? match : String(value);
  });
}
