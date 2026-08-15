import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = { title: "Settings" };
export default async function GuildSettings({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <SettingsPage guildId={guildId} />; }
