import { getEmailConfig, EMAIL_PROVIDERS } from '../config/email.config.js';

// Initialize email client based on provider
let emailClient = null;

async function initializeEmailClient() {
  const config = getEmailConfig();
  
  switch (config.provider) {
    case EMAIL_PROVIDERS.RESEND:
      try {
        const { Resend } = await import('resend');
        emailClient = new Resend(config.apiKey);
        console.log('[Email] Initialized Resend client');
      } catch (error) {
        console.error('[Email] Failed to initialize Resend:', error);
        emailClient = null;
      }
      break;
      
    case EMAIL_PROVIDERS.SENDGRID:
      try {
        const sgMailModule = await import('@sendgrid/mail');
        const sgMail = sgMailModule.default;
        sgMail.setApiKey(config.apiKey);
        emailClient = sgMail;
        console.log('[Email] Initialized SendGrid client');
      } catch (error) {
        console.error('[Email] Failed to initialize SendGrid:', error);
        emailClient = null;
      }
      break;
      
    case EMAIL_PROVIDERS.SMTP:
      try {
        const nodemailerModule = await import('nodemailer');
        const nodemailer = nodemailerModule.default;
        emailClient = nodemailer.createTransporter(config);
        console.log('[Email] Initialized SMTP client');
      } catch (error) {
        console.error('[Email] Failed to initialize SMTP:', error);
        emailClient = null;
      }
      break;
      
    default:
      console.log('[Email] Using console output for emails (development mode)');
  }
}

// Initialize on startup
initializeEmailClient();

/**
 * Send email using configured provider
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const config = getEmailConfig();
    
    // Console output for development
    if (config.provider === EMAIL_PROVIDERS.CONSOLE || !emailClient) {
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL (Development Mode)');
      console.log('='.repeat(60));
      console.log('FROM:', `${config.fromName} <${config.fromEmail}>`);
      console.log('TO:', to);
      console.log('SUBJECT:', subject);
      console.log('\n--- HTML CONTENT ---');
      console.log(html);
      console.log('\n--- TEXT CONTENT ---');
      console.log(text);
      console.log('='.repeat(60) + '\n');
      
      return { success: true, message: 'Email logged to console' };
    }
    
    // Send via Resend
    if (config.provider === EMAIL_PROVIDERS.RESEND) {
      const result = await emailClient.emails.send({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      });
      
      console.log('[Email] Sent via Resend:', result.id);
      return { success: true, messageId: result.id };
    }
    
    // Send via SendGrid
    if (config.provider === EMAIL_PROVIDERS.SENDGRID) {
      const msg = {
        to,
        from: {
          email: config.fromEmail,
          name: config.fromName,
        },
        subject,
        text,
        html,
      };
      
      const result = await emailClient.send(msg);
      console.log('[Email] Sent via SendGrid');
      return { success: true, messageId: result[0].headers['x-message-id'] };
    }
    
    // Send via SMTP
    if (config.provider === EMAIL_PROVIDERS.SMTP) {
      const result = await emailClient.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
        text,
      });
      
      console.log('[Email] Sent via SMTP:', result.messageId);
      return { success: true, messageId: result.messageId };
    }
    
    throw new Error(`Unsupported email provider: ${config.provider}`);
  } catch (error) {
    console.error('[Email] Send error:', error);
    
    // Fallback to console output
    const config = getEmailConfig();
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL FAILED - Fallback to Console');
    console.log('ERROR:', error.message);
    console.log('='.repeat(60));
    console.log('FROM:', `${config.fromName} <${config.fromEmail}>`);
    console.log('TO:', to);
    console.log('SUBJECT:', subject);
    console.log('='.repeat(60) + '\n');
    
    // Don't throw in production - just log
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: error.message };
    }
    
    throw error;
  }
}

async function sendPasswordResetEmail(email, resetUrl) {
  const subject = 'Reset Your BrainLift Password';
  
  // Ensure we have a proper URL
  console.log('[Email] Sending password reset email to:', email);
  console.log('[Email] Reset URL:', resetUrl);
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your password for your BrainLift account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            <div class="footer">
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>Best regards,<br>The BrainLift Team</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const text = `
Password Reset Request

Hello,

We received a request to reset your password for your BrainLift account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The BrainLift Team
  `.trim();
  
  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}

async function sendWelcomeEmail(email, username) {
  const subject = 'Welcome to BrainLift! 🎉';
  
  console.log('[Email] Sending welcome email to:', email);
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6366f1; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .feature { margin: 20px 0; padding: 15px; background-color: white; border-radius: 6px; border-left: 4px solid #6366f1; }
          .footer { margin-top: 30px; font-size: 14px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to BrainLift!</h1>
            <p style="font-size: 18px; margin: 0;">Your AI-powered learning companion</p>
          </div>
          <div class="content">
            <p>Hi ${username || 'there'},</p>
            <p>Welcome aboard! We're excited to have you join the BrainLift community. Get ready to supercharge your learning with AI assistance.</p>
            
            <div class="feature">
              <h3 style="margin-top: 0;">📚 Study Smarter</h3>
              <p>Upload your study materials and let our AI help you understand complex topics.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">🎯 Create Quizzes</h3>
              <p>Generate custom quizzes from your notes to test your knowledge.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">🔤 Flashcards</h3>
              <p>Build flashcard decks automatically to memorize key concepts faster.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">💬 AI Chat</h3>
              <p>Ask questions and get instant explanations from your personal AI tutor.</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.WEB_APP_URL || 'https://brain-lift-website.vercel.app'}/dashboard" class="button">Get Started</a>
            </p>
            
            <div class="footer">
              <p>Need help? Just reply to this email or visit our support page.</p>
              <p>Happy learning!<br>The BrainLift Team</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const text = `
Welcome to BrainLift!

Hi ${username || 'there'},

Welcome aboard! We're excited to have you join the BrainLift community. Get ready to supercharge your learning with AI assistance.

Here's what you can do with BrainLift:

📚 Study Smarter - Upload your study materials and let our AI help you understand complex topics.

🎯 Create Quizzes - Generate custom quizzes from your notes to test your knowledge.

🔤 Flashcards - Build flashcard decks automatically to memorize key concepts faster.

💬 AI Chat - Ask questions and get instant explanations from your personal AI tutor.

Get started at: ${process.env.WEB_APP_URL || 'https://brain-lift-website.vercel.app'}/dashboard

Need help? Just reply to this email or visit our support page.

Happy learning!
The BrainLift Team
  `.trim();
  
  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}

async function sendSupportEmail(email, name, subject, message, type = 'feedback') {
  const emailSubject = type === 'feedback' ? `Feedback from ${name}` : `Support Request from ${name}`;
  
  console.log('[Email] Sending support email from:', email);
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${emailSubject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
          .label { font-weight: bold; color: #374151; margin-top: 15px; }
          .value { margin-top: 5px; padding: 10px; background-color: #f9fafb; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${type === 'feedback' ? '💬 New Feedback' : '🆘 Support Request'}</h2>
          </div>
          <div class="content">
            <div class="label">From:</div>
            <div class="value">${name} (${email})</div>
            
            <div class="label">Subject:</div>
            <div class="value">${subject}</div>
            
            <div class="label">Message:</div>
            <div class="value" style="white-space: pre-wrap;">${message}</div>
            
            <div class="label">Type:</div>
            <div class="value">${type}</div>
            
            <div class="label">Sent at:</div>
            <div class="value">${new Date().toLocaleString()}</div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const text = `
${emailSubject}

From: ${name} (${email})
Subject: ${subject}
Type: ${type}

Message:
${message}

Sent at: ${new Date().toLocaleString()}
  `.trim();
  
  // Send to support email
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'support@getbrainlift.app';
  
  return sendEmail({
    to: supportEmail,
    subject: emailSubject,
    html,
    text
  });
}

export {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSupportEmail,
  initializeEmailClient,
};