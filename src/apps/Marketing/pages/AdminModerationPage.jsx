import React, { useEffect, useMemo, useState } from "react";
import { directoryActions } from "../api/directoryApi";
import { formatDateTime } from "./shared";

const defaultRecordJson = JSON.stringify([
  {
    name: "Sample Karaoke Night",
    city: "Seattle",
    state: "WA",
    region: "wa_seattle",
    listingType: "venue",
  },
], null, 2);

const AdminModerationPage = ({ session }) => {
  const canModerate = !!session?.isModerator;
  const [queue, setQueue] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [sourceType, setSourceType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [notesById, setNotesById] = useState({});
  const [status, setStatus] = useState("");
  const [ingestRegions, setIngestRegions] = useState("wa_seattle,ca_los_angeles,ny_new_york");
  const [ingestProviders, setIngestProviders] = useState("google,yelp");
  const [ingestDryRun, setIngestDryRun] = useState(true);
  const [recordsInput, setRecordsInput] = useState(defaultRecordJson);

  const refreshQueue = async () => {
    if (!canModerate) return;
    setLoading(true);
    setStatus("");
    try {
      const payload = await directoryActions.listModerationQueue({
        status: statusFilter,
        sourceType: sourceType || undefined,
        entityType: entityType || undefined,
        limit: 60,
      });
      setQueue(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setStatus(String(error?.message || "Could not load moderation queue."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canModerate, statusFilter, sourceType, entityType]);

  const reviewQueueLabel = useMemo(
    () => `${queue.length} item${queue.length === 1 ? "" : "s"} loaded`,
    [queue.length]
  );

  const resolveItem = async (submissionId, action) => {
    if (!canModerate || !submissionId) return;
    setActionBusyId(submissionId);
    setStatus("");
    try {
      await directoryActions.resolveModerationItem({
        submissionId,
        action,
        notes: notesById[submissionId] || "",
      });
      setStatus(`Submission ${submissionId} marked ${action}.`);
      await refreshQueue();
    } catch (error) {
      setStatus(String(error?.message || "Moderation action failed."));
    } finally {
      setActionBusyId("");
    }
  };

  const runIngest = async () => {
    if (!canModerate) return;
    setLoading(true);
    setStatus("");
    try {
      const records = JSON.parse(recordsInput || "[]");
      const result = await directoryActions.runExternalDirectoryIngestion({
        regions: ingestRegions.split(",").map((item) => item.trim()).filter(Boolean),
        providers: ingestProviders.split(",").map((item) => item.trim()).filter(Boolean),
        records,
        dryRun: ingestDryRun,
      });
      setStatus(`Ingestion ${result?.dryRun ? "dry-run" : "queued"}: ${result?.queued || 0} candidate(s).`);
      if (!ingestDryRun) {
        await refreshQueue();
      }
    } catch (error) {
      setStatus(String(error?.message || "Ingestion failed."));
    } finally {
      setLoading(false);
    }
  };

  if (!canModerate) {
    return (
      <section className="mk3-page">
        <div className="mk3-status">Directory moderator role required for this page.</div>
      </section>
    );
  }

  return (
    <section className="mk3-page mk3-two-col">
      <article className="mk3-detail-card">
        <div className="mk3-chip">marketing admin</div>
        <h2>Moderation Queue</h2>
        <p>Site-safe moderation surface for listing approvals and external ingestion review.</p>
        <div className="mk3-filter-row">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <input
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            placeholder="sourceType (optional)"
          />
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="entityType (optional)"
          />
          <button type="button" onClick={refreshQueue} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="mk3-status">{reviewQueueLabel}</div>
        {queue.map((item) => (
          <article key={item.submissionId} className="mk3-review-card">
            <div className="mk3-review-head">
              <div>
                <strong>{item.payload?.title || item.listingType}</strong>
                <div className="mk3-detail-meta">
                  {item.listingType} | {item.sourceType} | {formatDateTime(item.createdAtMs)}
                </div>
              </div>
              <div className="mk3-chip">{item.status}</div>
            </div>
            <p>{item.payload?.description || "No description."}</p>
            <textarea
              value={notesById[item.submissionId] || ""}
              onChange={(e) => setNotesById((prev) => ({ ...prev, [item.submissionId]: e.target.value }))}
              placeholder="Moderator notes"
            />
            <div className="mk3-actions-inline">
              <button
                type="button"
                disabled={actionBusyId === item.submissionId}
                onClick={() => resolveItem(item.submissionId, "approve")}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={actionBusyId === item.submissionId}
                onClick={() => resolveItem(item.submissionId, "reject")}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </article>

      <aside className="mk3-actions-card">
        <h4>External Ingestion</h4>
        <p>Google/Yelp candidate ingestion into moderation queue.</p>
        <label>
          Regions (comma separated)
          <input value={ingestRegions} onChange={(e) => setIngestRegions(e.target.value)} />
        </label>
        <label>
          Providers (comma separated)
          <input value={ingestProviders} onChange={(e) => setIngestProviders(e.target.value)} />
        </label>
        <label className="mk3-inline">
          <input type="checkbox" checked={ingestDryRun} onChange={(e) => setIngestDryRun(e.target.checked)} />
          Dry run
        </label>
        <label>
          Candidate Records JSON
          <textarea value={recordsInput} onChange={(e) => setRecordsInput(e.target.value)} />
        </label>
        <button type="button" onClick={runIngest} disabled={loading}>
          {loading ? "Running..." : "Run Ingestion"}
        </button>
      </aside>
      {status && <div className="mk3-status full">{status}</div>}
    </section>
  );
};

export default AdminModerationPage;
