import { Resend } from 'resend';
import { getVerificationEmailHtml } from '../utils/verificationEmailHtml';

class ResendEmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when using Resend');
    }
    this.resend = new Resend(apiKey);
    // Use verified domain or Resend's onboarding address (free tier)
    this.from = process.env.RESEND_FROM || 'EchoRoom <onboarding@resend.dev>';
  }

  async sendVerificationEmail(to: string, verificationCode: string): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [to],
        subject: 'EchoRoom - Email Verification Code',
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
