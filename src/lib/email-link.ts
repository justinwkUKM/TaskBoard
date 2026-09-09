export const EMAIL_STORAGE_KEY = 'taskboard_signin_email';
export function safeDestination(value: string | null): string {
  if (value === '/boards') return value;
  if (value && /^\/invite\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{43}$/.test(value)) return value;
  return '/boards';
}
export function emailLinkReturnUrl(origin: string, destination: string) {
  const url = new URL('/auth/finish', origin);
  url.searchParams.set('next', safeDestination(destination));
  return url.toString();
}
export function verifiedSignIn(user: { email_verified?: boolean; firebase: { sign_in_provider: string } }) {
  // Firebase issues email-link sessions with the "password" provider ID.
  return user.email_verified === true && ['google.com', 'password'].includes(user.firebase.sign_in_provider);
}
