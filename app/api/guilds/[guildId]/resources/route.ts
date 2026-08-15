import { requireGuildAccess } from "@/lib/server/auth";
import { ApiError, apiFailure, json } from "@/lib/server/http";
import { requireRuntimeValue } from "@/lib/server/runtime";

type Context = { params: Promise<{ guildId: string }> };

async function discordBotFetch<T>(path: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bot ${requireRuntimeValue("DISCORD_TOKEN")}` } });
  if (!response.ok) throw new ApiError(502, "Onyx could not load the server's roles and channels.", "discord_resources_failed");
  return (await response.json()) as T;
}

export async function GET(request: Request, context: Context) {
  try {
    const { guildId } = await context.params;
    await requireGuildAccess(request, guildId);
    const [channels, roles] = await Promise.all([
      discordBotFetch<Array<{ id: string; name: string; type: number; position?: number }>>(`/guilds/${guildId}/channels`),
      discordBotFetch<Array<{ id: string; name: string; color: number; position: number; managed: boolean }>>(`/guilds/${guildId}/roles`),
    ]);
    return json({
      channels: channels.filter((channel) => [0, 2, 4, 5, 13, 15, 16].includes(channel.type)),
      roles: roles.filter((role) => !role.managed && role.id !== guildId).sort((left, right) => right.position - left.position),
    });
  } catch (error) {
    return apiFailure(error);
  }
}
