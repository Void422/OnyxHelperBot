import { LevelsConfigPage } from "@/components/levels-config-page";

export default async function LevelsRoute({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <LevelsConfigPage guildId={guildId} />;
}
