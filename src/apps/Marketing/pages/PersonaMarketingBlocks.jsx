import React from "react";
import { MARKETING_BRAND_NEON_URL } from "./shared";

export const PersonaPageFrame = ({ theme = "fan", children }) => (
  <section className={`mk3-page mk3-rebuild-page is-${theme}`}>
    {children}
  </section>
);

const PersonaActionButton = ({ action = {}, index = 0 }) => {
  const variant = String(action?.variant || (index === 0 ? "primary" : "secondary")).trim().toLowerCase();
  return (
    <button
      type="button"
      className={`mk3-rebuild-button is-${variant}`}
      onClick={action?.onClick}
    >
      {action?.label}
    </button>
  );
};

export const PersonaSurfaceMock = ({
  type = "tv",
  className = "",
  label = "",
  title = "",
  copy = "",
}) => {
  const safeType = String(type || "tv").trim().toLowerCase();

  if (safeType === "host") {
    return (
      <div className={`mk3-surface-mock is-host ${className}`.trim()}>
        <div className="mk3-surface-mock-head">
          <span>{label || "Host deck"}</span>
          <b>Queue live</b>
        </div>
        <div className="mk3-surface-mock-host-layout">
          <section>
            <strong>Search</strong>
            <div className="mk3-surface-mock-pill-row">
              <span>Journey</span>
              <span>ABBA</span>
              <span>Whitney</span>
            </div>
          </section>
          <section>
            <strong>Queue</strong>
            <ul>
              <li><span>Now</span><b>Dont Stop Believin'</b></li>
              <li><span>Next</span><b>Valerie</b></li>
              <li><span>Later</span><b>Man! I Feel Like A Woman</b></li>
            </ul>
          </section>
          <section>
            <strong>Room controls</strong>
            <div className="mk3-surface-mock-meter-row">
              <span>TV</span>
              <i />
            </div>
            <div className="mk3-surface-mock-meter-row">
              <span>Audio</span>
              <i />
            </div>
            <div className="mk3-surface-mock-meter-row">
              <span>Join</span>
              <i />
            </div>
          </section>
        </div>
        <div className="mk3-surface-mock-copy">
          <strong>{title}</strong>
          <p>{copy}</p>
        </div>
      </div>
    );
  }

  if (safeType === "audience") {
    return (
      <div className={`mk3-surface-mock is-audience ${className}`.trim()}>
        <div className="mk3-surface-mock-phone">
          <div className="mk3-surface-mock-phone-notch" />
          <div className="mk3-surface-mock-phone-screen">
            <span>{label || "Audience app"}</span>
            <strong>Join this room</strong>
            <div className="mk3-surface-mock-code">DJBEAU</div>
            <div className="mk3-surface-mock-pill-row">
              <span>Name</span>
              <span>Emoji</span>
              <span>Request</span>
            </div>
            <button type="button">Enter room</button>
          </div>
        </div>
        <div className="mk3-surface-mock-copy">
          <strong>{title}</strong>
          <p>{copy}</p>
        </div>
      </div>
    );
  }

  if (safeType === "radar") {
    return (
      <div className={`mk3-surface-mock is-radar ${className}`.trim()}>
        <div className="mk3-surface-mock-head">
          <span>{label || "Discover radar"}</span>
          <b>Live mix</b>
        </div>
        <div className="mk3-surface-mock-radar-grid">
          <i className="is-one" />
          <i className="is-two" />
          <i className="is-three" />
          <i className="is-four" />
          <div className="mk3-surface-mock-radar-ping" />
        </div>
        <div className="mk3-surface-mock-radar-list">
          <div><span>Live now</span><b>The Neon Lounge</b></div>
          <div><span>9 PM</span><b>AAHF Kick-Off</b></div>
          <div><span>Weekly</span><b>Thursday Rotation</b></div>
        </div>
        <div className="mk3-surface-mock-copy">
          <strong>{title}</strong>
          <p>{copy}</p>
        </div>
      </div>
    );
  }

  if (safeType === "schedule") {
    return (
      <div className={`mk3-surface-mock is-schedule ${className}`.trim()}>
        <div className="mk3-surface-mock-head">
          <span>{label || "Venue schedule"}</span>
          <b>Recurring</b>
        </div>
        <div className="mk3-surface-mock-schedule-list">
          <div><span>Thu</span><b>7 PM to Midnight</b></div>
          <div><span>Fri</span><b>Host Beau / Open Room</b></div>
          <div><span>Sat</span><b>Karaoke Party / Walk-ins</b></div>
        </div>
        <div className="mk3-surface-mock-copy">
          <strong>{title}</strong>
          <p>{copy}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mk3-surface-mock is-tv ${className}`.trim()}>
      <div className="mk3-surface-mock-head">
        <span>{label || "Public TV"}</span>
        <b>Stage live</b>
      </div>
      <div className="mk3-surface-mock-tv-screen">
        <div className="mk3-surface-mock-tv-topline">
          <span>beaurocks.app</span>
          <i>Scan to sing</i>
        </div>
        <strong>"Dont Stop Believin'"</strong>
        <div className="mk3-surface-mock-tv-pill">Up next: Sarah J.</div>
      </div>
      <div className="mk3-surface-mock-copy">
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
};

export const PersonaHeroScaffold = ({
  theme = "fan",
  className = "",
  copyClassName = "",
  railClassName = "",
  proofClassName = "",
  kicker = "",
  brandLine = "",
  title = "",
  subtitle = "",
  actions = [],
  badges = [],
  proofItems = [],
  rightRail = null,
}) => (
  <article className={`mk3-rebuild-hero is-${theme} mk3-rebuild-stageband ${className}`.trim()}>
    <div className="mk3-rebuild-hero-grid">
      <div className={`mk3-rebuild-hero-copy ${copyClassName}`.trim()}>
        <div className="mk3-rebuild-kicker">{kicker}</div>
        {!!brandLine && (
          <div className="mk3-rebuild-brandline">
            <img src={MARKETING_BRAND_NEON_URL} alt="BeauRocks logo" loading="lazy" />
            <span>{brandLine}</span>
          </div>
        )}
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {!!actions.length && (
          <div className="mk3-rebuild-action-row">
            {actions.map((action, index) => (
              <PersonaActionButton key={`${action?.label || "action"}-${index}`} action={action} index={index} />
            ))}
          </div>
        )}
        {!!badges.length && (
          <div className="mk3-rebuild-badge-row">
            {badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        )}
      </div>

      <div className={`mk3-rebuild-hero-rail ${railClassName}`.trim()}>
        {rightRail}
      </div>
    </div>

    {!!proofItems.length && (
      <div className={`mk3-rebuild-proof-strip ${proofClassName}`.trim()}>
        {proofItems.map((item) => (
          <article key={item.title} className="mk3-rebuild-proof-card">
            <span>{item.eyebrow || "Proof"}</span>
            <strong>{item.title}</strong>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    )}
  </article>
);

export const PersonaPrimaryVisual = ({
  theme = "fan",
  imageUrl = "",
  imageAlt = "",
  chip = "",
  title = "",
  copy = "",
  supportingLabel = "",
  supportingValue = "",
  stackItems = [],
}) => (
  <div className={`mk3-rebuild-visual-stack is-${theme}`}>
    <article className="mk3-rebuild-screen">
      <img src={imageUrl} alt={imageAlt} loading="lazy" />
      <div className="mk3-rebuild-screen-overlay">
        <div className="mk3-rebuild-screen-topline">
          {!!chip && <span className="mk3-rebuild-screen-chip">{chip}</span>}
          {!!supportingValue && (
            <div className="mk3-rebuild-screen-callout">
              {!!supportingLabel && <span>{supportingLabel}</span>}
              <strong>{supportingValue}</strong>
            </div>
          )}
        </div>
        <div className="mk3-rebuild-screen-copy">
          <strong>{title}</strong>
          <p>{copy}</p>
        </div>
      </div>
    </article>

    {!!stackItems.length && (
      <div className="mk3-rebuild-surface-strip">
        {stackItems.map((item) => (
          <article key={item.title} className={`mk3-rebuild-surface-card ${item.className || ""}`}>
            <span>{item.label}</span>
            <img src={item.imageUrl} alt={item.imageAlt || item.title} loading="lazy" />
            <div>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </div>
          </article>
        ))}
      </div>
    )}
  </div>
);

export const PersonaSignalSection = ({
  kicker = "",
  title = "",
  cards = [],
  theme = "fan",
  className = "",
}) => (
  <section className={`mk3-rebuild-band is-${theme} mk3-rebuild-open-band ${className}`.trim()}>
    <div className="mk3-rebuild-band-head">
      <div className="mk3-rebuild-kicker">{kicker}</div>
      <h2>{title}</h2>
    </div>
    <div className="mk3-rebuild-signal-grid">
      {cards.map((card) => (
        <article key={card.title} className="mk3-rebuild-signal-card">
          <span>{card.label}</span>
          <strong>{card.title}</strong>
          <p>{card.copy}</p>
        </article>
      ))}
    </div>
  </section>
);

export const PersonaFeatureSection = ({
  kicker = "",
  title = "",
  steps = [],
  theme = "fan",
  className = "",
}) => (
  <section className={`mk3-rebuild-band is-${theme} mk3-rebuild-open-band ${className}`.trim()}>
    <div className="mk3-rebuild-band-head">
      <div className="mk3-rebuild-kicker">{kicker}</div>
      <h2>{title}</h2>
    </div>
    <div className="mk3-rebuild-step-grid">
      {steps.map((step) => (
        <article key={step.step} className="mk3-rebuild-step-card">
          {step.visualType ? (
            <PersonaSurfaceMock
              type={step.visualType}
              label={step.visualLabel}
              title={step.visualTitle || step.title}
              copy={step.visualCopy || step.copy}
              className="is-step-surface"
            />
          ) : (
            <img src={step.imageUrl} alt={step.title} loading="lazy" />
          )}
          <div>
            <span>{step.step}</span>
            <strong>{step.title}</strong>
            <p>{step.copy}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);

export const PersonaOutcomeSection = ({
  kicker = "",
  title = "",
  items = [],
  theme = "fan",
  aside = null,
  className = "",
}) => (
  <section className={`mk3-rebuild-band is-${theme} mk3-rebuild-open-band ${className}`.trim()}>
    <div className="mk3-rebuild-band-head">
      <div className="mk3-rebuild-kicker">{kicker}</div>
      <h2>{title}</h2>
    </div>
    <div className={`mk3-rebuild-outcome-layout ${aside ? "has-aside" : ""}`}>
      {!!aside && <aside className="mk3-rebuild-outcome-aside">{aside}</aside>}
      <div className="mk3-rebuild-outcome-grid">
        {items.map((item) => (
          <article key={item.title} className="mk3-rebuild-outcome-card">
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const PersonaFlowSection = ({
  title = "",
  steps = [],
  theme = "fan",
  className = "",
}) => (
  <section className={`mk3-rebuild-band is-${theme} mk3-rebuild-open-band ${className}`.trim()}>
    <div className="mk3-rebuild-flow-head">
      <div>
        <div className="mk3-rebuild-kicker">How it moves</div>
        <h2>{title}</h2>
      </div>
      <img src={MARKETING_BRAND_NEON_URL} alt="" aria-hidden="true" />
    </div>
    <div className="mk3-rebuild-flow-grid">
      {steps.map((step) => (
        <article key={step.step} className="mk3-rebuild-flow-card">
          <span>{step.step}</span>
          <strong>{step.title}</strong>
          <p>{step.copy}</p>
        </article>
      ))}
    </div>
  </section>
);

export const PersonaClosingSection = ({
  kicker = "",
  title = "",
  cards = [],
  theme = "fan",
  className = "",
}) => (
  <section className={`mk3-rebuild-band is-${theme} mk3-rebuild-open-band ${className}`.trim()}>
    <div className="mk3-rebuild-band-head">
      <div className="mk3-rebuild-kicker">{kicker}</div>
      <h2>{title}</h2>
    </div>
    <div className="mk3-rebuild-closing-grid">
      {cards.map((card, index) => (
        <article key={card.title} className="mk3-rebuild-closing-card">
          <strong>{card.title}</strong>
          <p>{card.copy}</p>
          <PersonaActionButton action={{ ...card, label: card.cta, variant: card.variant || (index === 0 ? "primary" : "secondary") }} index={index} />
        </article>
      ))}
    </div>
  </section>
);
