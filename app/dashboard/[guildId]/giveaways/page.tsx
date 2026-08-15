import type { Metadata } from "next";
import { GiveawaysPage } from "@/components/giveaways-page";
export const metadata: Metadata = { title: "Giveaways" };
export default async function Page({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <GiveawaysPage guildId={guildId} />; }
