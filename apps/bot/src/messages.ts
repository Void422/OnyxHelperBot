import { EmbedBuilder, type MessageCreateOptions } from "discord.js";
import type { MessageTemplate } from "@/packages/core/src/domain";
import { renderTemplate, type TemplateValues } from "@/packages/core/src/template";

export function configuredMessage(template: MessageTemplate, values: TemplateValues): MessageCreateOptions {
  const content = template.content ? renderTemplate(template.content, values).slice(0, 2_000) : undefined;
  const hasEmbed = Boolean(template.title || template.description || template.footer || template.imageUrl || template.thumbnailUrl);
  const embed = hasEmbed
    ? new EmbedBuilder()
        .setColor((template.color ?? "#242429") as `#${string}`)
        .setTitle(template.title ? renderTemplate(template.title, values).slice(0, 256) : null)
        .setDescription(template.description ? renderTemplate(template.description, values).slice(0, 4_096) : null)
        .setFooter(template.footer ? { text: renderTemplate(template.footer, values).slice(0, 2_048) } : null)
        .setImage(template.imageUrl ?? null)
        .setThumbnail(template.thumbnailUrl ?? null)
    : null;

  return {
    content,
    embeds: embed ? [embed] : [],
    allowedMentions: { users: typeof values.user === "string" ? [values.user] : [], parse: [] },
  };
}
