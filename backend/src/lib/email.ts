import type { FastifyBaseLogger } from 'fastify';

// No transactional email provider is wired up yet (see BACKEND_SPEC.md
// "Notifications" — Postmark/Resend TBD). This logs instead of sending so
// the auth/quote flows that depend on "an email goes out" are fully wired
// and testable now; swap the body for a real provider call once credentials
// exist. Call sites don't need to change.
export async function sendEmail(
  logger: FastifyBaseLogger,
  message: { to: string; subject: string; text: string },
): Promise<void> {
  logger.info({ to: message.to, subject: message.subject, text: message.text }, 'email (stub): would send');
}
