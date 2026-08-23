import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  serializeAnnouncement,
  serializeComment,
  serializeThread,
  sanitizeSupportContext,
  serializeMessage,
} = require('../../functions/hostCommunications.js');

const snap = (id, data) => ({ id, data: () => data });
const timestamp = (value) => ({ toMillis: () => value });

test('announcement serialization applies safe defaults and timestamp normalization', () => {
  const result = serializeAnnouncement(snap('update-1', {
    title: '  Release notes  ',
    body: 'A better Host flow.',
    category: 'not_public',
    status: 'published',
    commentsEnabled: false,
    pinned: true,
    publishedAt: timestamp(1234),
    commentCount: -5,
  }));

  assert.deepEqual(result, {
    announcementId: 'update-1',
    title: 'Release notes',
    body: 'A better Host flow.',
    category: 'product_update',
    status: 'published',
    pinned: true,
    commentsEnabled: false,
    publishedAtMs: 1234,
    createdAtMs: 0,
    updatedAtMs: 0,
    publishedByName: 'BeauRocks Team',
    commentCount: 0,
  });
});

test('comments and messages normalize author roles without exposing arbitrary role values', () => {
  const comment = serializeComment(snap('comment-1', {
    announcementId: 'update-1',
    body: 'Looks good',
    authorUid: 'host-1',
    authorName: '',
    authorRole: 'super_admin',
    createdAt: { _seconds: 5 },
  }));
  const message = serializeMessage(snap('message-1', {
    threadId: 'thread-1',
    body: 'We can help.',
    authorUid: 'admin-1',
    authorName: 'Support',
    authorRole: 'team',
    createdAt: 9000,
  }));

  assert.equal(comment.authorRole, 'host');
  assert.equal(comment.authorName, 'Host');
  assert.equal(comment.createdAtMs, 5000);
  assert.equal(message.authorRole, 'team');
  assert.equal(message.createdAtMs, 9000);
});

test('thread serialization normalizes identity, status, category, and counts', () => {
  const result = serializeThread(snap('thread-1', {
    ownerUid: 'host-1',
    ownerEmail: ' HOST@EXAMPLE.COM ',
    ownerName: 'Alex',
    title: '',
    category: 'billing',
    status: 'invented_status',
    lastMessageByRole: 'team',
    messageCount: '3',
    updatedAt: timestamp(4321),
  }));

  assert.equal(result.ownerEmail, 'host@example.com');
  assert.equal(result.title, 'Support request');
  assert.equal(result.category, 'billing');
  assert.equal(result.status, 'open');
  assert.equal(result.lastMessageByRole, 'team');
  assert.equal(result.messageCount, 3);
  assert.equal(result.updatedAtMs, 4321);
});

test('Host Panel support context is whitelisted, normalized, and included on threads', () => {
  const context = sanitizeSupportContext({
    source: 'host_panel_feedback',
    roomCode: ' ab12 ',
    roomName: ' Friday Night ',
    workspaceSection: 'media.playback',
    queueCount: 10005,
    performanceTitle: 'Song',
    performanceSinger: 'Audience Member',
    pathname: '/host?token=secret',
    secret: 'must not survive',
    capturedAtMs: 1234.7,
  });

  assert.deepEqual(context, {
    source: 'host_panel_feedback',
    roomCode: 'AB12',
    roomName: 'Friday Night',
    workspaceSection: 'media_playback',
    queueCount: 9999,
    performanceTitle: 'Song',
    pathname: '/host',
    capturedAtMs: 1235,
  });
  assert.equal('secret' in context, false);
  assert.equal('performanceSinger' in context, false);

  const result = serializeThread(snap('thread-context', { context }));
  assert.equal(result.context.roomCode, 'AB12');
  assert.equal(result.context.source, 'host_panel_feedback');
});

test('unrecognized support context sources are discarded', () => {
  assert.equal(sanitizeSupportContext({ source: 'audience', roomCode: 'AB12' }), null);
});
