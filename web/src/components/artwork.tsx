import type { Project } from "@/lib/types";
import { ImageOff, Play } from "lucide-react";

export function Artwork({
  project,
  variation = 0,
}: {
  project: Project;
  variation?: number;
}) {
  if (project.mediaType === "missing")
    return (
      <div
        className="artwork art-missing"
        role="img"
        aria-label="Portfolio media unavailable"
      >
        <ImageOff size={25} />
        <span>Work not captured yet</span>
      </div>
    );
  return (
    <div
      className={`artwork art-${project.kind} variant-${variation % 3}`}
      role="img"
      aria-label={`${project.title}, original sample artwork`}
    >
      {project.kind === "olive" && (
        <>
          <div className="olive-shadow" />
          <div className="oil-tin">
            <div className="tin-lid" />
            <span className="oil-small">SMALL GROVE. BIG FLAVOUR.</span>
            <b>
              Olive
              <br />
              <i>& Other.</i>
            </b>
            <svg viewBox="0 0 120 80" aria-hidden="true">
              <path
                d="M27 72Q60 38 95 11M61 39Q22 36 27 13Q57 9 61 39M65 35Q97 48 106 31Q90 14 65 35"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <ellipse
                cx="47"
                cy="55"
                rx="11"
                ry="15"
                transform="rotate(-35 47 55)"
                fill="currentColor"
              />
            </svg>
            <span className="oil-small">
              EXTRA VIRGIN OLIVE OIL
              <br />
              500 ml · A little everyday good.
            </span>
          </div>
          <div className="oil-label">
            <span>
              A GOOD
              <br />
              THING,
              <br />
              <i>naturally.</i>
            </span>
          </div>
          <span className="art-corner">OLIVE & OTHER®</span>
        </>
      )}
      {project.kind === "type" && (
        <>
          <div className="type-grid" />
          <span className="art-top">
            FORMA® &nbsp; INDEPENDENT JOURNAL OF IDEAS
          </span>
          <span className="type-title">
            Aa
            <br />
            <i>Bb.</i>
          </span>
          <span className="type-caption">
            A different
            <br />
            kind of character.
          </span>
          <span className="art-corner">
            NO. 04 &nbsp; TYPE / CULTURE / FORM
          </span>
        </>
      )}
      {project.kind === "digital" && (
        <>
          <div className="app-window">
            <div className="app-rail">
              <b>a.</b>
              <span>◫</span>
              <span>▤</span>
              <span>◌</span>
            </div>
            <div className="app-content">
              <span className="app-greeting">
                YOUR OVERVIEW <span>↗</span>
              </span>
              <h4>A clearer picture.</h4>
              <div className="app-stats">
                <div>
                  <small>Total balance</small>
                  <b>
                    €48,290<span>.00</span>
                  </b>
                  <em>↗ 12.8% this month</em>
                </div>
                <div className="mini-card">
                  arc.<span>•••• 2048</span>
                </div>
              </div>
              <div className="chart">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="app-bottom">
                Your money, moving forward. <b>View activity ↗</b>
              </div>
            </div>
          </div>
          <span className="art-corner">ARC / DIGITAL PRODUCT DESIGN</span>
        </>
      )}
      {project.kind === "motion" && (
        <>
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="orb orb-three" />
          <span className="art-top">SOFT SIGNAL® &nbsp; A STUDY IN PLAY</span>
          <span className="motion-title">
            Less rigid.
            <br />
            <i>More feeling.</i>
          </span>
          <span className="art-corner">FORM EXPLORATIONS / 001</span>
        </>
      )}
      {project.kind === "editorial" && (
        <>
          <div className="journal journal-back" />
          <div className="journal">
            <div className="journal-top">
              INDEPENDENT CULTURE & DESIGN <b>07</b>
            </div>
            <strong>
              Field
              <br />
              <i>notes.</i>
            </strong>
            <div className="journal-art">
              <span />
              <span />
              <span />
            </div>
            <span className="journal-foot">THE SPACE BETWEEN THINGS</span>
          </div>
          <span className="art-corner">ÉDITIONS / PRINTED MATTER</span>
        </>
      )}
      {project.kind === "objects" && (
        <>
          <div className="object-circle" />
          <div className="object-block" />
          <div className="object-ball" />
          <span className="objects-title">
            matter
            <span>
              Objects for
              <br />a slower everyday.
            </span>
          </span>
          <span className="art-corner">LESS, BUT BETTER. / EST. 2024</span>
        </>
      )}
      {project.kind === "flora" && (
        <>
          <svg className="flower" viewBox="0 0 300 300" aria-hidden="true">
            <g fill="currentColor">
              <ellipse cx="150" cy="90" rx="32" ry="65" />
              <ellipse cx="150" cy="210" rx="32" ry="65" />
              <ellipse cx="90" cy="150" rx="65" ry="32" />
              <ellipse cx="210" cy="150" rx="65" ry="32" />
              <ellipse
                cx="108"
                cy="108"
                rx="32"
                ry="60"
                transform="rotate(-45 108 108)"
              />
              <ellipse
                cx="192"
                cy="192"
                rx="32"
                ry="60"
                transform="rotate(-45 192 192)"
              />
              <ellipse
                cx="192"
                cy="108"
                rx="32"
                ry="60"
                transform="rotate(45 192 108)"
              />
              <ellipse
                cx="108"
                cy="192"
                rx="32"
                ry="60"
                transform="rotate(45 108 192)"
              />
            </g>
            <circle cx="150" cy="150" r="29" fill="#f4bfc6" />
          </svg>
          <span className="flora-title">
            Common
            <br />
            <i>ground.</i>
          </span>
          <span className="art-corner">ROOM TO GROW. / BOTANICAL STUDIES</span>
        </>
      )}
      {project.kind === "mono" && (
        <>
          <div className="phone">
            <span className="phone-top">
              9:41 <b>•••</b>
            </span>
            <h4>
              A little
              <br />
              <i>more space.</i>
            </h4>
            <div className="phone-sun" />
            <div className="phone-task">
              <span>Today, at your pace.</span>
              <b>Make room for good things ↗</b>
            </div>
          </div>
          <span className="art-corner">DAYLIGHT / PRODUCT EXPLORATION</span>
        </>
      )}
      {project.mediaType === "motion-study" && (
        <span className="media-indicator">
          <Play size={10} fill="currentColor" /> Still study
        </span>
      )}
    </div>
  );
}
