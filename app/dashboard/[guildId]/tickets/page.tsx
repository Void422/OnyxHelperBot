import type { Metadata } from "next";
import { TicketConfigPage } from "@/components/ticket-config-page";

export const metadata: Metadata = { title: "Tickets" };
export default async function TicketsPage({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <TicketConfigPage guildId={guildId} />; }
