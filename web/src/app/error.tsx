"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Something interrupted the view.</h1>
      <p>Your local demo data has not been cleared.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
