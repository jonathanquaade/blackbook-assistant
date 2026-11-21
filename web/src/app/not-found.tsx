import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>This page isn’t in the book.</h1>
      <p>Head back to your creative network.</p>
      <Link className="button primary" href="/explore">
        Back to Explore
      </Link>
    </div>
  );
}
