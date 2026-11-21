import { Explore } from "@/components/explore";
import { LiveExplore } from "@/components/live-explore";
import { readStatus } from "@/lib/live/store";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const lastGood = readStatus().lastGood;
  if (!lastGood) return <Explore />;
  return <LiveExplore syncedAt={lastGood.at} entries={lastGood.merged} />;
}
