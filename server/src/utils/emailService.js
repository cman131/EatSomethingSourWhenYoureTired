const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // If SMTP is not configured, return null (will fall back to console logging)
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // For development/testing with services like Mailtrap
    ...(process.env.SMTP_REJECT_UNAUTHORIZED === 'false' && {
      tls: {
        rejectUnauthorized: false
      }
    })
  });

  return transporter;
};

// Verify SMTP connection
const verifyConnection = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    return false;
  }
};

// Generate email signature with opt-out information
const getEmailSignature = (frontendUrl) => {
  const profileUrl = `${frontendUrl}/profile`;
  const currentYear = new Date().getFullYear();

  const htmlSignature = `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 10px 0;">
        You can manage your email notification preferences by visiting your 
        <a href="${profileUrl}" style="color: #2563eb; text-decoration: underline;">profile settings</a>.
      </p>
      <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 0;">
        © ${currentYear} Charleston Riichi Mahjong Club. All rights reserved.
      </p>
    </div>
  `;

  const textSignature = `
You can manage your email notification preferences by visiting your profile settings: ${profileUrl}

© ${currentYear} Charleston Riichi Mahjong Club. All rights reserved.
  `;

  return { html: htmlSignature, text: textSignature };
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
  const signature = getEmailSignature(frontendUrl);

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@mahjongclub.com',
    to: email,
    subject: 'Password Reset Request - Charleston Riichi Mahjong Club',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin-top: 0;">Charleston Riichi Mahjong Club</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hello,</p>
            
            <p>We received a request to reset your password for your Charleston Riichi Mahjong Club account. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${resetUrl}</p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <strong>Important:</strong> This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          
          ${signature.html}
        </body>
      </html>
    `,
    text: `
      Password Reset Request - Charleston Riichi Mahjong Club
      
      Hello,
      
      We received a request to reset your password for your Charleston Riichi Mahjong Club account.
      
      Please click the following link to reset your password:
      ${resetUrl}
      
      This link will expire in 10 minutes.
      
      If you didn't request a password reset, please ignore this email.
      
      ${signature.text}
    `
  };

  const transporter = createTransporter();
  
  if (!transporter) {
    // Fallback to console logging if SMTP is not configured
    console.log('='.repeat(80));
    console.log('SMTP not configured. Email would have been sent:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Reset URL:', resetUrl);
    console.log('='.repeat(80));
    return { success: true, method: 'console' };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId, method: 'smtp' };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Fallback to console logging on error
    console.log('='.repeat(80));
    console.log('Email sending failed. Fallback - Email details:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Reset URL:', resetUrl);
    console.log('='.repeat(80));
    throw error;
  }
};

// Send password reset confirmation email
const sendPasswordResetConfirmationEmail = async (email, displayName) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const loginUrl = `${frontendUrl}/login`;
  const signature = getEmailSignature(frontendUrl);

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@mahjongclub.com',
    to: email,
    subject: 'Password Successfully Reset - Charleston Riichi Mahjong Club',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin-top: 0;">Charleston Riichi Mahjong Club</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin-top: 0;">Password Successfully Reset</h2>
            
            <p>Hello${displayName ? ` ${displayName}` : ''},</p>
            
            <p>This is a confirmation that your password has been successfully reset for your Charleston Riichi Mahjong Club account.</p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">Security Notice</p>
              <p style="margin: 10px 0 0 0; color: #78350f; font-size: 14px;">
                If you did not reset your password, please contact us immediately and consider changing your password again.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Sign In to Your Account
              </a>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <strong>Tip:</strong> For your security, we recommend using a strong, unique password that you don't use for other accounts.
            </p>
          </div>
          
          ${signature.html}
        </body>
      </html>
    `,
    text: `
      Password Successfully Reset - Charleston Riichi Mahjong Club
      
      Hello${displayName ? ` ${displayName}` : ''},
      
      This is a confirmation that your password has been successfully reset for your Charleston Riichi Mahjong Club account.
      
      Security Notice:
      If you did not reset your password, please contact us immediately and consider changing your password again.
      
      Sign in to your account: ${loginUrl}
      
      Tip: For your security, we recommend using a strong, unique password that you don't use for other accounts.
      
      ${signature.text}
    `
  };

  const transporter = createTransporter();
  
  if (!transporter) {
    // Fallback to console logging if SMTP is not configured
    console.log('='.repeat(80));
    console.log('SMTP not configured. Email would have been sent:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Login URL:', loginUrl);
    console.log('='.repeat(80));
    return { success: true, method: 'console' };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId, method: 'smtp' };
  } catch (error) {
    console.error('Error sending password reset confirmation email:', error);
    // Fallback to console logging on error
    console.log('='.repeat(80));
    console.log('Email sending failed. Fallback - Email details:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Login URL:', loginUrl);
    console.log('='.repeat(80));
    throw error;
  }
};

// Send new game notification email
const sendNewGameNotificationEmail = async (email, displayName, gameId, submittedByDisplayName) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const gameUrl = `${frontendUrl}/games/${gameId}`;
  const signature = getEmailSignature(frontendUrl);

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@mahjongclub.com',
    to: email,
    subject: 'New Game Submitted - Awaiting Verification - Charleston Riichi Mahjong Club',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Game Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin-top: 0;">Charleston Riichi Mahjong Club</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin-top: 0;">New Game Submitted</h2>
            
            <p>Hello${displayName ? ` ${displayName}` : ''},</p>
            
            <p>A new game that you participated in has been submitted by <strong>${submittedByDisplayName}</strong> and is awaiting verification.</p>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">Action Required</p>
              <p style="margin: 10px 0 0 0; color: #78350f; font-size: 14px;">
                Please review and verify the game details to confirm the scores are correct.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${gameUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Game Details
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${gameUrl}</p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <strong>Note:</strong> The game will remain pending until it is verified by a player who was not the submitter.
            </p>
          </div>
          
          ${signature.html}
        </body>
      </html>
    `,
    text: `
      New Game Submitted - Awaiting Verification - Charleston Riichi Mahjong Club
      
      Hello${displayName ? ` ${displayName}` : ''},
      
      A new game that you participated in has been submitted by ${submittedByDisplayName} and is awaiting verification.
      
      Action Required:
      Please review and verify the game details to confirm the scores are correct.
      
      View game details: ${gameUrl}
      
      Note: The game will remain pending until it is verified by a player who was not the submitter.
      
      ${signature.text}
    `
  };

  const transporter = createTransporter();
  
  if (!transporter) {
    // Fallback to console logging if SMTP is not configured
    console.log('='.repeat(80));
    console.log('SMTP not configured. Email would have been sent:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Game URL:', gameUrl);
    console.log('='.repeat(80));
    return { success: true, method: 'console' };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('New game notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId, method: 'smtp' };
  } catch (error) {
    console.error('Error sending new game notification email:', error);
    // Fallback to console logging on error
    console.log('='.repeat(80));
    console.log('Email sending failed. Fallback - Email details:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Game URL:', gameUrl);
    console.log('='.repeat(80));
    throw error;
  }
};

// Send new comment notification email
const sendNewCommentNotificationEmail = async (email, displayName, gameId, commenterDisplayName, commentText) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const gameUrl = `${frontendUrl}/games/${gameId}`;
  const signature = getEmailSignature(frontendUrl);

  // Truncate comment if too long for email
  const truncatedComment = commentText.length > 200 
    ? commentText.substring(0, 200) + '...' 
    : commentText;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@mahjongclub.com',
    to: email,
    subject: 'New Comment on Game - Charleston Riichi Mahjong Club',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Comment Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin-top: 0;">Charleston Riichi Mahjong Club</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin-top: 0;">New Comment on Game</h2>
            
            <p>Hello${displayName ? ` ${displayName}` : ''},</p>
            
            <p><strong>${commenterDisplayName}</strong> left a new comment on a game you participated in or commented on:</p>
            
            <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #111827; font-style: italic; white-space: pre-wrap;">"${truncatedComment}"</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${gameUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Game & Comment
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${gameUrl}</p>
          </div>
          
          ${signature.html}
        </body>
      </html>
    `,
    text: `
      New Comment on Game - Charleston Riichi Mahjong Club
      
      Hello${displayName ? ` ${displayName}` : ''},
      
      ${commenterDisplayName} left a new comment on a game you participated in or commented on:
      
      "${truncatedComment}"
      
      View game and comment: ${gameUrl}
      
      ${signature.text}
    `
  };

  const transporter = createTransporter();
  
  if (!transporter) {
    // Fallback to console logging if SMTP is not configured
    console.log('='.repeat(80));
    console.log('SMTP not configured. Email would have been sent:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Game URL:', gameUrl);
    console.log('Commenter:', commenterDisplayName);
    console.log('='.repeat(80));
    return { success: true, method: 'console' };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('New comment notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId, method: 'smtp' };
  } catch (error) {
    console.error('Error sending new comment notification email:', error);
    // Fallback to console logging on error
    console.log('='.repeat(80));
    console.log('Email sending failed. Fallback - Email details:');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Game URL:', gameUrl);
    console.log('Commenter:', commenterDisplayName);
    console.log('='.repeat(80));
    throw error;
  }
};

module.exports = {
  createTransporter,
  verifyConnection,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendNewGameNotificationEmail,
  sendNewCommentNotificationEmail
};

