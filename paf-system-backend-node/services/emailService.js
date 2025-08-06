// mypafreact/paf-system-backend-node/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config(); // To load .env variables if this file is run directly or early

// Create a transporter object using SMTP transport
// It's good practice to create the transporter once and reuse it.
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10), // Ensure port is an integer
  secure: process.env.MAIL_SECURE === 'true', // true for 465, false for other ports (like 587 for STARTTLS)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  // Optional: for development with self-signed certificates or local SMTP servers
  // tls: {
  //   rejectUnauthorized: false // DANGEROUS for production
  // }
});

// Verify connection configuration on server start (optional but good)
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email Transporter Verification Error:', error);
  } else {
    console.log('Email Transporter is ready to send emails');
  }
});

/**
 * Sends an email.
 * @param {string} to Recipient's email address.
 * @param {string} subject Email subject.
 * @param {string} text Plain text body of the email.
 * @param {string} html HTML body of the email (optional).
 * @returns {Promise<object>} Promise resolving with Nodemailer's sendMail info object or rejecting with an error.
 */
const sendEmail = async (to, subject, text, html) => {

   console.log(`Attempting to send email`);

  const mailOptions = {
    from: process.env.MAIL_FROM_ADDRESS || `"PAF System" <${process.env.MAIL_USER}>`, // Sender address
    to: to, // List of receivers
    subject: subject, // Subject line
    text: text, // Plain text body
    html: html, // HTML body (optional)
  };

  try {
    console.log(`Attempting to send email to: ${to}, Subject: ${subject}`);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // Only for ethereal.email
    return info;
  } catch (error) {
    console.error(`Error sending email to ${to} with subject "${subject}":`, error);
    throw error; // Re-throw to be handled by the calling function
  }
};

module.exports = {
  sendEmail,
};