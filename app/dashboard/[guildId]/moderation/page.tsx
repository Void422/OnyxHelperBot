import type { Metadata } from "next";
import { ModerationPage } from "@/components/moderation-page";
export const metadata: Metadata = { title: "Moderation" };
export default async function Page({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <ModerationPage guildId={guildId} />; }
