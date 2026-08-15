import { AutomodPage } from "@/components/automod-page";

export default async function AutomodRoute({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <AutomodPage guildId={guildId} />;
}
