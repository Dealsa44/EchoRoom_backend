// Simple email service that logs verification codes for testing
// This allows us to test the registration flow without email issues

export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  try {
    console.log(`📧 VERIFICATION CODE FOR ${email}: ${code}`);
    console.log(`📧 This code should be entered in the frontend`);
    console.log(`📧 Code expires in 10 minutes`);
    
    // For now, we'll just log the code instead of sending email
    // This allows testing the complete registration flow
    
    console.log(`✅ Verification code logged successfully for ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to log verification code:', error);
    throw new Error(`Failed to log verification code: ${error.message}`);
  }
};

export const sendWelcomeEmail = async (email: string, username: string): Promise<void> => {
  try {
    console.log(`📧 WELCOME EMAIL FOR ${email}: Welcome ${username} to EchoRoom!`);
    console.log(`✅ Welcome message logged successfully for ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to log welcome message:', error);
    // Don't throw error for welcome email
  }
};
