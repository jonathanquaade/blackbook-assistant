"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CheckCheck, ChevronDown, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { LiveBrief } from "@/lib/live/brief";
import type { LiveFilters, LiveResult } from "@/lib/live/search";
import { hasSelectedWork } from "@/lib/live/project-work";
import { CAPABILITIES, PROFILE_TYPES, WORK_STATUSES } from "@/lib/types";
import { LiveProfileDialog } from "./live-profile-dialog";
import { WorkImage } from "./work-image";

const examples = ["Type-led food packaging", "Fashion photography campaign", "3D product launch film"];

interface Response {
  mode: "hybrid" | "keyword";
  brief: LiveBrief;
  results: LiveResult[];
  ms: number;
  indexBuiltAt?: string | null;
  eligibilityCheckedAt?: string | null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function cover(result: LiveResult) {
  return (
    result.projects.find((project) => !project.contextShot && project.images.length) ??
    result.projects.find((project) => project.images.length)
  );
}

export function LiveExplore({ builtAt, entries }: { builtAt: string; entries: number }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LiveFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveResult | null>(null);
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

  const requestKey = JSON.stringify({ query, filters, muted });
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestKey,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? "Search failed");
        setData(await response.json());
        setError(null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Search failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [requestKey]);

  const brief = data?.brief;
  const interpreted = brief
    ? [
        ...(brief.freelance ? ["freelance"] : []),
        ...brief.types.map((type) => `type:${type}`),
        ...brief.locations.map((location) => `location:${location}`),
        ...brief.terms,
      ]
    : [];
  const results = data?.results ?? [];
  const strong = results.filter((result) => result.tier === "strong");
  const weak = results.filter((result) => result.tier === "weak");
  const filterCount = Object.values(filters).filter(Boolean).length;
  const groups = [
    {
      title: query ? "Strong matches" : "Verified, rated 4 and 5",
      description: query
        ? "The entry's own work or tags closely match the brief. Not an availability check."
        : "Everything Explore can show: your Verified entries rated 4 or 5, best rated first.",
      results: strong,
    },
    {
      title: "Possible matches",
      description: "Partly related work or tags. Worth a look, not a confident recommendation.",
      results: weak,
    },
  ].filter((group) => group.results.length > 0);

  function search(value: string) {
    setInput(value);
    setQuery(value.trim());
    setMuted([]);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    search(input);
  }
  function clear() {
    search("");
    setFilters({});
  }
  function removeTerm(term: string) {
    if (interpreted.length === 1) search("");
    else setMuted([...muted, term]);
  }
  const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const built = stamp(builtAt);

  return (
    <div className="explore-page page-enter">
      <section className="explore-hero">
        <div className="hero-eyebrow">
          <span className="tiny-star">✳</span> YOUR CREATIVE NETWORK
        </div>
        <h1>
          Good people.
          <br className="mobile-break" /> <span>Great work.</span>
        </h1>
        <p>Find the right people by the work they do, not just the words in their bio.</p>
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
            <small>
              {data?.mode === "keyword" ? "Keyword search (meaning search unavailable)." : "Searches meaning and keywords, privately on this server."}
            </small>
          </span>
          <button type="submit" className="search-submit" aria-label="Search Blackbook">
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
      {query && interpreted.length > 0 && (
        <div className="interpretation">
          <span>Looking for</span>
          {interpreted.map((term) => (
            <button key={term} className="intent-chip" onClick={() => removeTerm(term)} aria-label={`Remove ${term} from search`}>
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
            {query ? "Your matches" : "Your rated network"} <span>{results.length.toString().padStart(2, "0")}</span>
          </h2>
          <p>
            Index built {built} · {entries} entries
            {data?.eligibilityCheckedAt ? ` · eligibility checked ${stamp(data.eligibilityCheckedAt)}` : ""}
            {data && query ? ` · ${data.ms} ms` : ""}
          </p>
        </div>
        <div className="gallery-controls">
          <span className="verified-label">
            <CheckCheck size={13} /> Verified, rated 4 to 5 only
          </span>
          <button
            className={`button small secondary ${showFilters ? "is-active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="explore-filters"
          >
            <SlidersHorizontal size={13} />
            Filters
            {filterCount > 0 && <span className="filter-count">{filterCount}</span>}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      {showFilters && (
        <div id="explore-filters" className="filter-panel">
          <label>
            Discipline
            <select value={filters.capability ?? ""} onChange={(event) => setFilters({ ...filters, capability: event.target.value || null })}>
              <option value="">All disciplines</option>
              {CAPABILITIES.map((capability) => (
                <option key={capability}>{capability}</option>
              ))}
            </select>
          </label>
          <label>
            Work status
            <select value={filters.workStatus ?? ""} onChange={(event) => setFilters({ ...filters, workStatus: event.target.value || null })}>
              <option value="">Any work status</option>
              {WORK_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Profile type
            <select value={filters.type ?? ""} onChange={(event) => setFilters({ ...filters, type: event.target.value || null })}>
              <option value="">All profile types</option>
              {PROFILE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <button className="text-button" onClick={() => setFilters({})}>
            Reset filters
          </button>
          <small>Freelance describes work status, not current availability.</small>
        </div>
      )}
      {error ? (
        <div className="empty-state">
          <h3>Search is unavailable.</h3>
          <p>{error}</p>
        </div>
      ) : loading && !data ? (
        <div className="empty-state">
          <p>Loading your network…</p>
        </div>
      ) : results.length > 0 ? (
        <div className={`result-groups ${loading ? "is-loading" : ""}`}>
          {query && strong.length === 0 && (
            <div className="result-group-heading">
              <h3>No strong match in your rated catalog</h3>
              <p>Nothing Verified and rated 4 or 5 clearly fits. The closest entries are below.</p>
            </div>
          )}
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <div className="result-group-heading">
                <h3>
                  {group.title} <span>{group.results.length}</span>
                </h3>
                <p>{group.description}</p>
              </div>
              <div className="profile-grid">
                {group.results.map((result, index) => {
                  const project = cover(result);
                  const workCount = result.projects.filter(hasSelectedWork).length;
                  return (
                    <article className="profile-card" key={result.id} style={{ animationDelay: `${index * 45}ms` }}>
                      <div className="card-work">
                        <button className="work-open" onClick={() => setSelected(result)} aria-label={`View ${result.name}’s work`}>
                          <WorkImage
                            image={project?.images[0]}
                            alt={project?.caption ?? `${result.name} work`}
                            emptyLabel={workCount ? "Work links in profile" : undefined}
                          />
                          <span className="view-work">
                            View selected work <ArrowRight size={13} />
                          </span>
                        </button>
                        <span className="work-count">{workCount} projects</span>
                      </div>
                      <div className="profile-card-body">
                        <button className="card-profile-link" onClick={() => setSelected(result)}>
                          <span className={`avatar avatar-${index % 4}`}>{initials(result.name)}</span>
                          <span>
                            <strong>
                              {result.name}
                              <CheckCheck size={13} aria-label={`Verified, rated ${result.rating}`} />
                            </strong>
                            <small>{result.role}</small>
                          </span>
                          <ArrowRight className="profile-arrow" size={15} />
                        </button>
                        <div className="profile-meta">
                          <span>{result.locations.join(", ") || "Location not recorded"}</span>
                          <span className={result.workStatus === "Freelance" ? "work-status freelance" : "work-status"}>
                            <span />
                            {result.workStatus === "Unknown" ? "Status unknown" : result.workStatus}
                          </span>
                        </div>
                        <div className="tag-list">
                          <span className="tag">Rated {result.rating}</span>
                          {result.capabilities.slice(0, 2).map((tag) => (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                          {result.capabilities.length > 2 && (
                            <span className="tag tag-count" title={result.capabilities.slice(2).join(", ")}>
                              +{result.capabilities.length - 2}
                            </span>
                          )}
                        </div>
                        {query && result.reason && (
                          <div className="match-reason">
                            <Sparkles size={12} />
                            <p>{result.reason}</p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Search size={25} />
          </span>
          <h3>No match in your rated catalog.</h3>
          <p>Nothing Verified and rated 4 or 5 fits this brief. Try fewer terms or relax a filter.</p>
          <button className="button secondary" onClick={clear}>
            Clear brief and filters
          </button>
        </div>
      )}
      {results.length > 0 && (
        <div className="gallery-end">
          <span />
          <p>
            That’s everyone who fits. <ArrowDown size={12} />
          </p>
          <span />
        </div>
      )}
      <LiveProfileDialog result={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
