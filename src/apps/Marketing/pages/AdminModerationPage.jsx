import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "../../../lib/firebase";
import { trackEvent } from "../lib/marketingAnalytics";
import { directoryActions } from "../api/directoryApi";
import { marketingFlags } from "../featureFlags";
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
  const canManageHostAccess = !!session?.isAdmin;
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
  const [claimQueue, setClaimQueue] = useState([]);
  const [reportWindowDays, setReportWindowDays] = useState(30);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState("");
  const [reportSummary, setReportSummary] = useState(null);
  const [hostApprovalTarget, setHostApprovalTarget] = useState("");
  const [hostApprovalNotes, setHostApprovalNotes] = useState("");
  const [hostApprovalBusy, setHostApprovalBusy] = useState(false);
  const [hostApplications, setHostApplications] = useState([]);
  const [hostApplicationFilter, setHostApplicationFilter] = useState("pending");
  const [hostApplicationLoading, setHostApplicationLoading] = useState(false);

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

  const refreshReporting = async () => {
    if (!canModerate) return;
    setReportLoading(true);
    setReportStatus("");
    try {
      const payload = await directoryActions.getMarketingReportingSummary({
        windowDays: reportWindowDays,
      });
      setReportSummary(payload || null);
      trackEvent("mk_admin_reporting_refresh", { windowDays: reportWindowDays });
    } catch (error) {
      setReportStatus(String(error?.message || "Could not load reporting summary."));
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    refreshQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canModerate, statusFilter, sourceType, entityType]);

  useEffect(() => {
    refreshReporting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canModerate, reportWindowDays]);

  const refreshHostApplications = async () => {
    if (!canManageHostAccess) return;
    setHostApplicationLoading(true);
    try {
      const payload = await directoryActions.listHostApplications({
        status: hostApplicationFilter || undefined,
        limit: 40,
      });
      setHostApplications(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setStatus(String(error?.message || "Could not load host applications."));
      setHostApplications([]);
    } finally {
      setHostApplicationLoading(false);
    }
  };

  useEffect(() => {
    refreshHostApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageHostAccess, hostApplicationFilter]);

  useEffect(() => {
    if (!canModerate || !marketingFlags.claimFlowEnabled) {
      setClaimQueue([]);
      return () => {};
    }
    const baseRef = collection(db, "directory_claim_requests");
    let stoppedFallback = () => {};
    let startedFallback = false;
    const stopPrimary = onSnapshot(
      query(baseRef, where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(80)),
      (snap) => {
        const claims = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }));
        setClaimQueue(claims);
      },
      () => {
        if (startedFallback) return;
        startedFallback = true;
        stoppedFallback = onSnapshot(
          query(baseRef, where("status", "==", "pending"), limit(80)),
          (snap) => {
            const claims = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }));
            setClaimQueue(claims);
          },
          () => setClaimQueue([])
        );
      }
    );
    return () => {
      stopPrimary();
      stoppedFallback();
    };
  }, [canModerate]);

  const reviewQueueLabel = useMemo(
    () => `${queue.length} item${queue.length === 1 ? "" : "s"} loaded`,
    [queue.length]
  );
  const numberFmt = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }),
    []
  );
  const workstreamRows = useMemo(
    () => Array.isArray(reportSummary?.workstreams) ? reportSummary.workstreams : [],
    [reportSummary?.workstreams]
  );
  const goldenPathRows = useMemo(
    () => Array.isArray(reportSummary?.goldenPaths) ? reportSummary.goldenPaths.slice(0, 12) : [],
    [reportSummary?.goldenPaths]
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

  const resolveClaim = async (claimId, action) => {
    if (!canModerate || !claimId) return;
    setActionBusyId(claimId);
    setStatus("");
    try {
      await directoryActions.resolveDirectoryClaimRequest({
        claimId,
        action,
        notes: notesById[claimId] || "",
      });
      setStatus(`Claim ${claimId} ${action}d.`);
      trackEvent("mk_listing_claim_resolved", { claimId, action });
    } catch (error) {
      setStatus(String(error?.message || "Claim resolution failed."));
    } finally {
      setActionBusyId("");
    }
  };

  const setHostApproval = async (enabled = true) => {
    if (!canManageHostAccess || hostApprovalBusy) return;
    const target = String(hostApprovalTarget || "").trim();
    if (!target) {
      setStatus("Enter host email or UID before submitting.");
      return;
    }
    setHostApprovalBusy(true);
    setStatus("");
    try {
      const payload = await directoryActions.setHostApprovalStatus({
        target,
        enabled,
        notes: hostApprovalNotes,
        source: "admin_moderation_panel",
      });
      const targetLabel = payload?.targetEmail || payload?.targetUid || target;
      setStatus(`Host approval ${enabled ? "granted" : "revoked"} for ${targetLabel}.`);
      trackEvent("mk_host_approval_updated", {
        action: enabled ? "approve" : "revoke",
        scope: payload?.mode || "unknown",
      });
    } catch (error) {
      setStatus(String(error?.message || "Host approval update failed."));
    } finally {
      setHostApprovalBusy(false);
    }
  };

  const resolveHostApplication = async (applicationId, action) => {
    if (!canManageHostAccess || !applicationId) return;
    setActionBusyId(applicationId);
    setStatus("");
    try {
      await directoryActions.resolveHostApplication({
        applicationId,
        action,
        notes: notesById[applicationId] || "",
      });
      setStatus(`Host application ${action === "approve" ? "approved" : "rejected"}.`);
      trackEvent("mk_host_application_resolved", { action });
      await refreshHostApplications();
    } catch (error) {
      setStatus(String(error?.message || "Host application review failed."));
    } finally {
      setActionBusyId("");
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
        <div className="mk3-actions-block">
          <h3>Reporting Snapshot</h3>
          <div className="mk3-filter-row">
            <select value={reportWindowDays} onChange={(e) => setReportWindowDays(Number(e.target.value) || 30)}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button type="button" onClick={refreshReporting} disabled={reportLoading}>
              {reportLoading ? "Refreshing..." : "Refresh Reporting"}
            </button>
          </div>
          {!!reportSummary && (
            <>
              <div className="mk3-metric-row">
                <article className="mk3-metric">
                  <span>Total Events</span>
                  <strong>{numberFmt.format(Number(reportSummary?.totals?.events || 0))}</strong>
                </article>
                <article className="mk3-metric">
                  <span>Golden Path Events</span>
                  <strong>{numberFmt.format(Number(reportSummary?.totals?.goldenPathEvents || 0))}</strong>
                </article>
                <article className="mk3-metric">
                  <span>Entries</span>
                  <strong>{numberFmt.format(Number(reportSummary?.totals?.entries || 0))}</strong>
                </article>
                <article className="mk3-metric">
                  <span>Milestones</span>
                  <strong>{numberFmt.format(Number(reportSummary?.totals?.milestones || 0))}</strong>
                </article>
              </div>
              <div className="mk3-sub-list compact">
                <h3>Workstream Topline</h3>
                {workstreamRows.map((stream) => (
                  <article key={stream.id} className="mk3-review-card">
                    <div className="mk3-review-head">
                      <strong>{stream.id.replace(/_/g, " ")}</strong>
                      <span className="mk3-chip">{numberFmt.format(Number(stream.sharePct || 0))}% of events</span>
                    </div>
                    <div className="mk3-report-grid">
                      <div><span>Events</span><strong>{numberFmt.format(Number(stream.events || 0))}</strong></div>
                      <div><span>Entries</span><strong>{numberFmt.format(Number(stream.entries || 0))}</strong></div>
                      <div><span>Milestones</span><strong>{numberFmt.format(Number(stream.milestones || 0))}</strong></div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mk3-sub-list compact">
                <h3>Golden Path Aggregate</h3>
                {goldenPathRows.map((row) => (
                  <div key={row.id} className="mk3-report-row">
                    <span>{row.id.replace(/_/g, " ")}</span>
                    <strong>{numberFmt.format(Number(row.count || 0))}</strong>
                  </div>
                ))}
                {!goldenPathRows.length && (
                  <div className="mk3-status">No golden path activity for selected window.</div>
                )}
              </div>
            </>
          )}
          {reportStatus && <div className="mk3-status">{reportStatus}</div>}
        </div>
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
        <h4>Host Applications</h4>
        <p>Review host applications and approve the accounts you want to onboard.</p>
        {canManageHostAccess ? (
          <>
            <div className="mk3-filter-row">
              <select value={hostApplicationFilter} onChange={(e) => setHostApplicationFilter(e.target.value)}>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
              <button type="button" onClick={refreshHostApplications} disabled={hostApplicationLoading}>
                {hostApplicationLoading ? "Loading..." : "Refresh Applications"}
              </button>
            </div>
            <div className="mk3-sub-list compact">
              <h3>Applications ({hostApplications.length})</h3>
              {hostApplications.map((application) => (
                <article key={application.applicationId} className="mk3-review-card">
                  <div className="mk3-review-head">
                    <strong>{application.name || application.email || application.uid || application.applicationId}</strong>
                    <div className="mk3-chip">{application.status || "pending"}</div>
                  </div>
                  <div className="mk3-detail-meta">
                    {application.email || "no-email"} | {application.source || "unknown source"} | {formatDateTime(application.submittedAtMs || application.createdAtMs)}
                  </div>
                  <textarea
                    value={notesById[application.applicationId] || application.reviewNotes || ""}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [application.applicationId]: e.target.value }))}
                    placeholder="Approval notes"
                  />
                  <div className="mk3-actions-inline">
                    <button
                      type="button"
                      disabled={actionBusyId === application.applicationId}
                      onClick={() => resolveHostApplication(application.applicationId, "approve")}
                    >
                      Approve Host
                    </button>
                    <button
                      type="button"
                      disabled={actionBusyId === application.applicationId}
                      onClick={() => resolveHostApplication(application.applicationId, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
              {!hostApplications.length && (
                <div className="mk3-status">No host applications for this filter.</div>
              )}
            </div>
            <hr className="mk3-divider" />
            <h4>Manual Host Approval Override</h4>
            <p>Approve or revoke a host directly by email or UID when you need to bypass the application queue.</p>
            <label>
              Host Email or UID
              <input
                value={hostApprovalTarget}
                onChange={(e) => setHostApprovalTarget(e.target.value)}
                placeholder="host@example.com or firebase_uid"
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={hostApprovalNotes}
                onChange={(e) => setHostApprovalNotes(e.target.value)}
                placeholder="Invite context or source"
              />
            </label>
            <div className="mk3-actions-inline">
              <button type="button" onClick={() => setHostApproval(true)} disabled={hostApprovalBusy}>
                {hostApprovalBusy ? "Working..." : "Approve Host"}
              </button>
              <button type="button" onClick={() => setHostApproval(false)} disabled={hostApprovalBusy}>
                {hostApprovalBusy ? "Working..." : "Revoke Approval"}
              </button>
            </div>
            <div className="mk3-status">
              Email approvals can be pre-seeded before account creation. They become active once that email signs in.
            </div>
          </>
        ) : (
          <div className="mk3-status">Directory admin role required to manage host approvals.</div>
        )}
        <hr className="mk3-divider" />
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
        {marketingFlags.claimFlowEnabled && (
          <div className="mk3-sub-list compact">
            <h3>Pending Claims ({claimQueue.length})</h3>
            {claimQueue.map((claim) => (
              <article key={claim.id} className="mk3-review-card">
                <div className="mk3-review-head">
                  <strong>{claim.listingType} | {claim.listingId}</strong>
                  <div className="mk3-chip">{claim.status || "pending"}</div>
                </div>
                <p>{claim.evidence || "No evidence provided."}</p>
                <textarea
                  value={notesById[claim.id] || ""}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                  placeholder="Claim moderation notes"
                />
                <div className="mk3-actions-inline">
                  <button
                    type="button"
                    disabled={actionBusyId === claim.id}
                    onClick={() => resolveClaim(claim.id, "approve")}
                  >
                    Approve Claim
                  </button>
                  <button
                    type="button"
                    disabled={actionBusyId === claim.id}
                    onClick={() => resolveClaim(claim.id, "reject")}
                  >
                    Reject Claim
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </aside>
      {status && <div className="mk3-status full">{status}</div>}
    </section>
  );
};

export default AdminModerationPage;

