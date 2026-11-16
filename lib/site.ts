// Public contact details shown on the privacy page and in the feedback links.

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function feedbackHref(subject = "Doku feedback"): string | null {
  return CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` : null;
}
