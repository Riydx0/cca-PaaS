import nodemailer from "nodemailer";
import { Resend } from "resend";

export interface SendEmailParams {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendPasswordLinkResult {
  sent: boolean;
  plainLink?: string;
}

/**
 * Delivers an email via the first available transport:
 *   1. Resend — if RESEND_API_KEY is set
 *   2. SMTP   — if SMTP_HOST is set (uses SMTP_PORT / SMTP_USER / SMTP_PASS)
 *   3. Console fallback — logs to stdout (no-op in production)
 */
async function deliverEmail(params: SendEmailParams): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM ?? `"CloudMarket" <noreply@cloudmarket.app>`;

  if (resendKey) {
    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error || !data) {
      throw new Error(`Resend delivery failed: ${error?.message ?? "unknown error"}`);
    }
    return true;
  }

  if (smtpHost) {
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return true;
  }

  console.log(
    `[EmailService] No email transport configured (set RESEND_API_KEY or SMTP_HOST). ` +
      `Would send "${params.subject}" to ${params.to}.\n${params.text}`
  );
  return false;
}

export class EmailService {
  static async sendCloudronAlert(params: {
    to: string;
    toName: string;
    instanceName: string;
    error?: string;
    detectedAt: Date;
    siteName?: string;
  }): Promise<void> {
    const siteName = params.siteName ?? "CloudMarket";
    const subject = `${siteName} — Cloudron connection lost`;
    const detectedStr = params.detectedAt.toUTCString();

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#111;background:#f9fafb;padding:40px 0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;color:#dc2626">&#9888; Cloudron Connection Lost</h2>
    <p style="color:#6b7280;margin:0 0 24px">Hello ${params.toName},</p>
    <p>The Cloudron instance <strong>${params.instanceName}</strong> became unreachable at <strong>${detectedStr}</strong>.</p>
    ${params.error ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;color:#dc2626;font-size:14px"><strong>Error:</strong> ${params.error}</p>` : ""}
    <p>Please check your Cloudron server and network connectivity. Log in to the admin panel to dismiss this alert once the connection is restored.</p>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px">You are receiving this alert because you are a super admin of ${siteName}. Alerts are rate-limited to at most once per hour.</p>
  </div>
</body>
</html>`;

    const text = `Cloudron Connection Lost\n\nHello ${params.toName},\n\nThe Cloudron instance "${params.instanceName}" became unreachable at ${detectedStr}.\n${params.error ? `\nError: ${params.error}\n` : ""}\nPlease check your Cloudron server and network connectivity.\n\nYou are receiving this alert because you are a super admin of ${siteName}. Alerts are rate-limited to at most once per hour.`;

    await deliverEmail({ to: params.to, toName: params.toName, subject, html, text });
  }

  static async sendPasswordLink(params: {
    to: string;
    toName: string;
    type: "setup" | "reset";
    link: string;
    siteName?: string;
  }): Promise<SendPasswordLinkResult> {
    const siteName = params.siteName ?? "CloudMarket";
    const isSetup = params.type === "setup";
    const subject = isSetup
      ? `${siteName} — Set up your password`
      : `${siteName} — Reset your password`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#111;background:#f9fafb;padding:40px 0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px">${isSetup ? "Set up your password" : "Reset your password"}</h2>
    <p style="color:#6b7280;margin:0 0 24px">Hello ${params.toName},</p>
    <p>${
      isSetup
        ? "An admin has created an account for you. Click the button below to set your password and get started."
        : "We received a request to reset your password. Click the button below to proceed."
    }</p>
    <a href="${params.link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">${
      isSetup ? "Set Password" : "Reset Password"
    }</a>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px">This link expires in 60 minutes and can only be used once.</p>
    <p style="color:#9ca3af;font-size:13px">If you didn't expect this email, you can safely ignore it.</p>
  </div>
</body>
</html>`;

    const text = `${subject}\n\nHello ${params.toName},\n\n${
      isSetup
        ? "An admin has created an account for you. Use the link below to set your password:"
        : "Use the link below to reset your password:"
    }\n\n${params.link}\n\nThis link expires in 60 minutes and can only be used once.`;

    const sent = await deliverEmail({ to: params.to, toName: params.toName, subject, html, text });

    return {
      sent,
      plainLink: params.link,
    };
  }
}
