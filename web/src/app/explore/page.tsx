import { Explore } from "@/components/explore";
import { LiveExplore } from "@/components/live-explore";
import { ownerPassword } from "@/lib/live/auth";
import { requireOwner } from "@/lib/live/guard";
import { indexSummary } from "@/lib/live/service";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  if (!ownerPassword()) return <Explore />;
  // The page itself carries owner-only counts, so it is gated here as well as in proxy.ts.
  if (await requireOwner(await headers())) return <p>Blackbook owner access required.</p>;
  const summary = await indexSummary();
  if (!summary) return (
    <section className="page-content" aria-live="polite">
      <h1>Explore</h1>
      <p>Your Notion catalog isn’t indexed yet. On Vercel the index is built at deploy time; check the deployment build log. Self-hosted, reload after the first sync completes.</p>
    </section>
  );
  return <LiveExplore builtAt={summary.builtAt} entries={summary.entries} />;
}
