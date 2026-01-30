import nodemailer from 'nodemailer';
import { getVerificationEmailHtml } from '../utils/verificationEmailHtml';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class GmailEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      // Railway-optimized settings
      connectionTimeout: 30000,  // 30 seconds
      greetingTimeout: 10000,    // 10 seconds
      socketTimeout: 30000,      // 30 seconds
      pool: true,                // Use connection pooling
      maxConnections: 1,         // Limit connections
      maxMessages: 1,            // Limit messages per connection
    });
  }

  async sendVerificationEmail(to: string, verificationCode: string): Promise<boolean> {
    try {
      const subject = 'EchoRoom - Email Verification Code';
      const html = getVerificationEmailHtml(verificationCode);

      const mailOptions: EmailOptions = {
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to send verification email:', error);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail(options);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Gmail SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ Gmail SMTP connection failed:', error);
      return false;
    }
  }
}

export default GmailEmailService;
