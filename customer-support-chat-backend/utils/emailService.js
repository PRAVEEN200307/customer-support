const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false }
    });
  }

  // Send verification email
  async sendVerificationEmail(email, token) {
    const verificationLink = `${process.env.APP_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"Auth System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Our Service!</h2>
          <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
          <p>
            <a href="${verificationLink}" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Verify Email Address
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><code>${verificationLink}</code></p>
          <p>This link will expire in 24 hours.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, token) {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"Auth System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the link below to reset it:</p>
          <p>
            <a href="${resetLink}" 
               style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><code>${resetLink}</code></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            For security reasons, this link can only be used once.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  // Send welcome email
  async sendWelcomeEmail(email, name = 'User') {
    const mailOptions = {
      from: `"Auth System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Our Service!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${name}!</h2>
          <p>Your account has been successfully verified and is now active.</p>
          <p>You can now log in and start using our services.</p>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Thank you for choosing our service!
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }
}

module.exports = new EmailService();