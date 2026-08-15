import { env } from "cloudflare:workers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ticketParticipants, tickets } from "@/db/schema";
import { recordAudit } from "@/lib/server/audit";
import { requireServiceToken } from "@/lib/server/auth";
import { ApiError, apiFailure, json, readJson } from "@/lib/server/http";
import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
const createSchema = z.object({ guildId: snowflake, channelId: snowflake, ownerUserId: snowflake, department: z.string().min(1).max(40).default("general") });
const updateSchema = z.object({
  guildId: snowflake,
  channelId: snowflake,
  actorUserId: snowflake,
  action: z.enum(["claim", "close", "reopen", "participant_add", "participant_remove"]),
  userId: snowflake.optional(),
  reason: z.string().max(1_000).optional(),
});

export async function GET(request: Request) {
  try {
    requireServiceToken(request);
    const url = new URL(request.url);
    const guildId = url.searchParams.get("guildId") ?? "";
    const channelId = url.searchParams.get("channelId");
    const ownerUserId = url.searchParams.get("ownerUserId");
    if (!snowflake.safeParse(guildId).success || (channelId && !snowflake.safeParse(channelId).success) || (ownerUserId && !snowflake.safeParse(ownerUserId).success)) throw new ApiError(400, "The ticket lookup is invalid.", "validation_failed");
    const database = getDb();
    if (channelId) {
      const [ticket] = await database.select().from(tickets).where(and(eq(tickets.guildId, guildId), eq(tickets.channelId, channelId))).limit(1);
      if (!ticket) throw new ApiError(404, "This channel is not an Onyx ticket.", "ticket_not_found");
      const participants = await database.select().from(ticketParticipants).where(eq(ticketParticipants.ticketId, ticket.id));
      return json({ ticket, participants });
    }
    const rows = await database.select().from(tickets).where(ownerUserId ? and(eq(tickets.guildId, guildId), eq(tickets.ownerUserId, ownerUserId), inArray(tickets.status, ["open", "claimed"])) : eq(tickets.guildId, guildId)).orderBy(desc(tickets.createdAt)).limit(ownerUserId ? 10 : 25);
    return json({ tickets: rows });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The ticket record is incomplete.", "validation_failed", parsed.error.flatten());
    const allocation = await env.DB.prepare(`UPDATE guilds SET next_ticket_number = next_ticket_number + 1, updated_at = ?2 WHERE id = ?1 RETURNING next_ticket_number - 1 AS ticket_number`).bind(parsed.data.guildId, Date.now()).first<{ ticket_number: number }>();
    if (!allocation) throw new ApiError(404, "Onyx is not registered in that server.", "guild_not_registered");
    const ticket = { id: crypto.randomUUID(), ticketNumber: allocation.ticket_number, ...parsed.data };
    await getDb().insert(tickets).values(ticket);
    await recordAudit({ guildId: ticket.guildId, actorUserId: ticket.ownerUserId, source: "bot", action: "ticket.created", targetType: "ticket", targetId: ticket.id, after: { ticketNumber: ticket.ticketNumber, channelId: ticket.channelId } });
    return json({ ticket }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireServiceToken(request);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "The ticket update is invalid.", "validation_failed", parsed.error.flatten());
    const database = getDb();
    const [current] = await database.select().from(tickets).where(and(eq(tickets.guildId, parsed.data.guildId), eq(tickets.channelId, parsed.data.channelId))).limit(1);
    if (!current) throw new ApiError(404, "This channel is not an Onyx ticket.", "ticket_not_found");
    const now = new Date();
    if (parsed.data.action === "claim") {
      if (current.status === "closed") throw new ApiError(409, "Closed tickets cannot be claimed.", "ticket_state_invalid");
      await database.update(tickets).set({ status: "claimed", claimedBy: parsed.data.actorUserId, updatedAt: now }).where(eq(tickets.id, current.id));
    }
    if (parsed.data.action === "close") {
      if (current.status === "closed") throw new ApiError(409, "This ticket is already closed.", "ticket_state_invalid");
      await database.update(tickets).set({ status: "closed", closeReason: parsed.data.reason?.trim() || "No close reason was provided.", closedAt: now, updatedAt: now }).where(eq(tickets.id, current.id));
    }
    if (parsed.data.action === "reopen") {
      if (current.status !== "closed") throw new ApiError(409, "Only a closed ticket can be reopened.", "ticket_state_invalid");
      await database.update(tickets).set({ status: "open", closeReason: null, closedAt: null, updatedAt: now }).where(eq(tickets.id, current.id));
    }
    if (parsed.data.action === "participant_add" || parsed.data.action === "participant_remove") {
      if (!parsed.data.userId) throw new ApiError(400, "Choose a ticket participant.", "validation_failed");
      if (parsed.data.action === "participant_add") await database.insert(ticketParticipants).values({ ticketId: current.id, userId: parsed.data.userId, addedBy: parsed.data.actorUserId }).onConflictDoNothing();
      else await database.delete(ticketParticipants).where(and(eq(ticketParticipants.ticketId, current.id), eq(ticketParticipants.userId, parsed.data.userId)));
    }
    const [updated] = await database.select().from(tickets).where(eq(tickets.id, current.id)).limit(1);
    await recordAudit({ guildId: current.guildId, actorUserId: parsed.data.actorUserId, source: "bot", action: `ticket.${parsed.data.action}`, targetType: "ticket", targetId: current.id, before: current as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown> });
    return json({ ticket: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
