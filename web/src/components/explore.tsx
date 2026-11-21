"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { profiles } from "@/lib/fixtures";
import {
  emptyFilters,
  interpretBrief,
  searchProfiles,
  type Filters,
} from "@/lib/search";
import type { Capability, Profile } from "@/lib/types";
import { Artwork } from "./artwork";
import { ProfileDialog } from "./profile-dialog";
import { useWorkspace } from "./workspace-provider";

const capabilities = [
  ...new Set(profiles.flatMap((profile) => profile.capabilities)),
].sort();
const examples = [
  "Type-led food packaging",
  "Freelance product designers",
  "Experimental motion",
];

export function Explore({
  shortlistOnly = false,
}: {
  shortlistOnly?: boolean;
}) {
  const { state, toggleShortlist } = useWorkspace();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const intent = interpretBrief(query);
  const pool = shortlistOnly
    ? profiles.filter((profile) => state.shortlist.includes(profile.id))
    : profiles;
  const results = searchProfiles(pool, query, filters, muted);
  const interpreted = [
    ...(intent.freelance && !muted.includes("freelance") ? ["freelance"] : []),
    ...intent.terms.filter((term) => !muted.includes(term)),
  ];
  const filterCount = Object.values(filters).filter(
    (value) => value !== "All",
  ).length;
  function search(value: string) {
    setInput(value);
    setQuery(value);
    setMuted([]);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    search(input);
  }
  function clear() {
    search("");
    setFilters(emptyFilters);
  }

  return (
    <div className="explore-page page-enter">
      <section className="explore-hero">
        <div className="hero-eyebrow">
          <span className="tiny-star">✳</span>{" "}
          {shortlistOnly ? "KEPT CLOSE" : "YOUR CREATIVE NETWORK"}
        </div>
        <h1>
          {shortlistOnly ? (
            <>
              The ones to <span>remember.</span>
            </>
          ) : (
            <>
              Good people.
              <br className="mobile-break" /> <span>Great work.</span>
            </>
          )}
        </h1>
        <p>
          {shortlistOnly
            ? "A small collection for the next big thing. Saved privately on this browser."
            : "Find the right people by the work they do, not just the words in their bio."}
        </p>
      </section>
      <form className="brief-box" onSubmit={submit}>
        <div className="brief-input">
          <Search size={20} />
          <textarea
            id="brief-search"
            ref={inputRef}
            aria-label="Describe the people or work you are looking for"
            placeholder="Who are you looking for? Tell us a little about the project…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            maxLength={500}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                search(input);
              }
            }}
          />
        </div>
        <div className="brief-bottom">
          <span>
            <Sparkles size={13} /> A brief, not a search term.{" "}
            <small>Local keyword search in this preview.</small>
          </span>
          <button
            type="submit"
            className="search-submit"
            aria-label="Search Blackbook"
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </form>
      <div className="suggestions">
        <span>Try a little inspiration</span>
        {examples.map((example) => (
          <button key={example} onClick={() => search(example)}>
            {example}
            <ArrowUp size={11} />
          </button>
        ))}
      </div>
      {interpreted.length > 0 && (
        <div className="interpretation">
          <span>Looking for</span>
          {interpreted.map((term) => (
            <button
              key={term}
              className="intent-chip"
              onClick={() => setMuted([...muted, term])}
              aria-label={`Remove ${term} from search`}
            >
              {term}
              <X size={11} />
            </button>
          ))}
          <button className="text-button" onClick={clear}>
            Clear brief
          </button>
        </div>
      )}
      <div className="gallery-heading">
        <div>
          <h2>
            {query
              ? "Your matches"
              : shortlistOnly
                ? "Your shortlist"
                : "A few good people"}{" "}
            <span>{results.length.toString().padStart(2, "0")}</span>
          </h2>
          <p>
            {query
              ? "Matched against demo facts and project descriptions."
              : shortlistOnly
                ? "Good taste deserves a place to live."
                : "Thoughtfully collected. Ready for your next project."}
          </p>
        </div>
        <div className="gallery-controls">
          <span className="verified-label">
            <CheckCheck size={13} /> Verified samples only
          </span>
          <button
            className={`button small secondary ${showFilters ? "is-active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="explore-filters"
          >
            <SlidersHorizontal size={13} />
            Filters
            {filterCount > 0 && (
              <span className="filter-count">{filterCount}</span>
            )}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      {showFilters && (
        <div id="explore-filters" className="filter-panel">
          <label>
            Discipline
            <select
              value={filters.capability}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  capability: event.target.value as Capability | "All",
                })
              }
            >
              <option value="All">All disciplines</option>
              {capabilities.map((capability) => (
                <option key={capability}>{capability}</option>
              ))}
            </select>
          </label>
          <label>
            Work status
            <select
              value={filters.workStatus}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  workStatus: event.target.value as Filters["workStatus"],
                })
              }
            >
              <option value="All">Any work status</option>
              <option>Freelance</option>
              <option>Studio</option>
              <option>Unknown</option>
            </select>
          </label>
          <label>
            Profile type
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  type: event.target.value as Filters["type"],
                })
              }
            >
              <option value="All">People & studios</option>
              <option>Person</option>
              <option>Studio</option>
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => setFilters(emptyFilters)}
          >
            Reset filters
          </button>
          <small>
            Freelance describes work status, not current availability.
          </small>
        </div>
      )}
      {results.length > 0 ? (
        <div className="profile-grid">
          {results.map(({ profile, reason }, index) => {
            const saved = state.shortlist.includes(profile.id);
            return (
              <article
                className="profile-card"
                key={profile.id}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="card-work">
                  <button
                    className="work-open"
                    onClick={() => setSelected(profile)}
                    aria-label={`View ${profile.name}’s work`}
                  >
                    <Artwork project={profile.projects[0]} variation={index} />
                    <span className="view-work">
                      View selected work <ArrowRight size={13} />
                    </span>
                  </button>
                  <button
                    className={`save-button ${saved ? "saved" : ""}`}
                    aria-label={`${saved ? "Remove" : "Save"} ${profile.name} ${saved ? "from" : "to"} shortlist`}
                    aria-pressed={saved}
                    onClick={() => toggleShortlist(profile.id)}
                  >
                    {saved ? <Check size={15} /> : <Bookmark size={15} />}
                  </button>
                  <span className="work-count">
                    {profile.projects.length} projects
                  </span>
                </div>
                <div className="profile-card-body">
                  <button
                    className="card-profile-link"
                    onClick={() => setSelected(profile)}
                  >
                    <span className={`avatar avatar-${index % 4}`}>
                      {profile.initials}
                    </span>
                    <span>
                      <strong>
                        {profile.name}
                        <CheckCheck size={13} />
                      </strong>
                      <small>{profile.role}</small>
                    </span>
                    <ArrowRight className="profile-arrow" size={15} />
                  </button>
                  <div className="profile-meta">
                    <span>{profile.location}</span>
                    <span
                      className={
                        profile.workStatus === "Freelance"
                          ? "work-status freelance"
                          : "work-status"
                      }
                    >
                      <span />
                      {profile.workStatus === "Unknown"
                        ? "Status unknown"
                        : profile.workStatus}
                    </span>
                  </div>
                  <div className="tag-list">
                    {profile.capabilities.slice(0, 2).map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                    {profile.capabilities.length > 2 && (
                      <span
                        className="tag tag-count"
                        title={profile.capabilities.slice(2).join(", ")}
                      >
                        +{profile.capabilities.length - 2}
                      </span>
                    )}
                  </div>
                  {query && (
                    <div className="match-reason">
                      <Sparkles size={12} />
                      <p>{reason}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            {shortlistOnly ? <Bookmark size={25} /> : <Search size={25} />}
          </span>
          <h3>
            {shortlistOnly && !query && !filterCount
              ? "A little empty. Full of possibility."
              : "No close matches in this small collection."}
          </h3>
          <p>
            {shortlistOnly && !query && !filterCount
              ? "Save people from Explore and they’ll be right here when you need them."
              : "Try fewer terms or relax a filter. We won’t fill the gap with unreviewed people."}
          </p>
          {shortlistOnly && !query && !filterCount ? (
            <a className="button primary" href="/explore">
              Find your people <ArrowRight size={14} />
            </a>
          ) : (
            <button className="button secondary" onClick={clear}>
              Clear brief and filters
            </button>
          )}
        </div>
      )}
      {results.length > 0 && (
        <div className="gallery-end">
          <span />
          <p>
            You’re in good company. <ArrowDown size={12} />
          </p>
          <span />
        </div>
      )}
      <ProfileDialog profile={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
