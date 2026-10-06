export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validLeadEmail(email: string): boolean {
  return email.length <= 254 && !/[\x00-\x1f\x7f]/.test(email) && EMAIL_RE.test(email)
}

