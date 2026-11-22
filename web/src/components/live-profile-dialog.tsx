"use client";

import { ArrowUpRight, Check, MapPin, Sparkles } from "lucide-react";
import type { LiveResult } from "@/lib/live/search";
import { Modal } from "./modal";
import { WorkImage } from "./work-image";

export const notionUrl = (pageId: string) => `https://www.notion.so/${pageId.replace(/-/g, "")}`;

export function LiveProfileDialog({ result, onClose }: { result: LiveResult | null; onClose: () => void }) {
  const work = result?.projects.filter((project) => !project.contextShot && (project.images.length || project.link)) ?? [];
  const context = result?.projects.filter((project) => project.contextShot && project.images.length) ?? [];
  return (
    <Modal
      open={!!result}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={result?.name ?? "Profile"}
      description={result ? `Verified · rated ${result.rating} · from your Notion` : ""}
      wide
    >
      {result && (
        <div className="profile-detail">
          <div className="profile-intro">
            <div>
              <span className="eyebrow">{result.role}</span>
              <span className="location">
                <MapPin size={13} />
                {result.locations.join(", ") || "Location not recorded"}
                <span>·</span>
                {result.workStatus === "Unknown" ? "Work status unknown" : result.workStatus}
              </span>
            </div>
            <div className="profile-source-links">
              {result.pageIds.map((pageId, index) => (
                <a key={pageId} className="button secondary" href={notionUrl(pageId)} target="_blank" rel="noreferrer">
                  {result.pageIds.length === 1 ? "Open in Notion" : `Open Notion source ${index + 1}`} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </div>
          <div className="tag-list">
            <span className="tag">Verified · {result.rating}</span>
            {result.capabilities.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          {result.reason && (
            <section className="evidence-box">
              <h3>Why it matched</h3>
              <p>
                <Sparkles size={14} />
                {result.reason}
              </p>
              {result.matchedTerms.length > 0 && (
                <p>
                  <Check size={14} />
                  Found in the entry: {result.matchedTerms.join(", ")}
                </p>
              )}
              <small>Evidence is the work and tags in your Notion entry. Availability is not known.</small>
            </section>
          )}
          <div className="section-heading">
            <h3>Selected work</h3>
            <span>{work.length} projects</span>
          </div>
          <div className="profile-projects">
            {[...work, ...context].map((project, index) => (
              <figure key={`${project.caption}-${index}`}>
                {project.images.length > 0 && (
                  <div className="profile-project-images">
                    {project.images.map((image, imageIndex) => (
                      <WorkImage
                        key={`${image.pageId}/${image.file}`}
                        image={image}
                        alt={`${project.caption ?? `${result.name} work`}${project.images.length > 1 ? `, image ${imageIndex + 1}` : ""}`}
                      />
                    ))}
                  </div>
                )}
                <figcaption>
                  <strong>{project.caption ?? "Uncaptioned work"}</strong>
                  {project.link && (
                    <small>
                      <a href={project.link} target="_blank" rel="noreferrer">
                        {project.images.length ? "Source" : "Open project"} <ArrowUpRight size={11} />
                      </a>
                    </small>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
