export function getVerificationEmailHtml(verificationCode: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email – Driftzo</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #374151;
      background-color: #f3f4f6;
    }
    .wrapper {
      padding: 32px 16px;
      max-width: 480px;
      margin: 0 auto;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 40px 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .brand {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 600;
      color: #4f46e5;
      letter-spacing: -0.02em;
    }
    .brand-tagline {
      font-size: 13px;
      color: #9ca3af;
      margin-top: 4px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 20px 0;
      line-height: 1.35;
    }
    .intro {
      color: #4b5563;
      margin: 0 0 24px 0;
    }
    .code-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }
    .code-label {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .code {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: 6px;
      color: #111827;
      font-variant-numeric: tabular-nums;
    }
    .steps {
      background: #f8fafc;
      border-radius: 8px;
      padding: 18px 20px;
      margin: 24px 0;
      border-left: 3px solid #818cf8;
    }
    .steps-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 10px 0;
    }
    .steps ul {
      margin: 0;
      padding-left: 18px;
      color: #4b5563;
      font-size: 14px;
    }
    .steps li { margin-bottom: 4px; }
    .security {
      background: #fffbeb;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 24px 0;
      border-left: 3px solid #f59e0b;
    }
    .security p {
      margin: 0;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }
    .benefits {
      margin: 24px 0;
      color: #4b5563;
      font-size: 14px;
    }
    .benefits ul {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }
    .benefits li { margin-bottom: 6px; }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="brand">
        <div class="brand-name">Driftzo</div>
        <div class="brand-tagline">Drift into conversations. Connect for real.</div>
      </div>

      <h1>Verify your email</h1>
      <p class="intro">Thanks for signing up. Enter the code below on Driftzo to finish your registration and start connecting.</p>

      <div class="code-box">
        <p class="code-label">Your verification code</p>
        <div class="code">${verificationCode}</div>
      </div>

      <div class="steps">
        <p class="steps-title">What to do next</p>
        <ul>
          <li>Paste or type this code in the verification field on Driftzo</li>
          <li>This code expires in 10 minutes</li>
          <li>If you didn't request it, you can ignore this email</li>
        </ul>
      </div>

      <div class="security">
        <p><strong>Security:</strong> Don't share this code with anyone. Driftzo will never ask for it by email or phone.</p>
      </div>

      <p class="benefits">After verifying you can create your profile, match with others, and start chatting.</p>

      <div class="footer">
        <p>Sent by Driftzo. Questions? Contact support.</p>
        <p>&copy; ${new Date().getFullYear()} Driftzo.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
