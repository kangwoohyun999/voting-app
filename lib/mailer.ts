// SMTP mailer for the running app (a dedicated Gmail account with an app password).
import nodemailer from "nodemailer";
import type { Mailer } from "@/lib/polls/polls";

const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;

export function createSmtpMailer(env = process.env): Mailer {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    const problem = `SMTP is not configured: set ${missing.join(", ")} in .env.local`;
    // Fail loudly in production; in development print emails so the app stays usable.
    if (env.NODE_ENV === "production") throw new Error(problem);
    console.warn(`${problem}. Emails will be printed to the console instead.`);
    return { send: async (email) => console.info("[email]", email) };
  }

  const port = Number(env.SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return {
    send: async (email) => {
      await transport.sendMail({ from: env.MAIL_FROM, ...email });
    },
  };
}
