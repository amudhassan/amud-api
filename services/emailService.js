const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    logger: true,
    debug: true
});

transporter.verify(function (error, success) {
    if (error) {
        console.log("SMTP VERIFY ERROR:");
        console.log(error);
    } else {
        console.log("SMTP SERVER READY");
    }
});

const sendEmail = async ({ to, subject, html }) => {

    await transporter.sendMail({
        from: `"Amud API" <${process.env.SENDER_EMAIL}>`,
        to,
        subject,
        html
    });

};

module.exports = {
    sendEmail
};