"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCheck,
  ChevronDown,
  Compass,
  FlaskConical,
  Info,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { submissions } from "@/lib/fixtures";
import { decisionFor, isReady } from "@/lib/workspace";
import { AddDialog } from "./add-dialog";
import { Modal } from "./modal";
import { useWorkspace } from "./workspace-provider";

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { state, hydrated, notice, notify, reset } = useWorkspace();
  const [addOpen, setAddOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(timer);
  }, [notice, notify]);
  const readyCount = submissions.filter(
    (submission) => isReady(submission) && !decisionFor(state, submission),
  ).length;
  const view =
    path === "/review"
      ? "Review"
      : path === "/shortlist"
        ? "Shortlist"
        : "Explore";
  function toggleTheme() {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    try {
      localStorage.setItem("blackbook-theme", theme);
    } catch {
      /* Theme still works without storage. */
    }
  }
  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <Link href="/explore" className="brand" aria-label="Blackbook home">
          <span className="brand-mark">
            <BookOpen size={19} />
          </span>
          blackbook<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">J</span>
          <span>
            Jonathan’s workspace<small>Personal Blackbook</small>
          </span>
          <ChevronDown size={13} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <Link
            href="/explore"
            className={view === "Explore" ? "nav-item active" : "nav-item"}
            aria-current={view === "Explore" ? "page" : undefined}
          >
            <Compass size={17} />
            <span>Explore</span>
            <span className="nav-shortcut">⌘ K</span>
          </Link>
          <Link
            href="/shortlist"
            className={view === "Shortlist" ? "nav-item active" : "nav-item"}
            aria-current={view === "Shortlist" ? "page" : undefined}
          >
            <Bookmark size={17} />
            <span>Shortlist</span>
            {state.shortlist.length > 0 && (
              <span className="nav-count">{state.shortlist.length}</span>
            )}
          </Link>
          <Link
            href="/review"
            className={view === "Review" ? "nav-item active" : "nav-item"}
            aria-current={view === "Review" ? "page" : undefined}
          >
            <CheckCheck size={17} />
            <span>Review</span>
            <span className="nav-count">{hydrated ? readyCount : "…"}</span>
          </Link>
        </nav>
        <button
          className="sidebar-add"
          aria-label="Add for review"
          title="Add for review"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={15} /> Add for review
        </button>
        <div className="sidebar-bottom">
          <div className="keeper-note">
            <span className="keeper-spark">✳</span>
            <strong>Your eye. A little help.</strong>
            <p>A considered collection of people and the work they make.</p>
            <button onClick={() => setAboutOpen(true)}>
              About this preview <ArrowUpRight size={12} />
            </button>
          </div>
          <button
            className="sidebar-utility"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={14} />
            Reset demo
          </button>
          <div className="owner">
            <span className="avatar owner-avatar">JQ</span>
            <div>
              Jonathan Quaade<small>Workspace owner</small>
            </div>
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              <Moon className="moon-icon" size={16} />
              <Sun className="sun-icon" size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="private-label">
              <ShieldCheck size={13} /> Private preview
            </span>
            <button
              className="icon-button"
              aria-label="About this sandbox"
              onClick={() => setAboutOpen(true)}
            >
              <Info size={16} />
            </button>
            <button
              className="button small secondary"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} /> Add for review
            </button>
          </div>
        </header>
        <div className="preview-strip">
          <span>
            <FlaskConical size={12} />
            <strong>Sandbox</strong> Fictional profiles. Original sample work.
            Nothing writes to Notion.
          </span>
          <button onClick={() => setAboutOpen(true)}>
            What’s connected? <ArrowUpRight size={12} />
          </button>
        </div>
        <main id="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>
            <span className="status-dot" /> A thoughtful collection, always
            growing.
          </span>
          <span>BLACKBOOK / EARLY PREVIEW</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCheck size={17} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => notify("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
      <Modal
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        title="A first look at Blackbook"
        description="Slice 0 · a private, interactive product sandbox"
      >
        <div className="about-content">
          <div className="quiet-callout">
            <ShieldCheck size={20} />
            <p>
              This preview uses fictional profiles and original illustrative
              work. Your actual Blackbook records, private notes, and
              credentials are not included.
            </p>
          </div>
          <h3>You can try</h3>
          <ul>
            <li>Brief search using local keywords and editable filters.</li>
            <li>Profile galleries and a browser-local shortlist.</li>
            <li>
              Revision-aware demo review, feedback, rejection, and submissions.
            </li>
          </ul>
          <h3>Not connected yet</h3>
          <p>
            Owner authentication, live Notion sync, model-backed search, media
            hydration, production review storage, and bot jobs belong to later
            slices. The session preview itself requires Devin access.
          </p>
          <p className="fine-print">
            All decisions stay in this browser. Approval does not publish a
            profile into Explore or verify it in Notion. Use Reset demo to clear
            the sandbox. Do not enter sensitive information.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setAboutOpen(false);
              setResetOpen(true);
            }}
          >
            <RotateCcw size={14} /> Reset demo
          </button>
        </div>
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Start fresh?"
        description="This only clears demo data saved in this browser."
      >
        <div className="about-content">
          <p>
            Your shortlist, saved detail drafts, demo decisions, feedback, and
            submitted names will be cleared. No real Blackbook data is affected.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setResetOpen(false)}
            >
              Keep exploring
            </button>
            <button
              className="button danger"
              onClick={() => {
                reset();
                setResetOpen(false);
              }}
            >
              Reset demo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
