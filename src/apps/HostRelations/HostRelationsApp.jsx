import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ASSETS } from '../../lib/assets';
import { HostHelpGuide } from '../Help/HelpCenter';
import {
  createHostSupportThread,
  getHostLifecycleReportingSummary,
  getHostSupportThread,
  getMyDirectoryAccess,
  getMyHostAccessStatus,
  listHostAnnouncementComments,
  listHostAnnouncements,
  listHostApplications,
  listHostSupportThreads,
  moderateHostAnnouncementComment,
  postHostAnnouncementComment,
  postHostSupportMessage,
  resolveHostApplication,
  setHostSupportThreadStatus,
  upsertHostAnnouncement,
} from '../../lib/firebase';

const OPS_TABS = [
  { id: 'overview', label: 'Overview', description: 'Testing health', icon: 'fa-chart-line' },
  { id: 'applications', label: 'Applications', description: 'Review the waitlist', icon: 'fa-ticket' },
  { id: 'hosts', label: 'Active Hosts', description: 'Usage snapshots', icon: 'fa-users' },
  { id: 'updates', label: 'Updates', description: 'Publish to Hosts', icon: 'fa-bullhorn' },
  { id: 'support', label: 'Host Support', description: 'Private conversations', icon: 'fa-inbox' },
];
const HUB_TABS = [
  { id: 'updates', label: 'Updates', description: 'What changed', icon: 'fa-sparkles' },
  { id: 'getting_started', label: 'Start Here', description: 'Your first-Room path', icon: 'fa-route' },
  { id: 'help', label: 'Host Guide', description: 'How BeauRocks works', icon: 'fa-circle-question' },
  { id: 'support', label: 'Message the Team', description: 'Private product support', icon: 'fa-comments' },
];
const CATEGORY_LABELS = {
  product_update: 'Product Update',
  known_issue: 'Known Issue',
  maintenance: 'Maintenance',
  testing_request: 'Testing Request',
  access: 'Access',
  onboarding: 'Onboarding',
  billing: 'Billing',
  bug: 'Bug',
  feature_request: 'Feature Request',
  other: 'Other',
};
const STATUS_LABELS = {
  open: 'Open',
  waiting_on_team: 'Waiting on Team',
  waiting_on_host: 'Waiting on Host',
  resolved: 'Resolved',
};

const formatDate = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return 'Not yet';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(numeric));
};
const formatAgo = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return 'Never';
  const days = Math.max(0, Math.floor((Date.now() - numeric) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(numeric);
};
const errorText = (error, fallback) => String(error?.message || fallback || 'Something went wrong.').replace(/^FirebaseError:\s*/i, '');
const inputClass = 'w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-400/10';
const primaryButton = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-400/15 px-4 py-2 text-sm font-black text-cyan-50 transition hover:border-cyan-100/60 hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-45';
const secondaryButton = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45';
const dangerButton = 'inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-45';

const Panel = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-white/10 bg-zinc-950/72 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}>{children}</section>
);
const Eyebrow = ({ children, tone = 'cyan' }) => (
  <div className={`text-[10px] font-black uppercase tracking-[0.24em] ${tone === 'pink' ? 'text-pink-300' : tone === 'amber' ? 'text-amber-300' : 'text-cyan-300'}`}>{children}</div>
);
const StatusChip = ({ children, tone = 'neutral' }) => {
  const tones = {
    cyan: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    amber: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
    rose: 'border-rose-300/25 bg-rose-500/10 text-rose-100',
    emerald: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
    neutral: 'border-white/10 bg-white/5 text-zinc-300',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone] || tones.neutral}`}>{children}</span>;
};
const EmptyState = ({ icon = 'fa-inbox', title, body, action = null }) => (
  <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
    <div>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-200"><i className={`fa-solid ${icon}`} /></div>
      <div className="mt-4 text-base font-black text-white">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  </div>
);

const AnnouncementComments = ({ announcement, admin = false }) => {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Loading discussion...');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const payload = await listHostAnnouncementComments({ announcementId: announcement.announcementId });
      setComments(Array.isArray(payload?.items) ? payload.items : []);
      setStatus('');
      return true;
    } catch (error) {
      setStatus(errorText(error, 'Could not load discussion.'));
      return false;
    }
  }, [announcement.announcementId]);
  useEffect(() => { refresh(); }, [refresh]);
  const submit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await postHostAnnouncementComment({ announcementId: announcement.announcementId, body: draft });
      setDraft('');
      const refreshed = await refresh();
      setStatus(refreshed ? 'Comment posted.' : 'Comment posted, but the discussion could not refresh.');
    } catch (error) {
      setStatus(errorText(error, 'Could not post comment.'));
    } finally {
      setBusy(false);
    }
  };
  const hide = async (comment) => {
    setBusy(true);
    try {
      await moderateHostAnnouncementComment({ announcementId: announcement.announcementId, commentId: comment.commentId, hidden: !comment.hidden });
      const refreshed = await refresh();
      if (!refreshed) setStatus('Moderation saved, but the discussion could not refresh.');
    } catch (error) {
      setStatus(errorText(error, 'Could not moderate comment.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 border-t border-white/10 pt-4" data-host-update-discussion={announcement.announcementId}>
      <div className="mb-3 flex items-center justify-between gap-3"><Eyebrow>Approved Host Discussion</Eyebrow><span className="text-xs text-zinc-500">{comments.filter((item) => !item.hidden).length} comments</span></div>
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.commentId} className={`rounded-xl border p-3 ${comment.hidden ? 'border-rose-300/15 bg-rose-500/5 opacity-60' : comment.authorRole === 'team' ? 'border-cyan-300/20 bg-cyan-500/8' : 'border-white/10 bg-black/25'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><strong className="text-sm text-white">{comment.authorName}</strong>{comment.authorRole === 'team' ? <StatusChip tone="cyan">Team</StatusChip> : null}</div>
              <div className="flex items-center gap-2"><span className="text-[11px] text-zinc-500">{formatDate(comment.createdAtMs)}</span>{admin ? <button type="button" onClick={() => hide(comment)} className="text-[11px] font-bold text-zinc-400 hover:text-white">{comment.hidden ? 'Restore' : 'Hide'}</button> : null}</div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{comment.hidden ? 'Comment hidden by the BeauRocks team.' : comment.body}</p>
          </div>
        ))}
      </div>
      {announcement.commentsEnabled ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={inputClass} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={admin ? 'Reply as BeauRocks Team' : 'Ask a question or share feedback'} maxLength={3000} />
          <button className={primaryButton} disabled={busy || !draft.trim()}>{busy ? 'Posting...' : 'Post'}</button>
        </form>
      ) : <div className="mt-3 text-xs text-zinc-500">Discussion is closed for this update.</div>}
      {status ? <div className="mt-2 text-xs text-amber-200">{status}</div> : null}
    </div>
  );
};

const UpdatesWorkspace = ({ admin = false }) => {
  const blankDraft = { announcementId: '', title: '', body: '', category: 'product_update', status: 'draft', pinned: false, commentsEnabled: true };
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState('');
  const [draft, setDraft] = useState(blankDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async (clearNotice = true) => {
    setLoading(true);
    try {
      const payload = await listHostAnnouncements({ includeDrafts: admin, limit: 100 });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      if (clearNotice) setNotice('');
      return true;
    } catch (error) {
      setNotice(errorText(error, 'Could not load Host updates.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [admin]);
  useEffect(() => { refresh(); }, [refresh]);
  const save = async (status) => {
    if (!draft.title.trim() || !draft.body.trim() || busy) return;
    const wasPublished = draft.status === 'published';
    if (status === 'published' && !wasPublished && !window.confirm('Publish this update to every approved testing Host?')) return;
    if (status === 'draft' && wasPublished && !window.confirm('Unpublish this update and return it to draft? Hosts will no longer see it.')) return;
    setBusy(true);
    try {
      const payload = await upsertHostAnnouncement({ ...draft, status });
      setDraft(payload?.item || blankDraft);
      const successMessage = status === 'published'
        ? (wasPublished ? 'Published update saved.' : 'Update published to approved testing Hosts.')
        : (wasPublished ? 'Update unpublished and returned to draft.' : 'Draft saved.');
      const refreshed = await refresh(false);
      setNotice(refreshed ? successMessage : `${successMessage} The update list could not refresh.`);
    } catch (error) {
      setNotice(errorText(error, 'Could not save update.'));
    } finally {
      setBusy(false);
    }
  };
  const edit = (item) => { setDraft({ ...blankDraft, ...item }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <div className={`grid gap-4 ${admin ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`} data-host-updates-workspace>
      {admin ? (
        <Panel className="self-start p-4 lg:sticky lg:top-4">
          <div className="flex items-start justify-between gap-3"><div><Eyebrow tone="pink">Publishing Desk</Eyebrow><h2 className="mt-1 text-xl font-black text-white">Write an approved-Host update</h2></div><StatusChip tone={draft.status === 'published' ? 'emerald' : 'amber'}>{draft.status || 'draft'}</StatusChip></div>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-zinc-300">Title<input className={`${inputClass} mt-1.5`} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={180} /></label>
            <label className="block text-xs font-bold text-zinc-300">Category<select className={`${inputClass} mt-1.5`} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{Object.entries(CATEGORY_LABELS).slice(0, 4).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-xs font-bold text-zinc-300">Message<textarea className={`${inputClass} mt-1.5 min-h-[220px] resize-y`} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} maxLength={12000} /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3 text-xs font-bold text-zinc-300"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))} /> Pin update</label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3 text-xs font-bold text-zinc-300"><input type="checkbox" checked={draft.commentsEnabled} onChange={(event) => setDraft((current) => ({ ...current, commentsEnabled: event.target.checked }))} /> Allow comments</label>
            </div>
            <div className="flex flex-wrap gap-2">{draft.status === 'published' ? <><button type="button" onClick={() => save('published')} className={primaryButton} disabled={busy}>{busy ? 'Saving...' : 'Save Published Changes'}</button><button type="button" onClick={() => save('draft')} className={secondaryButton} disabled={busy}>Unpublish</button></> : <><button type="button" onClick={() => save('draft')} className={secondaryButton} disabled={busy}>Save Draft</button><button type="button" onClick={() => save('published')} className={primaryButton} disabled={busy}>{busy ? 'Publishing...' : 'Publish Update'}</button></>}{draft.announcementId ? <button type="button" onClick={() => setDraft(blankDraft)} className={secondaryButton}>New Draft</button> : null}</div>
          </div>
          {notice ? <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/8 p-3 text-xs text-amber-100">{notice}</div> : null}
        </Panel>
      ) : null}
      <div className="space-y-3">
        {loading ? <EmptyState icon="fa-spinner fa-spin" title="Loading Host updates" body="Checking what is new for your Host workspace." /> : null}
        {!loading && !items.length ? <EmptyState icon="fa-bullhorn" title={admin ? 'No updates published yet' : 'You are all caught up'} body={admin ? 'Write the first approved-Host product update from the publishing desk.' : 'Product updates, testing requests, and known issues will appear here.'} /> : null}
        {items.map((item) => (
          <Panel key={item.announcementId} className={`overflow-hidden ${item.pinned ? 'border-cyan-300/25' : ''}`}>
            <article className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">{item.pinned ? <StatusChip tone="cyan">Pinned</StatusChip> : null}<StatusChip tone={item.category === 'known_issue' ? 'amber' : item.category === 'maintenance' ? 'rose' : 'neutral'}>{CATEGORY_LABELS[item.category] || item.category}</StatusChip>{admin ? <StatusChip tone={item.status === 'published' ? 'emerald' : 'amber'}>{item.status}</StatusChip> : null}</div>
                <span className="text-xs text-zinc-500">{formatDate(item.publishedAtMs || item.updatedAtMs)}</span>
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-white">{item.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{item.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className={secondaryButton} onClick={() => setOpenId((current) => current === item.announcementId ? '' : item.announcementId)}>{item.commentsEnabled ? `${item.commentCount || 0} comments` : 'View update'}</button>{admin ? <button type="button" className={secondaryButton} onClick={() => edit(item)}>Edit</button> : null}</div>
              {openId === item.announcementId ? <AnnouncementComments announcement={item} admin={admin} /> : null}
            </article>
          </Panel>
        ))}
      </div>
    </div>
  );
};

const SupportWorkspace = ({ admin = false }) => {
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newThread, setNewThread] = useState({ title: '', category: 'bug', body: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try {
      const payload = await listHostSupportThreads({ limit: 100 });
      const next = Array.isArray(payload?.items) ? payload.items : [];
      setThreads(next);
      setSelectedId((current) => current || next[0]?.threadId || '');
      setNotice('');
      return true;
    } catch (error) {
      setNotice(errorText(error, 'Could not load support conversations.'));
      return false;
    }
  }, []);
  const refreshSelected = useCallback(async () => {
    if (!selectedId) { setSelected(null); setMessages([]); return true; }
    try {
      const payload = await getHostSupportThread({ threadId: selectedId });
      setSelected(payload?.thread || null);
      setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
      return true;
    } catch (error) {
      setNotice(errorText(error, 'Could not open support conversation.'));
      return false;
    }
  }, [selectedId]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshSelected(); }, [refreshSelected]);
  const create = async (event) => {
    event.preventDefault();
    if (!newThread.title.trim() || !newThread.body.trim() || busy) return;
    setBusy(true);
    try {
      const payload = await createHostSupportThread(newThread);
      setNewThread({ title: '', category: 'bug', body: '' });
      setSelectedId(payload?.item?.threadId || '');
      const refreshed = await refresh();
      setNotice(refreshed ? 'Private conversation started.' : 'Conversation started, but the inbox could not refresh.');
    } catch (error) {
      setNotice(errorText(error, 'Could not start conversation.'));
    } finally { setBusy(false); }
  };
  const send = async (event) => {
    event.preventDefault();
    if (!selectedId || !reply.trim() || busy) return;
    setBusy(true);
    try {
      await postHostSupportMessage({ threadId: selectedId, body: reply });
      setReply('');
      const [inboxRefreshed, threadRefreshed] = await Promise.all([refresh(), refreshSelected()]);
      setNotice(inboxRefreshed && threadRefreshed ? 'Reply sent.' : 'Reply sent, but the conversation could not fully refresh.');
    } catch (error) {
      setNotice(errorText(error, 'Could not send reply.'));
    } finally { setBusy(false); }
  };
  const changeStatus = async (status) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await setHostSupportThreadStatus({ threadId: selectedId, status });
      const [inboxRefreshed, threadRefreshed] = await Promise.all([refresh(), refreshSelected()]);
      setNotice(inboxRefreshed && threadRefreshed ? 'Conversation status updated.' : 'Status updated, but the conversation could not fully refresh.');
    } catch (error) {
      setNotice(errorText(error, 'Could not update conversation status.'));
    } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]" data-host-support-workspace>
      <div className="space-y-3">
        {!admin ? <Panel className="p-4"><Eyebrow tone="pink">Message the Team</Eyebrow><h2 className="mt-1 text-lg font-black text-white">Start a private conversation</h2><form onSubmit={create} className="mt-3 space-y-2"><input className={inputClass} placeholder="Subject" value={newThread.title} onChange={(event) => setNewThread((current) => ({ ...current, title: event.target.value }))} /><select className={inputClass} value={newThread.category} onChange={(event) => setNewThread((current) => ({ ...current, category: event.target.value }))}>{Object.entries(CATEGORY_LABELS).slice(4).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea className={`${inputClass} min-h-[120px]`} placeholder="What can the BeauRocks team help with?" value={newThread.body} onChange={(event) => setNewThread((current) => ({ ...current, body: event.target.value }))} /><button className={`${primaryButton} w-full`} disabled={busy}>Start Conversation</button></form></Panel> : null}
        <Panel className="overflow-hidden"><div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3"><Eyebrow>{admin ? 'Team Inbox' : 'Your Conversations'}</Eyebrow><button type="button" className="text-[11px] font-bold text-cyan-200 hover:text-white" onClick={refresh}>Refresh</button></div><div className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">{threads.map((thread) => <button key={thread.threadId} type="button" onClick={() => setSelectedId(thread.threadId)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selectedId === thread.threadId ? 'border-cyan-300/30 bg-cyan-500/10' : 'border-transparent hover:border-white/10 hover:bg-white/5'}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-white">{thread.title}</strong><StatusChip tone={thread.status === 'waiting_on_team' ? 'amber' : thread.status === 'resolved' ? 'emerald' : 'neutral'}>{STATUS_LABELS[thread.status]}</StatusChip></div>{admin ? <div className="mt-1 truncate text-xs font-bold text-cyan-200">{thread.ownerName} · {thread.ownerEmail}</div> : null}<p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{thread.lastMessagePreview}</p></button>)}{!threads.length ? <div className="p-4 text-sm text-zinc-500">No support conversations yet.</div> : null}</div></Panel>
      </div>
      <Panel className="flex min-h-[520px] flex-col overflow-hidden">
        {!selected ? <EmptyState icon="fa-comments" title="Choose a conversation" body={admin ? 'Host support conversations will appear here for the BeauRocks team.' : 'Start a private conversation whenever you need help.'} /> : <><div className="border-b border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Eyebrow>{CATEGORY_LABELS[selected.category]}</Eyebrow><h2 className="mt-1 text-xl font-black text-white">{selected.title}</h2>{admin ? <p className="mt-1 text-xs text-zinc-400">{selected.ownerName} · {selected.ownerEmail}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={refreshSelected}>Refresh</button><StatusChip tone={selected.status === 'waiting_on_team' ? 'amber' : selected.status === 'resolved' ? 'emerald' : 'cyan'}>{STATUS_LABELS[selected.status]}</StatusChip>{selected.status === 'resolved' ? <button className={secondaryButton} onClick={() => changeStatus('open')}>Reopen</button> : <button className={secondaryButton} onClick={() => changeStatus('resolved')}>Resolve</button>}</div></div></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">{messages.map((message) => <div key={message.messageId} className={`max-w-[88%] rounded-2xl border p-3 ${message.authorRole === 'team' ? 'mr-auto border-cyan-300/25 bg-cyan-500/10' : 'ml-auto border-pink-300/20 bg-pink-500/8'}`}><div className="flex items-center gap-2"><strong className="text-xs text-white">{message.authorName}</strong>{message.authorRole === 'team' ? <StatusChip tone="cyan">Team</StatusChip> : null}<span className="text-[10px] text-zinc-500">{formatDate(message.createdAtMs)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{message.body}</p></div>)}</div><form onSubmit={send} className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row"><textarea className={`${inputClass} min-h-[52px] flex-1 resize-none`} placeholder={admin ? 'Reply as BeauRocks Team' : 'Reply to the BeauRocks team'} value={reply} onChange={(event) => setReply(event.target.value)} /><button className={primaryButton} disabled={busy || !reply.trim()}>{busy ? 'Sending...' : 'Send Reply'}</button></form></>}
      </Panel>
      {notice ? <div className="xl:col-span-2 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</div> : null}
    </div>
  );
};

const Metric = ({ label, value, detail, tone = 'cyan' }) => (
  <Panel className="p-4"><Eyebrow tone={tone}>{label}</Eyebrow><div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></Panel>
);

const HostOverview = ({ summary, onSelectHost }) => {
  const funnel = summary?.funnel || {};
  const hosts = Array.isArray(summary?.hosts) ? summary.hosts : [];
  const referenceMs = Number(summary?.generatedAtMs || 0);
  const attentionHosts = hosts.filter((host) => host.status === 'approved' && (!host.workspaceActivatedAtMs || !host.firstRoomAtMs || (host.lastRoomAtMs && referenceMs - host.lastRoomAtMs > 14 * 86400000)));
  return <div className="space-y-4" data-host-operations-overview><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Approved Hosts" value={funnel.approved || 0} detail="Selected for Host access" /><Metric label="Room-Active 30d" value={funnel.activeHosts30 || 0} detail="Based on the most recent provisioned Room" tone="pink" /><Metric label="Repeat Hosts" value={funnel.repeatHosts || 0} detail="Created at least two distinct Rooms" tone="amber" /><Metric label="Needs Attention" value={attentionHosts.length} detail="Onboarding or activity follow-up" tone="amber" /></div><Panel className="p-4"><div className="flex items-end justify-between gap-3"><div><Eyebrow>Operating Snapshot</Eyebrow><h2 className="mt-1 text-xl font-black text-white">Hosts to check in with</h2></div><span className="text-xs text-zinc-500">Usage period {summary?.period || '—'}</span></div><div className="mt-4 grid gap-2">{attentionHosts.slice(0, 8).map((host) => <button type="button" key={host.applicationId} onClick={() => onSelectHost(host)} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/25 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><strong className="text-sm text-white">{host.name || host.email}</strong><div className="mt-1 text-xs text-zinc-500">{!host.workspaceActivatedAtMs ? 'Workspace not started' : !host.firstRoomAtMs ? 'No first Room yet' : `Last Room ${formatAgo(host.lastRoomAtMs)}`}</div></div><StatusChip tone="amber">Follow up</StatusChip><span className="text-xs text-zinc-500">{host.hostType?.replace(/_/g, ' ') || 'Host'}</span></button>)}{!attentionHosts.length ? <div className="rounded-xl border border-emerald-300/15 bg-emerald-500/8 p-4 text-sm text-emerald-100">No approved Hosts currently match the onboarding or dormancy attention rules.</div> : null}</div></Panel></div>;
};

const HostRoster = ({ summary }) => {
  const [query, setQuery] = useState('');
  const hosts = useMemo(() => (Array.isArray(summary?.hosts) ? summary.hosts : []).filter((host) => host.status === 'approved' && `${host.name} ${host.email}`.toLowerCase().includes(query.toLowerCase())), [query, summary]);
  return <Panel className="overflow-hidden" data-active-host-roster><div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between"><div><Eyebrow>Approved Host Roster</Eyebrow><h2 className="mt-1 text-xl font-black text-white">Activity and usage snapshot</h2><p className="mt-1 text-xs text-zinc-500">Room activity reflects provisioning milestones; provider counts reflect the selected monthly usage period.</p></div><input className={`${inputClass} sm:max-w-xs`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Hosts" /></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-zinc-500"><tr><th className="px-4 py-3">Host</th><th className="px-3 py-3">Last Room</th><th className="px-3 py-3">Onboarding</th><th className="px-3 py-3">AI</th><th className="px-3 py-3">YouTube</th><th className="px-3 py-3">Apple</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Attention</th></tr></thead><tbody className="divide-y divide-white/5">{hosts.map((host) => { const dormant = host.lastRoomAtMs && Number(summary?.generatedAtMs || 0) - host.lastRoomAtMs > 14 * 86400000; const attention = !host.workspaceActivatedAtMs ? 'Needs setup' : !host.firstRoomAtMs ? 'Needs rehearsal' : dormant ? 'Dormant' : 'Healthy'; return <tr key={host.applicationId} className="hover:bg-white/[0.03]"><td className="px-4 py-3"><strong className="block text-white">{host.name || host.email}</strong><span className="text-xs text-zinc-500">{host.email}</span></td><td className="px-3 py-3 text-zinc-300">{formatAgo(host.lastRoomAtMs)}</td><td className="px-3 py-3"><span className="text-xs text-zinc-300">{host.secondRoomAtMs ? 'Repeat' : host.firstRoomAtMs ? 'First Room' : host.workspaceActivatedAtMs ? 'Workspace ready' : 'Invited'}</span></td><td className="px-3 py-3 text-zinc-300">{host.usageMeters?.ai_generate_content?.used || 0}</td><td className="px-3 py-3 text-zinc-300">{host.usageMeters?.youtube_data_request?.used || 0}</td><td className="px-3 py-3 text-zinc-300">{host.usageMeters?.apple_music_request?.used || 0}</td><td className="px-3 py-3"><StatusChip>{host.planId || 'free'}</StatusChip></td><td className="px-3 py-3"><StatusChip tone={attention === 'Healthy' ? 'emerald' : 'amber'}>{attention}</StatusChip></td></tr>; })}</tbody></table></div>{!hosts.length ? <div className="p-6 text-center text-sm text-zinc-500">No approved Hosts match this view.</div> : null}</Panel>;
};


const ApplicationsWorkspace = ({ onChanged, focusApplicationId = '' }) => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async (clearNotice = true) => {
    try {
      const payload = await listHostApplications({ status: filter, limit: 100 });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      if (clearNotice) setNotice('');
      return true;
    } catch (error) {
      setNotice(errorText(error, 'Could not load applications.'));
      return false;
    }
  }, [filter]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!focusApplicationId || !items.some((item) => item.applicationId === focusApplicationId)) return;
    document.getElementById(`host-application-${focusApplicationId}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [focusApplicationId, items]);

  const decide = async (item, action) => {
    const verb = action === 'approve' ? 'approve and invite' : action === 'resend_invite' ? 'resend onboarding to' : 'reject';
    if (!window.confirm(`Are you sure you want to ${verb} ${item.name || item.email}?`)) return;
    setBusy(item.applicationId);
    try {
      const result = await resolveHostApplication({
        applicationId: item.applicationId,
        action,
        notes: notes[item.applicationId] || '',
      });
      const delivery = result?.notification || {};
      const deliveryMessage = delivery.status === 'queued'
        ? `Email queued to ${delivery.recipient}.`
        : `Access was updated, but the email is ${delivery.status || 'not confirmed'}.`;
      const actionMessage = action === 'approve'
        ? `Host approved. ${deliveryMessage}`
        : action === 'resend_invite'
          ? `Onboarding email retry complete. ${deliveryMessage}`
          : `Application rejected. ${deliveryMessage}`;
      const listRefreshed = await refresh(false);
      let summaryRefreshed = true;
      try { await onChanged?.(); } catch { summaryRefreshed = false; }
      setNotice(listRefreshed && summaryRefreshed ? actionMessage : `${actionMessage} Some dashboard data could not refresh.`);
    } catch (error) {
      setNotice(errorText(error, 'Application action failed before any success was confirmed.'));
    } finally {
      setBusy('');
    }
  };

  return <div className="space-y-4" data-host-application-delivery-tracking>
    <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
      <div><Eyebrow tone="pink">Invite Desk</Eyebrow><h2 className="mt-1 text-xl font-black text-white">Host applications</h2><p className="mt-1 text-sm text-zinc-400">Approval grants complimentary testing access and queues a guided onboarding email.</p></div>
      <div className="flex gap-2"><select className={`${inputClass} min-w-[170px]`} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button type="button" className={secondaryButton} onClick={() => refresh()}><i className="fa-solid fa-rotate" /> Refresh</button></div>
    </Panel>
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => {
        const delivery = item.decisionEmail;
        const deliveryStatus = delivery?.status || 'not_recorded';
        const deliveryTone = deliveryStatus === 'sent' ? 'emerald' : deliveryStatus === 'queued' || deliveryStatus === 'sending' ? 'amber' : 'rose';
        return <div id={`host-application-${item.applicationId}`} key={item.applicationId}><Panel className={`p-4 ${focusApplicationId === item.applicationId ? 'border-cyan-200/50 ring-2 ring-cyan-300/15' : ''}`}>
          <div className="flex items-start justify-between gap-3"><div><strong className="text-lg text-white">{item.name || item.email}</strong><div className="mt-1 text-xs text-zinc-500">{item.email} · {formatDate(item.submittedAtMs || item.createdAtMs)}</div></div><StatusChip tone={item.status === 'pending' ? 'amber' : item.status === 'approved' ? 'emerald' : 'rose'}>{item.status}</StatusChip></div>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><Eyebrow>Hosting Goal</Eyebrow><p className="mt-2 text-sm leading-6 text-zinc-300">{item.hostProfile?.hostingGoal || 'No testing goal supplied.'}</p><div className="mt-2 text-xs text-zinc-500">{item.hostProfile?.hostType?.replace(/_/g, ' ') || 'Host type not supplied'}</div></div>
          {item.status !== 'pending' ? <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><Eyebrow>Applicant email</Eyebrow><div className="mt-1 text-sm text-zinc-300">{delivery?.recipient || item.email}</div></div><StatusChip tone={deliveryTone}>{deliveryStatus.replace(/_/g, ' ')}</StatusChip></div>{delivery?.lastError ? <p className="mt-2 text-xs text-rose-200">{delivery.lastError}</p> : null}{!delivery ? <p className="mt-2 text-xs text-amber-100">Delivery was not recorded for this earlier decision. Resend if the Host did not receive onboarding.</p> : null}</div> : null}
          {item.status === 'pending' ? <><textarea className={`${inputClass} mt-3 min-h-[88px]`} value={notes[item.applicationId] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.applicationId]: event.target.value }))} placeholder="Private approval notes" /><div className="mt-3 flex gap-2"><button className={primaryButton} disabled={busy === item.applicationId} onClick={() => decide(item, 'approve')}>Approve + Send Onboarding</button><button className={dangerButton} disabled={busy === item.applicationId} onClick={() => decide(item, 'reject')}>Reject</button></div></> : null}
          {item.status === 'approved' ? <button type="button" className={`${secondaryButton} mt-3`} disabled={busy === item.applicationId} onClick={() => decide(item, 'resend_invite')}><i className="fa-solid fa-paper-plane" /> Resend onboarding email</button> : null}
        </Panel></div>;
      })}
    </div>
    {!items.length ? <EmptyState icon="fa-ticket" title={`No ${filter} applications`} body="Applications will appear here as people join the selective Host testing line." /> : null}
    {notice ? <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">{notice}</div> : null}
  </div>;
};

const GettingStarted = ({ onboarding, onOpenHelp, onOpenSupport }) => {
  const steps = [
    { id: 'approved', label: 'Private invitation active', complete: onboarding?.approved },
    { id: 'workspace', label: 'Host workspace ready', complete: onboarding?.workspaceActivated },
    { id: 'first', label: 'Private rehearsal Room created', complete: onboarding?.firstRoomComplete },
    { id: 'repeat', label: 'Second Room created', complete: onboarding?.repeatRoomComplete },
  ];
  const complete = steps.filter((step) => step.complete).length;
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel className="p-5"><Eyebrow>First-Night Path</Eyebrow><h2 className="mt-1 text-2xl font-black text-white">Build confidence before guests arrive</h2><div className="mt-5 space-y-3">{steps.map((step, index) => <div key={step.id} className={`flex items-center gap-3 rounded-2xl border p-4 ${step.complete ? 'border-emerald-300/20 bg-emerald-500/8' : index === complete ? 'border-cyan-300/25 bg-cyan-500/8' : 'border-white/10 bg-black/20'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${step.complete ? 'border-emerald-300/25 bg-emerald-500/12 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-500'}`}><i className={`fa-solid ${step.complete ? 'fa-check' : 'fa-circle'}`} /></span><div><strong className="text-sm text-white">{step.label}</strong><div className="mt-1 text-xs text-zinc-500">{step.complete ? 'Complete' : index === complete ? 'Your next step' : 'Comes next'}</div></div></div>)}</div></Panel><Panel className="p-5"><Eyebrow tone="pink">Rehearsal Checklist</Eyebrow><h3 className="mt-1 text-lg font-black text-white">Test all three surfaces</h3><ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-300"><li>1. Create a private Room.</li><li>2. Open Public TV on a second screen.</li><li>3. Join from your phone as an audience member.</li><li>4. Request a song and move it through the queue.</li><li>5. Send product questions through Message the Team—not Room chat.</li></ol><div className="mt-5 grid gap-2"><button type="button" onClick={onOpenHelp} className={`${primaryButton} w-full`}>Open Host Guide</button><button type="button" onClick={onOpenSupport} className={`${secondaryButton} w-full`}>Message the Team</button></div></Panel></div>;
};

const GettingStartedV2 = ({ accessTerms, ...props }) => (
  <div className="space-y-4" data-complimentary-host-onboarding>
    <Panel className="border-emerald-300/20 bg-emerald-500/8 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><Eyebrow>Testing access</Eyebrow><h2 className="mt-1 text-xl font-black text-white">{accessTerms?.label || 'Complimentary testing access'}</h2><p className="mt-1 text-sm leading-6 text-emerald-50/75">Your approved testing access costs $0. No card is required, no subscription was started, and there are no automatic charges. Usage meters are shown for transparency, not as a bill.</p></div>
        <StatusChip tone="emerald">{accessTerms?.priceLabel || '$0 during testing'}</StatusChip>
      </div>
    </Panel>
    <GettingStarted {...props} />
  </div>
);

const AccessGate = ({ mode, access, error }) => <div className="grid min-h-screen place-items-center bg-black p-6 text-white"><Panel className="max-w-xl p-8 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/25 bg-amber-500/10 text-amber-200"><i className="fa-solid fa-lock text-xl" /></div><h1 className="mt-5 text-2xl font-black">{mode === 'ops' ? 'Super admin access required' : 'Approved Host access required'}</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{error || (mode === 'ops' ? 'Sign in with a verified BeauRocks super-admin account to open Host Operations.' : 'The Host Hub becomes available after your private Host invitation is approved.')}</p><div className="mt-6 flex flex-wrap justify-center gap-2"><a className={primaryButton} href="/host-access">Sign In</a><a className={secondaryButton} href="/?mode=host">Host Dashboard</a></div>{access?.email ? <div className="mt-4 text-xs text-zinc-600">Signed in as {access.email}</div> : null}</Panel></div>;

const HostRelationsApp = ({ mode = 'hub' }) => {
  const isOps = mode === 'ops';
  const params = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const tabs = isOps ? OPS_TABS : HUB_TABS;
  const initialTab = params.get('tab') || (isOps ? 'overview' : 'updates');
  const focusApplicationId = params.get('applicationId') || '';
  const [tab, setTab] = useState(tabs.some((item) => item.id === initialTab) ? initialTab : tabs[0].id);
  const [access, setAccess] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshAccess = useCallback(async () => {
    setLoading(true);
    try {
      const [hostPayload, adminPayload] = await Promise.all([getMyHostAccessStatus(), getMyDirectoryAccess()]);
      const next = {
        email: adminPayload?.email || '',
        host: hostPayload || {},
        isSuperAdmin: adminPayload?.mode === 'super_admin',
        mode: adminPayload?.mode || '',
        isModerator: adminPayload?.isModerator === true,
      };
      setAccess(next);
      setError('');
      if (isOps && next.isSuperAdmin) {
        try {
          setSummary(await getHostLifecycleReportingSummary({}));
        } catch (summaryError) {
          setError(errorText(summaryError, 'Access verified, but the Host activity snapshot could not load.'));
        }
      }
    } catch (nextError) {
      setAccess(null);
      setError(errorText(nextError, 'Could not verify Host access.'));
    } finally { setLoading(false); }
  }, [isOps]);
  useEffect(() => { refreshAccess(); }, [refreshAccess]);
  const allowed = isOps ? access?.isSuperAdmin : (access?.isSuperAdmin || access?.host?.hostApprovalEnabled);
  if (loading) return <div className="grid min-h-screen place-items-center bg-black text-cyan-200"><div className="text-center"><i className="fa-solid fa-spinner fa-spin text-2xl" /><div className="mt-3 text-xs font-black uppercase tracking-[0.22em]">Opening {isOps ? 'Host Operations' : 'Host Hub'}</div></div></div>;
  if (!allowed) return <AccessGate mode={mode} access={access} error={error} />;
  const switchTab = (next) => { setTab(next); const url = new URL(window.location.href); url.searchParams.set('tab', next); window.history.replaceState({}, '', url); };
  return (
    <div className="h-screen overflow-hidden bg-black font-saira text-white" data-host-relations-mode={mode}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_90%_0%,rgba(244,114,182,0.14),transparent_34%),linear-gradient(180deg,#0a0a0d,#050507)]" />
      <header className="relative z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-cyan-200/20 bg-[linear-gradient(105deg,rgba(20,42,66,0.98),rgba(37,31,67,0.98)_52%,rgba(61,25,59,0.97))] px-3 py-2.5 shadow-[0_16px_45px_rgba(8,15,34,0.38)] sm:px-5" data-host-panel-shell="true">
        <div className="flex min-w-0 items-center gap-3"><img src={ASSETS.logo} alt="BeauRocks" className="h-11 w-11 rounded-xl border border-white/10 bg-black/30 object-contain p-0.5 shadow-xl" /><div className="min-w-0"><Eyebrow>{isOps ? 'Super Admin · Host Panel' : 'Approved Host · Host Panel'}</Eyebrow><h1 className="truncate text-lg font-black tracking-tight sm:text-xl">{isOps ? 'Host Operations' : 'Host Hub'}</h1><p className="hidden truncate text-xs text-cyan-50/55 sm:block">{isOps ? 'Applications, Host activity, updates, and support' : 'Updates, guides, onboarding, and private team support'}</p></div></div>
        <div className="flex items-center gap-2">{access?.isSuperAdmin ? <a href={isOps ? '/hub' : '/ops/hosts'} className={secondaryButton}><i className={`fa-solid ${isOps ? 'fa-sparkles' : 'fa-shield-halved'}`} /><span className="hidden sm:inline">{isOps ? 'View Host Hub' : 'Host Operations'}</span></a> : null}<a href="/?mode=host" className={secondaryButton}><i className="fa-solid fa-arrow-left" /><span className="hidden sm:inline">Back to Host Panel</span></a></div>
      </header>
      <div className="relative z-10 flex h-[calc(100vh-76px)] min-h-0 flex-col md:flex-row">
        <nav className="shrink-0 overflow-x-auto border-b border-white/10 bg-zinc-950/86 p-2 md:w-[232px] md:overflow-y-auto md:border-b-0 md:border-r md:p-3 custom-scrollbar" aria-label={isOps ? 'Host Operations' : 'Host Hub'}>
          <div className="hidden px-2 pb-3 pt-1 md:block"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{isOps ? 'Team workspace' : 'Host resources'}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{isOps ? 'Manage the testing program.' : 'Catch up, learn, or reach the team.'}</p></div>
          <div className="flex min-w-max gap-1 md:min-w-0 md:flex-col">{tabs.map((item) => <button key={item.id} type="button" onClick={() => switchTab(item.id)} className={`flex min-h-[58px] min-w-[132px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition md:min-w-0 ${tab === item.id ? 'border-cyan-300/30 bg-cyan-500/12 text-cyan-50 shadow-[0_10px_28px_rgba(6,182,212,0.08)]' : 'border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tab === item.id ? 'bg-cyan-400/15 text-cyan-200' : 'bg-white/5 text-zinc-500'}`}><i className={`fa-solid ${item.icon}`} /></span><span className="min-w-0"><span className="block text-sm font-black leading-4">{item.label}</span><span className="mt-1 hidden text-[11px] leading-4 text-zinc-500 md:block">{item.description}</span></span></button>)}</div>
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4 lg:p-5">
          <div className="mx-auto max-w-[1500px]">
            {error ? <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div> : null}
            {isOps && tab === 'overview' ? <HostOverview summary={summary} onSelectHost={() => switchTab('hosts')} /> : null}
            {isOps && tab === 'applications' ? <ApplicationsWorkspace focusApplicationId={focusApplicationId} onChanged={async () => setSummary(await getHostLifecycleReportingSummary({}))} /> : null}
            {isOps && tab === 'hosts' ? <HostRoster summary={summary} /> : null}
            {tab === 'updates' ? <UpdatesWorkspace admin={isOps} /> : null}
            {tab === 'support' ? <SupportWorkspace admin={isOps} /> : null}
            {!isOps && tab === 'getting_started' ? <GettingStartedV2 accessTerms={access?.host?.accessTerms} onboarding={access?.host?.onboarding} onOpenHelp={() => switchTab('help')} onOpenSupport={() => switchTab('support')} /> : null}
            {!isOps && tab === 'help' ? <HostHelpGuide onOpenSupport={() => switchTab('support')} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HostRelationsApp;
