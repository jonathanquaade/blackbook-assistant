"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Link2, Sparkles } from "lucide-react";
import { profiles } from "@/lib/fixtures";
import { validateAddition } from "@/lib/workspace";
import { Modal } from "./modal";
import { useWorkspace } from "./workspace-provider";

export function AddDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, add } = useWorkspace();
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const needle = input.trim().toLowerCase();
  const duplicates =
    needle.length > 1
      ? profiles.filter((profile) =>
          profile.name.toLowerCase().includes(needle),
        )
      : [];
  const exactDuplicate =
    profiles.some((profile) => profile.name.toLowerCase() === needle) ||
    state.additions.some((addition) => addition.input.toLowerCase() === needle);
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateAddition(input);
    if (validation || exactDuplicate) {
      setError(
        validation ?? "This name or URL is already in your demo workspace.",
      );
      return;
    }
    add(input, note);
    setSubmitted(true);
  }
  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setInput("");
      setNote("");
      setError("");
      setSubmitted(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={changeOpen}
      title={submitted ? "A good find." : "Add someone to the Blackbook"}
      description="Demo submission · saved only on this browser"
    >
      {submitted ? (
        <div className="submission-success">
          <span className="success-orb">
            <Check size={27} />
          </span>
          <h3>Saved for a closer look.</h3>
          <p>
            <strong>{input}</strong> is in your demo submission list under
            Review.
          </p>
          <p className="muted">
            In the connected product, Scout, Scraper, and an independent
            Reviewer would prepare this entry. No bots or Notion writes run in
            this preview.
          </p>
          <button className="button primary" onClick={() => changeOpen(false)}>
            Back to the workspace <ArrowUpRight size={15} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="add-form">
          <label htmlFor="candidate">Name or portfolio URL</label>
          <div className="input-with-icon">
            <Link2 size={16} />
            <input
              id="candidate"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError("");
              }}
              placeholder="A name worth remembering, or https://…"
              maxLength={500}
              required
              autoComplete="off"
            />
          </div>
          {duplicates.length > 0 && (
            <div className="duplicate-box">
              <strong>Already in this demo workspace</strong>
              {duplicates.map((profile) => (
                <span key={profile.id}>
                  {profile.name} <small>{profile.role}</small>
                </span>
              ))}
            </div>
          )}
          <label htmlFor="candidate-note">
            What caught your eye? <span>Optional</span>
          </label>
          <textarea
            id="candidate-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A project, a recommendation, or something to check…"
            maxLength={2000}
            rows={3}
          />
          <div className="quiet-callout">
            <Sparkles size={16} />
            <p>
              You bring the eye. The connected pipeline will do the research.
              New submissions never enter Explore before your approval.
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => changeOpen(false)}
            >
              Cancel
            </button>
            <button className="button primary" type="submit">
              Add for review <ArrowUpRight size={15} />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
