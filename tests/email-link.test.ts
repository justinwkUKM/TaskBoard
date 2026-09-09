import { describe, expect, it } from 'vitest';
import { emailLinkReturnUrl, safeDestination, verifiedSignIn } from '../src/lib/email-link';
describe('magic-link redirect safety', () => {
  it('preserves invitations without putting the email in the URL', () => {
    const path = `/invite/board.${'a'.repeat(43)}`;
    const url = new URL(emailLinkReturnUrl('https://taskboard.waqasobeidy.com', path));
    expect(url.pathname).toBe('/auth/finish'); expect(url.searchParams.get('next')).toBe(path);
    expect(url.searchParams.has('email')).toBe(false);
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/boards?next=https://evil.example', null])('rejects an unsafe return path: %s', value => expect(safeDestination(value)).toBe('/boards'));
});
describe('backend identity policy', () => {
  it.each(['google.com', 'password'])('allows verified %s sessions', provider => expect(verifiedSignIn({ email_verified: true, firebase: { sign_in_provider: provider } })).toBe(true));
  it.each(['google.com', 'password', 'anonymous', 'custom'])('rejects unverified %s sessions', provider => expect(verifiedSignIn({ email_verified: false, firebase: { sign_in_provider: provider } })).toBe(false));
  it('rejects other providers even with a verified email', () => expect(verifiedSignIn({ email_verified: true, firebase: { sign_in_provider: 'custom' } })).toBe(false));
});
