const axios = require("axios");

const sendEmail = async ({ to, subject, html }) => {

    const payload = {
        sender: {
            name: "Amud API",
            email: process.env.SENDER_EMAIL
        },
        to: [
            {
                email: to
            }
        ],
        subject,
        htmlContent: html
    };

    try {

        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            payload,
            {
                headers: {
                    "accept": "application/json",
                    "content-type": "application/json",
                    "api-key": process.env.BREVO_API_KEY
                }
            }
        );

        console.log("BREVO RESPONSE:", response.data);

        return response.data;

    } catch (error) {

        console.error("BREVO ERROR:");

        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }

        throw error;

    }

};

module.exports = {
    sendEmail
};