import { EmbedBuilder, type Client } from "discord.js";
import type { OnyxApiClient, TemporaryJob } from "../api-client";
import { sendGuildLog } from "../events/logging";
import { grantWinnerRoles, winnerAnnouncement } from "../giveaway-events";
import { logger } from "../logger";

function payload(job: TemporaryJob) {
  if (typeof job.payload !== "string") return job.payload;
  try {
    return JSON.parse(job.payload) as Record<string, string>;
  } catch {
    return {};
  }
}

async function executeTemporaryJob(client: Client<true>, job: TemporaryJob) {
  const guild = client.guilds.cache.get(job.guild_id) ?? (await client.guilds.fetch(job.guild_id));
  const data = payload(job);
  if (job.action === "unban") await guild.bans.remove(job.user_id, "Temporary ban expired").catch((error) => {
    if ((error as { code?: number }).code !== 10026) throw error;
  });
  if (job.action === "untimeout") {
    const member = await guild.members.fetch(job.user_id);
    await member.timeout(null, "Temporary timeout expired");
  }
  if (job.action === "remove_role" && data.roleId) {
    const member = await guild.members.fetch(job.user_id);
    await member.roles.remove(data.roleId, "Temporary role expired");
  }
  if (job.action === "unlock_channel" && data.channelId) {
    const channel = await guild.channels.fetch(data.channelId);
    if (channel && "permissionOverwrites" in channel) await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason: "Temporary lock expired" });
  }
  if (job.action === "add_roles" && data.roleIds) {
    const member = await guild.members.fetch(job.user_id).catch(() => null);
    if (member) await member.roles.add(data.roleIds.split(",").filter(Boolean), "Delayed Onyx autorole configuration");
  }
}

async function announceGiveaways(client: Client<true>, api: OnyxApiClient) {
  const result = await api.endDueGiveaways();
  for (const giveaway of result.giveaways) {
    try {
      const guild = client.guilds.cache.get(giveaway.guildId) ?? (await client.guilds.fetch(giveaway.guildId));
      const channel = await guild.channels.fetch(giveaway.channelId);
      if (!channel?.isTextBased() || channel.isDMBased() || !("send" in channel)) continue;
      if (giveaway.messageId) {
        const original = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (original) {
          const embed = EmbedBuilder.from(original.embeds[0] ?? new EmbedBuilder()).setFooter({ text: `Ended · ${giveaway.eligibleEntryCount} eligible entries` });
          await original.edit({ embeds: [embed], components: [] });
        }
      }
      await grantWinnerRoles(guild, api, giveaway);
      await channel.send(await winnerAnnouncement(guild, api, giveaway));
      await sendGuildLog(guild, api, "giveaways", { embeds: [new EmbedBuilder().setColor(0xe0aa4f).setTitle("Giveaway ended automatically").setDescription(`**${giveaway.prize}** ended with ${giveaway.eligibleEntryCount} eligible entr${giveaway.eligibleEntryCount === 1 ? "y" : "ies"}.`).setTimestamp()] });
    } catch (error) {
      logger.error({ event: "giveaway.announcement_failed", giveawayId: giveaway.id, error });
    }
  }
}

async function deliverReminders(client: Client<true>, api: OnyxApiClient) {
  const due = await api.claimDueReminders();
  for (const reminder of due.reminders) {
    let success = false;
    try {
      if (reminder.guildId && reminder.channelId) {
        const guild = client.guilds.cache.get(reminder.guildId) ?? await client.guilds.fetch(reminder.guildId);
        const channel = await guild.channels.fetch(reminder.channelId).catch(() => null);
        if (channel?.isTextBased() && !channel.isDMBased() && "send" in channel) {
          await channel.send({ content: `<@${reminder.userId}> — reminder: ${reminder.message}`, allowedMentions: { users: [reminder.userId] } });
          success = true;
        }
      } else {
        const user = await client.users.fetch(reminder.userId);
        await user.send(`Reminder: ${reminder.message}`);
        success = true;
      }
    } catch (error) {
      logger.warn({ event: "reminder.delivery_failed", reminderId: reminder.id, error });
    }
    await api.completeReminder(reminder.id, success);
  }
}

export function startScheduler(client: Client<true>, api: OnyxApiClient) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const due = await api.claimDueTemporaryJobs();
      for (const job of due.jobs) {
        try {
          await executeTemporaryJob(client, job);
          await api.completeTemporaryJob(job.id, true);
        } catch (error) {
          logger.error({ event: "temporary_job.failed", jobId: job.id, error });
          await api.completeTemporaryJob(job.id, false, error instanceof Error ? error.message.slice(0, 500) : "Unknown Discord error");
        }
      }
      await announceGiveaways(client, api);
      await deliverReminders(client, api);
    } catch (error) {
      logger.warn({ event: "scheduler.tick_failed", error });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 15_000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
