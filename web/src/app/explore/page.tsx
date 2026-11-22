import { Explore } from "@/components/explore";
import { LiveExplore } from "@/components/live-explore";
import { readStatus } from "@/lib/live/store";
import { ownerPassword } from "@/lib/live/auth";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  if (!ownerPassword()) return <Explore />;
  const lastGood = readStatus().lastGood;
  if (!lastGood) return (
    <section className="page-content" aria-live="polite">
      <h1>Explore</h1>
      <p>Your Notion catalog isn’t indexed yet. Reload after the first sync completes.</p>
    </section>
  );
  return <LiveExplore syncedAt={lastGood.at} entries={lastGood.merged} />;
}
