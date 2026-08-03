const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const {
    buildReceiptVerificationUrl
} = require(
    "./receiptVerificationService"
);

const formatAmount = (amount, currencyCode) => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        return `${amount} ${currencyCode}`;
    }

    return `${numericAmount.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )} ${currencyCode}`;
};

const formatDateTime = value => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "UTC"
    });
};

const formatActor = actor => {
    if (!actor) {
        return "-";
    }

    if (actor.role === "admin") {
        return "Administrator";
    }

    return String(actor.role || "user")
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            character => character.toUpperCase()
        );
};

const drawRule = (document, color = "#D1D5DB") => {
    document
        .strokeColor(color)
        .lineWidth(1)
        .moveTo(50, document.y)
        .lineTo(545, document.y)
        .stroke()
        .moveDown(0.6);
};

const drawLabelValue = (
    document,
    label,
    value
) => {
    const y = document.y;

    document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#4B5563")
        .text(label, 50, y, {
            width: 150
        });

    document
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(
            value === null ||
            value === undefined ||
            value === ""
                ? "-"
                : String(value),
            205,
            y,
            {
                width: 340
            }
        );

    document.moveDown(0.55);
};

const ensureSpace = (document, requiredHeight) => {
    if (
        document.y + requiredHeight >
        document.page.height - 65
    ) {
        document.addPage();
    }
};

/**
 * Generate a professional rent receipt PDF in memory.
 */
const generateReceiptPdf = async receipt => {
    const verificationUrl =
        buildReceiptVerificationUrl(
            receipt.receipt_number
        );

    const qrCodeBuffer = await QRCode.toBuffer(
        verificationUrl,
        {
            type: "png",
            width: 180,
            margin: 1,
            errorCorrectionLevel: "M"
        }
    );

    return new Promise((resolve, reject) => {
        const document = new PDFDocument({
            size: "A4",
            margins: {
                top: 45,
                right: 50,
                bottom: 45,
                left: 50
            },
            info: {
                Title:
                    `Rent Receipt ${receipt.receipt_number}`,
                Subject:
                    "Rent payment receipt",
                Creator:
                    "Real Estate Management System"
            }
        });

        const chunks = [];

        document.on("data", chunk => {
            chunks.push(chunk);
        });

        document.on("end", () => {
            resolve(Buffer.concat(chunks));
        });

        document.on("error", reject);

        const isReversed =
            receipt.receipt_status === "reversed";

        document
            .font("Helvetica-Bold")
            .fontSize(20)
            .fillColor("#111827")
            .text("RENT PAYMENT RECEIPT", {
                align: "center"
            });

        document
            .moveDown(0.3)
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#4B5563")
            .text(receipt.payee.display_name, {
                align: "center"
            });

        document.moveDown(0.8);

        if (isReversed) {
            const bannerTop = document.y;

            document
                .roundedRect(
                    205,
                    bannerTop,
                    185,
                    28,
                    4
                )
                .fill("#FEE2E2");

            document
                .font("Helvetica-Bold")
                .fontSize(13)
                .fillColor("#B91C1C")
                .text("REVERSED", 205, bannerTop + 7, {
                    width: 185,
                    align: "center"
                });

            document.y = bannerTop + 40;
        } else {
            document
                .font("Helvetica-Bold")
                .fontSize(10)
                .fillColor("#047857")
                .text("VALID RECEIPT", {
                    align: "center"
                })
                .moveDown(0.8);
        }

        drawRule(document);

        drawLabelValue(
            document,
            "Receipt number",
            receipt.receipt_number
        );
        drawLabelValue(
            document,
            "Receipt issued at",
            `${formatDateTime(receipt.issued_at)} UTC`
        );
        drawLabelValue(
            document,
            "Payment number",
            receipt.payment.payment_number
        );
        drawLabelValue(
            document,
            "Payment date",
            `${formatDateTime(receipt.payment.paid_at)} UTC`
        );
        drawLabelValue(
            document,
            "Amount received",
            formatAmount(
                receipt.payment.amount,
                receipt.payment.currency_code
            )
        );
        drawLabelValue(
            document,
            "Payment method",
            receipt.payment.payment_method
                .replace(/_/g, " ")
                .toUpperCase()
        );
        drawLabelValue(
            document,
            "Transaction reference",
            receipt.payment.transaction_reference
        );

        document.moveDown(0.4);
        drawRule(document);

        document
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor("#111827")
            .text("PAYMENT PARTIES")
            .moveDown(0.6);

        drawLabelValue(
            document,
            "Payee / owner",
            receipt.payee.display_name
        );
        drawLabelValue(
            document,
            "Payer / tenant",
            receipt.payer.display_name
        );
        drawLabelValue(
            document,
            "Recorded by",
            formatActor(receipt.received_by)
        );

        document.moveDown(0.4);
        drawRule(document);

        document
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor("#111827")
            .text("INVOICE ALLOCATIONS")
            .moveDown(0.7);

        receipt.allocations.forEach(
            (allocation, index) => {
                ensureSpace(document, 125);

                const boxTop = document.y;

                document
                    .roundedRect(
                        50,
                        boxTop,
                        495,
                        105,
                        4
                    )
                    .fillAndStroke(
                        "#F9FAFB",
                        "#E5E7EB"
                    );

                document
                    .font("Helvetica-Bold")
                    .fontSize(10)
                    .fillColor("#111827")
                    .text(
                        `Allocation ${index + 1}`,
                        65,
                        boxTop + 12,
                        { width: 465 }
                    );

                document
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor("#374151")
                    .text(
                        `Invoice: ${allocation.invoice.invoice_number}`,
                        65,
                        boxTop + 31
                    )
                    .text(
                        `Allocated: ${formatAmount(
                            allocation.allocated_amount,
                            allocation.invoice.currency_code
                        )}`,
                        65,
                        boxTop + 47
                    )
                    .text(
                        `Invoice total: ${formatAmount(
                            allocation.invoice.total_amount,
                            allocation.invoice.currency_code
                        )}`,
                        65,
                        boxTop + 63
                    )
                    .text(
                        `Current paid: ${formatAmount(
                            allocation.invoice.paid_amount,
                            allocation.invoice.currency_code
                        )}`,
                        300,
                        boxTop + 47
                    )
                    .text(
                        `Current balance: ${formatAmount(
                            allocation.invoice.balance_amount,
                            allocation.invoice.currency_code
                        )}`,
                        300,
                        boxTop + 63
                    )
                    .text(
                        `Invoice status: ${allocation.invoice.status
                            .replace(/_/g, " ")
                            .toUpperCase()}`,
                        65,
                        boxTop + 79
                    );

                document.y = boxTop + 118;
            }
        );

        if (isReversed && receipt.reversal) {
            ensureSpace(document, 130);
            drawRule(document, "#FCA5A5");

            document
                .font("Helvetica-Bold")
                .fontSize(11)
                .fillColor("#B91C1C")
                .text("REVERSAL AUDIT")
                .moveDown(0.6);

            drawLabelValue(
                document,
                "Reversed at",
                `${formatDateTime(
                    receipt.reversal.reversed_at
                )} UTC`
            );
            drawLabelValue(
                document,
                "Reversed by",
                formatActor(
                    receipt.reversal.reversed_by
                )
            );
            drawLabelValue(
                document,
                "Reason",
                receipt.reversal.reversal_reason
            );
        }

        if (receipt.payment.notes) {
            ensureSpace(document, 70);
            document.moveDown(0.5);
            drawRule(document);
            drawLabelValue(
                document,
                "Payment notes",
                receipt.payment.notes
            );
        }

        ensureSpace(document, 125);
        document.moveDown(0.7);
        drawRule(document);

        const qrTop = document.y;

        document.image(
            qrCodeBuffer,
            50,
            qrTop,
            {
                width: 90,
                height: 90
            }
        );

        document
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor("#111827")
            .text(
                "RECEIPT REFERENCE QR",
                160,
                qrTop + 12,
                { width: 385 }
            );

        document
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#4B5563")
            .text(
                "Scan to open and verify the original receipt PDF.",
                160,
                qrTop + 32,
                { width: 350 }
            )
            .text(
                `Receipt: ${receipt.receipt_number}`,
                160,
                qrTop + 55,
                { width: 350 }
            );

        document.y = qrTop + 100;

        ensureSpace(document, 55);
        document
            .moveDown(1.2)
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#6B7280")
            .text(
                "This receipt was generated electronically by the Real Estate Management System.",
                { align: "center" }
            )
            .text(
                `Verification reference: ${receipt.receipt_number}`,
                { align: "center" }
            );

        document.end();
    });
};

module.exports = {
    generateReceiptPdf
};
