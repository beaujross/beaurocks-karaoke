import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

const callableSource = readFileSync('functions/hostCommunications.js', 'utf8');
const indexSource = readFileSync('functions/index.js', 'utf8');
const appSource = readFileSync('src/App.jsx', 'utf8');
const relationsSource = readFileSync('src/apps/HostRelations/HostRelationsApp.jsx', 'utf8');
const helpSource = readFileSync('src/apps/Help/HelpCenter.jsx', 'utf8');
const topChromeSource = readFileSync('src/apps/Host/components/HostTopChrome.jsx', 'utf8');
const firebaseSource = readFileSync('src/lib/firebase.js', 'utf8');
const indexesSource = readFileSync('firestore.indexes.json', 'utf8');

test('host communications require an approved Host or a super admin', () => {
  assert.match(callableSource, /getDirectoryModeratorAccess\(actorUid\)/);
  assert.match(callableSource, /resolveHostWorkspaceAccess\(actorUid, email\)/);
  assert.match(callableSource, /moderator\?\.mode === "super_admin"/);
  assert.match(callableSource, /host\?\.hostApprovalEnabled !== true/);
  assert.match(callableSource, /Active Host invitation required\./);
  assert.match(callableSource, /guard\(request, \{ adminOnly: true, uid \}\)/);
  assert.match(callableSource, /Super admin access required\./);
});

test('approved Hosts only receive published updates and comment where enabled', () => {
  assert.match(callableSource, /includeDrafts \|\| item\.status === "published"/);
  assert.match(callableSource, /announcement\.status !== "published"/);
  assert.match(callableSource, /announcement\.status !== "published" \|\| !announcement\.commentsEnabled/);
  assert.match(callableSource, /moderateHostAnnouncementComment:[\s\S]*adminOnly: true/);
  assert.match(callableSource, /strictAppCheck\) requireAppCheck/);
  assert.match(callableSource, /checkDurableRateLimit\(request\.rawRequest, id, limits, uid\)/);
  assert.doesNotMatch(callableSource, /authorUid: text\(data\.authorUid/);
});

test('support conversations are private to their Host and the team', () => {
  assert.match(callableSource, /thread\.ownerUid !== access\.uid/);
  assert.match(callableSource, /This support conversation is private\./);
  assert.match(callableSource, /where\("ownerUid", "==", access\.uid\)/);
  assert.match(callableSource, /Hosts can only reopen or resolve their conversations\./);
  assert.match(relationsSource, /Start a private conversation/);
  assert.match(relationsSource, /Reply as BeauRocks Team/);
  assert.match(relationsSource, /Reply to the BeauRocks team/);
  assert.doesNotMatch(relationsSource, /HostInboxPanel/);
});

test('the Host Hub and Operations surfaces are lazy, canonical, and discoverable', () => {
  assert.match(appSource, /lazy\(\(\) => import\('\.\/apps\/HostRelations\/HostRelationsApp'\)\)/);
  assert.match(appSource, /normalizedPathname === '\/hub'/);
  assert.match(appSource, /normalizedPathname === '\/ops\/hosts'/);
  assert.match(appSource, /<HostRelationsApp mode=\{view === 'host_ops' \? 'ops' : 'hub'\}/);
  assert.match(topChromeSource, /data-feature-id="host-hub-link"/);
  assert.match(topChromeSource, /data-feature-id="host-hub-quick-nav-link"/);
  assert.match(topChromeSource, /data-feature-id="host-guide-quick-nav-link"/);
  assert.match(indexSource, /https:\/\/host\.beaurocks\.app\/ops\/hosts\?tab=applications&applicationId=/);
  assert.match(relationsSource, /focusApplicationId=\{focusApplicationId\}/);
  assert.match(relationsSource, /scrollIntoView/);
});

test('Host Relations exposes the approved-host operating workspaces and honest activity labels', () => {
  assert.match(relationsSource, /data-host-relations-mode=\{mode\}/);
  assert.match(relationsSource, /data-host-updates-workspace/);
  assert.match(relationsSource, /data-host-support-workspace/);
  assert.match(relationsSource, /data-active-host-roster/);
  assert.match(relationsSource, /Room activity reflects provisioning milestones/);
  assert.match(relationsSource, /Send product questions through Message the Team—not Room chat\./);
  assert.match(relationsSource, /Approved Host · Host Panel/);
  assert.match(relationsSource, /Super Admin · Host Panel/);
  assert.match(relationsSource, /id: 'help', label: 'Host Guide'/);
  assert.match(relationsSource, /data-host-panel-shell="true"/);
  assert.match(helpSource, /data-host-help-guide/);
  assert.match(helpSource, /Host Inbox is for the live Room\. Host Hub messages are private conversations with the BeauRocks product team\./);
});

test('Host application records are administrator-only and explicitly serialized', () => {
  const start = indexSource.indexOf('exports.listHostApplications =');
  const end = indexSource.indexOf('exports.resolveHostApplication =', start);
  const applicationListSource = indexSource.slice(start, end);
  assert.match(applicationListSource, /!requesterAccess\.isAdmin/);
  assert.match(applicationListSource, /applicationId: String\(item\.applicationId/);
  assert.match(applicationListSource, /reviewNotes: normalizeDirectoryTextBlock/);
  assert.doesNotMatch(applicationListSource, /\.\.\.item/);
});

test('private support ordering has its required owner and updated-time index', () => {
  assert.match(indexesSource, /"collectionGroup": "host_support_threads"[\s\S]*"fieldPath": "ownerUid"[\s\S]*"fieldPath": "updatedAt"/);
});
test('the callable client exports every Host communications operation used by the UI', () => {
  assert.match(firebaseSource, /if \(forcedOff\) return false/);
  assert.doesNotMatch(firebaseSource, /forcedOff \|\| isProdHost/);
  assert.match(firebaseSource, /const requireStrictAppCheckToken/);
  assert.match(firebaseSource, /await requireStrictAppCheckToken\("postHostSupportMessage"\)/);
  for (const name of [
    'listHostAnnouncements',
    'upsertHostAnnouncement',
    'listHostAnnouncementComments',
    'postHostAnnouncementComment',
    'moderateHostAnnouncementComment',
    'listHostSupportThreads',
    'createHostSupportThread',
    'getHostSupportThread',
    'postHostSupportMessage',
    'setHostSupportThreadStatus',
  ]) {
    assert.match(callableSource, new RegExp(`${name}: onCall`));
    assert.match(firebaseSource, new RegExp(`const ${name} = async`));
    assert.match(firebaseSource, new RegExp(`\\b${name},`));
  }
});
