import nodemailer from 'nodemailer';

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
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendVerificationEmail(to: string, verificationCode: string): Promise<boolean> {
    try {
      console.log('🔍 [DEBUG] Starting email send process...');
      console.log('🔍 [DEBUG] Email config check:', {
        EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'MISSING',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'MISSING',
        EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
        EMAIL_PORT: process.env.EMAIL_PORT || '587'
      });
      
      console.log('🔍 [DEBUG] Attempting to send to:', to);
      console.log('🔍 [DEBUG] Verification code:', verificationCode);
      
      const subject = 'EchoRoom - Email Verification Code';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #6366f1;
              margin-bottom: 10px;
            }
            .code-container {
              background: #f8fafc;
              border: 2px dashed #6366f1;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            }
            .verification-code {
              font-size: 32px;
              font-weight: bold;
              color: #6366f1;
              letter-spacing: 4px;
              font-family: 'Courier New', monospace;
            }
            .instructions {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              background: #fef2f2;
              border-left: 4px solid #ef4444;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              color: #dc2626;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">EchoRoom</div>
              <h1>Email Verification Required</h1>
            </div>
            
            <p>Hello!</p>
            <p>Thank you for registering with EchoRoom. To complete your registration and start connecting with amazing people, please verify your email address.</p>
            
            <div class="code-container">
              <p><strong>Your verification code is:</strong></p>
              <div class="verification-code">${verificationCode}</div>
            </div>
            
            <div class="instructions">
              <p><strong>Instructions:</strong></p>
              <ul>
                <li>Enter this code in the verification field on EchoRoom</li>
                <li>The code will expire in 10 minutes</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <div class="warning">
              <p><strong>Security Note:</strong> Never share this code with anyone. EchoRoom will never ask for your verification code via email or phone.</p>
            </div>
            
            <p>Once verified, you'll be able to:</p>
            <ul>
              <li>Create your profile and start chatting</li>
              <li>Connect with people who share your interests</li>
              <li>Join exciting conversations and make new friends</li>
            </ul>
            
            <div class="footer">
              <p>This email was sent from EchoRoom. If you have any questions, please contact our support team.</p>
              <p>&copy; 2024 EchoRoom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions: EmailOptions = {
        to,
        subject,
        html,
      };

      console.log('🔍 [DEBUG] Mail options prepared:', { to, subject });
      console.log('🔍 [DEBUG] Attempting to send mail...');

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully:', info.messageId);
      console.log('🔍 [DEBUG] Email response:', info);
      return true;
    } catch (error) {
      console.error('❌ [DEBUG] Email send failed with error:', error);
      console.error('❌ [DEBUG] Error type:', typeof error);
      console.error('❌ [DEBUG] Error message:', error.message);
      console.error('❌ [DEBUG] Error code:', error.code);
      console.error('❌ [DEBUG] Error response:', error.response);
      console.error('❌ [DEBUG] Full error object:', JSON.stringify(error, null, 2));
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
