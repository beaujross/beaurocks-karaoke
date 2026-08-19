import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path) => readFileSync(path, 'utf8');

describe('full-night Trivia and Would You Rather sessions', () => {
  it('keeps one revisioned server owner and projects to legacy audience/TV fields', () => {
    const functions = readSource('functions/index.js');
    const callable = functions.slice(
      functions.indexOf('exports.controlPromptSession = onCall'),
      functions.indexOf('exports.submitBingoTileConfirmation'),
    );

    expect(callable).toContain('db.runTransaction');
    expect(callable).toContain('expectedRevision');
    expect(callable).toContain('Prompt session changed on another host');
    expect(callable).toContain('promptSession: publicSession');
    expect(callable).toContain('room_prompt_sessions_private');
    expect(callable).toContain('publicPrompts');
    expect(callable).toContain('if (action === "read")');
    expect(callable).toContain('tx.set(sessionRef, next');
    expect(functions).toContain('buildPromptSessionRoomProjection');
    expect(functions).toContain('triviaQuestion:');
    expect(functions).toContain('wyrData:');
  });

  it('exposes format-specific setup and live transport instead of the generic game launcher', () => {
    const host = readSource('src/apps/Host/HostApp.jsx');
    const panel = readSource('src/apps/Host/components/PromptNightSessionPanel.jsx');

    expect(host).toContain("tab === 'stage' && ['trivia', 'would_you_rather'].includes");
    expect(host).toContain('<PromptNightSessionPanel roomCode={roomCode} room={room || {}} />');
    expect(host).toContain('!room?.promptSession?.id');
    expect(panel).toContain("runAction('configure'");
    expect(panel).toContain("runAction('start')");
    expect(panel).toContain("runAction('reveal')");
    expect(panel).toContain("runAction('next')");
    expect(panel).toContain("runAction('pause')");
    expect(panel).toContain("runAction('resume')");
    expect(panel).toContain('expectedRevision');
    expect(panel).toContain("controlPromptSession({ roomCode, action: 'read' })");
    expect(panel).toContain('setTriviaCorrect');
    expect(panel).toContain('updateTriviaOption');
    expect(panel).toContain('Correct answers could not be loaded');
  });

  it('presents four experiences and one consolidated Original Track Party', () => {
    const launch = readSource('src/apps/Host/components/HostRoomLaunchPadBrowser.jsx');

    expect(launch).toContain("label: 'Karaoke'");
    expect(launch).toContain("label: 'Original Track Party'");
    expect(launch).toContain("label: 'Trivia Night'");
    expect(launch).toContain("label: 'Would You Rather'");
    expect(launch).not.toContain("label: 'Crowd Sing-Along'");
    expect(launch).not.toContain("label: 'Lip Sync Night'");
    expect(launch).toContain('Lyrics preference');
  });
});
