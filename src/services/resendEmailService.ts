import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Send verification email using Resend
export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  try {
    console.log(`📧 Attempting to send verification email to ${email}`);
    
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }

    const { data, error } = await resend.emails.send({
      from: 'EchoRoom <noreply@echoroom.app>',
      to: [email],
      subject: 'Verify Your EchoRoom Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">EchoRoom</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your verification code</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Verification Code</h2>
            <div style="background: white; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This code will expire in 10 minutes
            </p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px;">
            <p>If you didn't request this code, please ignore this email.</p>
            <p>Welcome to EchoRoom! 🎉</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`📧 Email ID: ${data?.id}`);
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

// Send welcome email using Resend
export const sendWelcomeEmail = async (email: string, username: string): Promise<void> => {
  try {
    console.log(`📧 Sending welcome email to ${email}`);
    
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not set, skipping welcome email');
      return;
    }

    const { data, error } = await resend.emails.send({
      from: 'EchoRoom <noreply@echoroom.app>',
      to: [email],
      subject: 'Welcome to EchoRoom! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">Welcome to EchoRoom!</h1>
            <p style="color: #6b7280; margin: 5px 0;">Hi ${username}, your account is ready</p>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">What's Next?</h2>
            <ul style="color: #4b5563; line-height: 1.6;">
              <li>Complete your profile to get better matches</li>
              <li>Join chat rooms that interest you</li>
              <li>Start conversations with like-minded people</li>
              <li>Explore events and community features</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}/community" 
               style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Get Started
            </a>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Thanks for joining EchoRoom!</p>
            <p>Happy chatting! 💬</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Welcome email error:', error);
    } else {
      console.log(`✅ Welcome email sent successfully to ${email}`);
    }
  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error);
    // Don't throw error for welcome email
  }
};
