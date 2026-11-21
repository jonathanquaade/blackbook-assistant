"use client";

import { Bookmark, Check, MapPin } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Artwork } from "./artwork";
import { Modal } from "./modal";
import { useWorkspace } from "./workspace-provider";

export function ProfileDialog({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  const { state, toggleShortlist } = useWorkspace();
  const saved = !!profile && state.shortlist.includes(profile.id);
  return (
    <Modal
      open={!!profile}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={profile?.name ?? "Profile"}
      description="Fictional profile · original sample projects · sandbox only"
      wide
    >
      {profile && (
        <div className="profile-detail">
          <div className="profile-intro">
            <div>
              <span className="eyebrow">{profile.role}</span>
              <p>{profile.summary}</p>
              <span className="location">
                <MapPin size={13} />
                {profile.location}
                <span>·</span>
                {profile.workStatus === "Unknown"
                  ? "Work status unknown"
                  : profile.workStatus}
              </span>
            </div>
            <button
              className={saved ? "button secondary" : "button primary"}
              onClick={() => toggleShortlist(profile.id)}
            >
              {saved ? <Check size={15} /> : <Bookmark size={15} />}{" "}
              {saved ? "Shortlisted" : "Save to shortlist"}
            </button>
          </div>
          <div className="tag-list">
            <span
              className={
                profile.status === "Needs Review" ? "tag review-warning" : "tag"
              }
            >
              {profile.status}
              {profile.status === "Needs Review"
                ? " · not verified"
                : " sample"}
            </span>
            {profile.capabilities.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <section className="evidence-box">
            <p className="fine-print">
              Owner signals (read-only): Rating{" "}
              {profile.rating ?? "not recorded"}; Work With?{" "}
              {profile.workWith ?? "not recorded"}; Worked Together{" "}
              {profile.workedTogether ?? "not recorded"}.
            </p>
            <h3>What the work shows</h3>
            {profile.evidence.map((item) => (
              <p key={item}>
                <Check size={14} />
                {item}
              </p>
            ))}
            <small>
              Evidence refers to demo projects, not a researched person.
              Availability is not known.
            </small>
          </section>
          <div className="section-heading">
            <h3>Selected work</h3>
            <span>{profile.projects.length} sample images</span>
          </div>
          <div className="profile-projects">
            {profile.projects.map((project, index) => (
              <figure key={project.id}>
                <Artwork project={project} variation={index} />
                <figcaption>
                  <strong>{project.title}</strong>
                  <p>{project.description}</p>
                  <small>{project.credit}</small>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="fine-print">
            No real portfolio links or Notion data are connected in this
            preview. Verification dates are intentionally absent.
          </p>
        </div>
      )}
    </Modal>
  );
}
