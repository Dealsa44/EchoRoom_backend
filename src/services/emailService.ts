import nodemailer from 'nodemailer';

// Create transporter for Gmail
const createTransporter = () => {
  // Check if required environment variables are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email configuration missing: EMAIL_USER and EMAIL_PASS must be set');
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Railway-optimized settings
    connectionTimeout: 5000,  // 5 seconds
    greetingTimeout: 3000,    // 3 seconds
    socketTimeout: 5000,      // 5 seconds
    pool: true,               // Use connection pooling
    maxConnections: 1,        // Limit connections
    maxMessages: 1,           // Limit messages per connection
  });
};

// Send verification email
export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  try {
    console.log(`📧 Attempting to send verification email to ${email}`);
    
    const transporter = createTransporter();
    console.log(`📧 Transporter created successfully`);

    const mailOptions = {
      from: `"EchoRoom" <${process.env.EMAIL_USER}>`,
      to: email,
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
      `
    };

    console.log(`📧 Sending email with options:`, { from: mailOptions.from, to: mailOptions.to });
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully to ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command
    });
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Gmail authentication failed. Please check your App Password.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('Failed to connect to Gmail SMTP server.');
    } else if (error.responseCode === 535) {
      throw new Error('Gmail authentication failed. Invalid App Password.');
    } else {
      throw new Error(`Failed to send verification email: ${error.message}`);
    }
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, username: string): Promise<void> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"EchoRoom" <${process.env.EMAIL_USER}>`,
      to: email,
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
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    // Don't throw error for welcome email
  }
};
