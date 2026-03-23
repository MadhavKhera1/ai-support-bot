const createTransporter = () => {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_SECURE
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    let nodemailer;
    try {
        nodemailer = require("nodemailer");
    } catch (error) {
        throw new Error("Nodemailer is not installed. Run npm install in backend.");
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === "true",
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
};

const sendPasswordResetEmail = async ({ to, resetLink, resetToken }) => {
    const transporter = createTransporter();

    if (!transporter) {
        if (process.env.NODE_ENV !== "production") {
            console.log(`Password reset for ${to}: ${resetLink}`);
            return { delivered: false, fallback: true };
        }

        throw new Error("SMTP is not configured");
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
        from,
        to,
        subject: "Reset your Actio AI password",
        text: `Use this reset link to change your password: ${resetLink}\n\nIf the link does not open, use this reset token: ${resetToken}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Reset your Actio AI password</h2>
              <p>Click the link below to set a new password:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              <p>If the link does not open, use this reset token:</p>
              <p><strong>${resetToken}</strong></p>
              <p>This link expires in 15 minutes.</p>
            </div>
        `
    });

    return { delivered: true, fallback: false };
};

module.exports = {
    sendPasswordResetEmail
};
