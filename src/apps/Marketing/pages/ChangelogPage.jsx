import React from "react";

const ChangelogPage = ({ changelogEntries = [], releaseLabel = "" }) => (
  <section className="mk3-page">
    <article className="mk3-detail-card">
      <div className="mk3-chip">product changelog</div>
      <h2>What shipped recently</h2>
      <p>Release highlights for hosts, audience, and TV orchestration improvements.</p>
      {!!releaseLabel && (
        <div className="mk3-status">
          <strong>Current Build</strong>
          <span>{releaseLabel}</span>
        </div>
      )}
    </article>
    <div className="mk3-public-changelog-grid">
      {(Array.isArray(changelogEntries) ? changelogEntries : []).map((entry) => (
        <article key={`${entry.title}-${entry.date}`} className="mk3-public-changelog-card">
          <div className="mk3-public-changelog-meta">
            <strong>{entry.title}</strong>
            <span>{entry.date}</span>
            <em>{entry.tag}</em>
          </div>
          <ul>
            {(Array.isArray(entry.bullets) ? entry.bullets : []).map((item) => (
              <li key={`${entry.title}-${item}`}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  </section>
);

export default ChangelogPage;
