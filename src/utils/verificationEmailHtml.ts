export function getVerificationEmailHtml(verificationCode: string): string {
  // Driftzo app colors (from index.css design system)
  const primary = '#7c3aed';      // hsl(260 70% 55%)
  const primaryLight = '#8b5cf6'; // hsl(260 80% 65%)
  const secondary = '#2563eb';    // hsl(210 85% 58%)
  const secondaryLight = '#60a5fa';
  const accent = '#ea580c';      // hsl(15 85% 62%)
  const accentLight = '#fb923c';
  const tertiary = '#16a34a';     // green
  const bgLavender = '#f5f3ff';  // hsl(250 30% 96%)
  const cardSoft = '#ede9fe';    // hsl(250 40% 94%)
  const textDark = '#1e1b4b';
  const textMuted = '#4b5563';
  const white = '#ffffff';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email – Driftzo</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 17px;
      line-height: 1.65;
      color: ${textMuted};
      background-color: ${bgLavender};
    }
    .wrapper {
      padding: 40px 20px;
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
    }
    @media (min-width: 600px) {
      .wrapper {
        max-width: 600px;
        padding: 48px 24px;
      }
      .card-inner {
        padding: 48px 44px 44px;
      }
      .brand-name { font-size: 32px; }
      .brand-underline { width: 80px; }
      h1 { font-size: 24px; }
      .intro { font-size: 17px; }
      .code { font-size: 40px; letter-spacing: 10px; }
      .code-box { padding: 32px 28px; }
      .steps, .security { padding: 24px 28px; }
      .footer { padding: 28px 44px 36px; font-size: 14px; }
    }
    @media (min-width: 900px) {
      .wrapper {
        max-width: 640px;
        padding: 56px 32px;
      }
      .card-inner {
        padding: 52px 48px 48px;
      }
      .brand-name { font-size: 34px; }
      h1 { font-size: 26px; }
      .code { font-size: 42px; letter-spacing: 12px; }
    }
    .card {
      background: ${white};
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(124, 58, 237, 0.12), 0 2px 8px rgba(0,0,0,0.06);
    }
    .gradient-bar {
      height: 6px;
      width: 100%;
      background: linear-gradient(90deg, ${primary} 0%, ${secondary} 50%, ${accent} 100%);
      background-color: ${primary};
    }
    .card-inner {
      padding: 40px 36px 36px;
    }
    .brand {
      text-align: center;
      margin-bottom: 32px;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 700;
      color: ${primary};
      letter-spacing: -0.03em;
      margin: 0;
    }
    .brand-underline {
      height: 4px;
      width: 64px;
      margin: 10px auto 0;
      border-radius: 2px;
      background: linear-gradient(90deg, ${primary}, ${secondary});
      background-color: ${primary};
    }
    .brand-tagline {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 12px;
      letter-spacing: 0.02em;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: ${textDark};
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    .intro {
      color: ${textMuted};
      margin: 0 0 28px 0;
      font-size: 16px;
    }
    .code-wrapper {
      background: linear-gradient(135deg, ${cardSoft} 0%, rgba(255,255,255,0.95) 100%);
      background-color: ${cardSoft};
      border-radius: 16px;
      padding: 4px;
      margin: 28px 0;
      border: 1px solid rgba(124, 58, 237, 0.2);
      box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.08) inset;
    }
    .code-box {
      background: ${white};
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
    }
    .code-label {
      font-size: 12px;
      font-weight: 600;
      color: ${primary};
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .code {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: ${primary};
      font-variant-numeric: tabular-nums;
      margin: 0;
    }
    .steps {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(37, 99, 235, 0.04) 100%);
      background-color: #faf5ff;
      border-radius: 14px;
      padding: 22px 24px;
      margin: 28px 0;
      border-left: 4px solid ${primary};
      box-shadow: 0 1px 3px rgba(124, 58, 237, 0.06);
    }
    .steps-title {
      font-size: 15px;
      font-weight: 700;
      color: ${textDark};
      margin: 0 0 12px 0;
    }
    .steps ul {
      margin: 0;
      padding-left: 20px;
      color: ${textMuted};
      font-size: 15px;
      line-height: 1.7;
    }
    .steps li { margin-bottom: 6px; }
    .security {
      background: linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, rgba(251, 146, 60, 0.05) 100%);
      background-color: #fff7ed;
      border-radius: 14px;
      padding: 18px 22px;
      margin: 28px 0;
      border-left: 4px solid ${accent};
    }
    .security p {
      margin: 0;
      font-size: 14px;
      color: #9a3412;
      line-height: 1.6;
    }
    .benefits {
      margin: 24px 0 0;
      padding: 20px 0 0;
      border-top: 1px solid #e5e7eb;
      color: ${textMuted};
      font-size: 15px;
    }
    .benefits p { margin: 0 0 8px 0; }
    .benefits ul {
      margin: 0;
      padding-left: 20px;
    }
    .benefits li { margin-bottom: 6px; }
    .footer-bar {
      height: 4px;
      width: 100%;
      margin-top: 32px;
      border-radius: 0 0 20px 20px;
      background: linear-gradient(90deg, ${primary}, ${secondary});
      background-color: ${primary};
    }
    .footer {
      padding: 24px 36px 32px;
      text-align: center;
      font-size: 13px;
      color: #9ca3af;
    }
    .footer p { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="gradient-bar"></div>
      <div class="card-inner">
        <div class="brand">
          <h2 class="brand-name">Driftzo</h2>
          <div class="brand-underline"></div>
          <p class="brand-tagline">Drift into conversations. Connect for real.</p>
        </div>

        <h1>Verify your email</h1>
        <p class="intro">You're almost in. Enter the code below on Driftzo to finish signing up and start connecting with people who get you.</p>

        <div class="code-wrapper">
          <div class="code-box">
            <p class="code-label">Your verification code</p>
            <p class="code">${verificationCode}</p>
          </div>
        </div>

        <div class="steps">
          <p class="steps-title">What to do next</p>
          <ul>
            <li>Enter this code in the verification field on Driftzo</li>
            <li>This code expires in 10 minutes</li>
            <li>If you didn't request it, you can ignore this email</li>
          </ul>
        </div>

        <div class="security">
          <p><strong>Security:</strong> Never share this code with anyone. Driftzo will never ask you to send or reply with this code.</p>
        </div>

        <div class="benefits">
          <p><strong>After verifying you can:</strong></p>
          <ul>
            <li>Complete your profile and add photos</li>
            <li>Match with people who share your vibe</li>
            <li>Start real conversations and make friends</li>
          </ul>
        </div>
      </div>
      <div class="footer-bar"></div>
      <div class="footer">
        <p>Sent with care by Driftzo</p>
        <p>&copy; ${new Date().getFullYear()} Driftzo. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
