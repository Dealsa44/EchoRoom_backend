import { Resend } from 'resend';
import { getVerificationEmailHtml } from '../utils/verificationEmailHtml';

/**
 * Sender logo in Gmail/Outlook is not set by the email content or Resend API.
 * To show your logo next to "Driftzo" in the inbox, set up BIMI:
 * 1. DMARC policy must be p=quarantine or p=reject (see resend.com/docs/dashboard/domains/dmarc)
 * 2. Add a BIMI DNS record (see resend.com/docs/dashboard/domains/bimi)
 * 3. Logo: SVG, square, and optionally a Verified Mark Certificate for the checkmark
 */
class ResendEmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when using Resend');
    }
    this.resend = new Resend(apiKey);
    // Use verified domain (e.g. noreply@driftzo.com after verifying at resend.com/domains)
    this.from = process.env.RESEND_FROM || 'Driftzo <noreply@driftzo.com>';
  }

  async sendVerificationEmail(to: string, verificationCode: string): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject: 'Driftzo - Email Verification Code',
        html: getVerificationEmailHtml(verificationCode),
      });

      if (error) {
        console.error('❌ Resend failed to send verification email:', error);
        return false;
      }

      console.log('✅ Verification email sent via Resend:', data?.id);
      return true;
    } catch (err: any) {
      console.error('❌ Failed to send verification email (Resend):', err);
      return false;
    }
  }
}

export default ResendEmailService;
