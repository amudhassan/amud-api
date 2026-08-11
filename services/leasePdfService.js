const PDFDocument = require("pdfkit");
const pool = require("../config/db");

const {
    getSingleLease
} = require("./leaseService");

const PDF_LANGUAGES = {
    en: {
        locale: "en-GB",
        amountLocale: "en-US",
        leaseAgreement: "LEASE AGREEMENT",
        leaseNumber: "Lease number",
        leaseStatus: "Lease status",
        agreementPeriod: "Agreement period",
        signedAt: "Signed at",
        parties: "Parties",
        ownerLandlord: "Owner / Landlord",
        ownerType: "Owner type",
        tenant: "Tenant",
        tenantType: "Tenant type",
        premises: "Premises",
        property: "Property",
        propertyCode: "Property code",
        unit: "Unit",
        unitCode: "Unit code",
        unitType: "Unit type",
        financialTerms: "Financial Terms",
        rentAmount: "Rent amount",
        billingFrequency: "Billing frequency",
        paymentDueDay: "Payment due day",
        gracePeriod: "Grace period",
        securityDeposit: "Security deposit",
        lateFee: "Late fee",
        termsConditions: "Terms & Conditions",
        noClauses:
            "No active contractual clauses are attached to this lease.",
        signatures: "Signatures",
        signatureNotice:
            "By signing below, the parties acknowledge the lease details and contractual terms contained in this agreement.",
        date: "Date",
        generatedNotice:
            "This lease agreement was generated electronically by the Real Estate Management System from the current authorized lease record.",
        draftNotBinding:
            "DRAFT - NOT YET BINDING",
        mandatory: "Mandatory",
        additional: "Additional",
        clause: "Clause",
        none: "None",
        day: "Day",
        days: "day(s)",
        to: "to",
        lease: "Lease",
        page: "Page"
    },

    sw: {
        locale: "sw-TZ",
        amountLocale: "sw-TZ",
        leaseAgreement: "MKATABA WA PANGO",
        leaseNumber: "Namba ya mkataba",
        leaseStatus: "Hali ya mkataba",
        agreementPeriod: "Muda wa mkataba",
        signedAt: "Tarehe ya kusainiwa",
        parties: "Wahusika wa Mkataba",
        ownerLandlord: "Mmiliki / Mwenye Nyumba",
        ownerType: "Aina ya mmiliki",
        tenant: "Mpangaji",
        tenantType: "Aina ya mpangaji",
        premises: "Eneo / Nyumba Inayopangishwa",
        property: "Mali / Jengo",
        propertyCode: "Namba ya mali",
        unit: "Nyumba / Sehemu",
        unitCode: "Namba ya nyumba / sehemu",
        unitType: "Aina ya nyumba / sehemu",
        financialTerms: "Masharti ya Kifedha",
        rentAmount: "Kiasi cha kodi",
        billingFrequency: "Mzunguko wa malipo",
        paymentDueDay: "Siku ya mwisho ya malipo",
        gracePeriod: "Muda wa nyongeza",
        securityDeposit: "Amana ya usalama",
        lateFee: "Ada ya kuchelewa",
        termsConditions: "Sheria na Masharti",
        noClauses:
            "Hakuna masharti ya mkataba yaliyo hai yaliyowekwa kwenye mkataba huu.",
        signatures: "Saini za Wahusika",
        signatureNotice:
            "Kwa kusaini hapa chini, wahusika wanathibitisha kuwa wamekubali maelezo ya mkataba na masharti yaliyomo katika hati hii.",
        date: "Tarehe",
        generatedNotice:
            "Mkataba huu wa pango umetengenezwa kielektroniki na Mfumo wa Usimamizi wa Mali kwa kutumia taarifa halali za mkataba zilizopo kwenye mfumo.",
        draftNotBinding:
            "RASIMU - BADO HAUJAANZA KUWA WA LAZIMA",
        mandatory: "Lazima",
        additional: "Ziada",
        clause: "Kifungu",
        none: "Hakuna",
        day: "Siku",
        days: "siku",
        to: "hadi",
        lease: "Mkataba",
        page: "Ukurasa"
    }
};

const SWAHILI_ENUM_LABELS = {
    draft: "Rasimu",
    scheduled: "Imepangwa",
    active: "Hai",
    expired: "Imeisha",
    terminated: "Imesitishwa",
    cancelled: "Imeghairiwa",

    individual: "Mtu Binafsi",
    company: "Kampuni",
    organization: "Shirika",

    monthly: "Kila Mwezi",
    weekly: "Kila Wiki",
    biweekly: "Kila Wiki Mbili",
    quarterly: "Kila Robo Mwaka",
    yearly: "Kila Mwaka",
    annual: "Kila Mwaka",

    apartment: "Fleti",
    house: "Nyumba",
    room: "Chumba",
    shop: "Duka",
    office: "Ofisi",
    warehouse: "Ghala",

    pets: "Wanyama",
    subletting: "Upangishaji Mdogo",
    utilities: "Huduma za Msingi",
    maintenance: "Matengenezo",
    occupancy: "Ukaaji",
    property_use: "Matumizi ya Mali",
    alterations: "Marekebisho",
    notice: "Notisi",
    termination: "Kusitisha Mkataba",
    deposit: "Amana",
    access_inspection: "Ukaguzi na Ufikiaji",
    smoking: "Uvutaji Sigara",
    noise: "Kelele",
    parking: "Maegesho",
    insurance_liability: "Bima na Dhima",
    custom: "Maalum"
};

const resolvePdfLanguage = language =>
    language === "sw"
        ? "sw"
        : "en";

const getPdfText = language =>
    PDF_LANGUAGES[
        resolvePdfLanguage(language)
    ];

const formatDate = (value, language = "en") => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return String(value);
    }

    const text =
        getPdfText(language);

    return date.toLocaleDateString(text.locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
};

const formatDateTime = (value, language = "en") => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return String(value);
    }

    const text =
        getPdfText(language);

    return date.toLocaleString(text.locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC"
    });
};

const formatAmount = (
    amount,
    currencyCode,
    language = "en"
) => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        return `${amount} ${currencyCode}`;
    }

    const text =
        getPdfText(language);

    return `${numericAmount.toLocaleString(
        text.amountLocale,
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )} ${currencyCode}`;
};

const formatLabel = (
    value,
    language = "en"
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    const normalized =
        String(value)
            .trim()
            .toLowerCase();

    if (
        resolvePdfLanguage(language) ===
            "sw" &&
        Object.prototype.hasOwnProperty.call(
            SWAHILI_ENUM_LABELS,
            normalized
        )
    ) {
        return SWAHILI_ENUM_LABELS[
            normalized
        ];
    }

    return String(value)
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
};

const ensureSpace = (
    document,
    requiredHeight
) => {
    if (
        document.y + requiredHeight >
        document.page.height - 70
    ) {
        document.addPage();
    }
};

const drawRule = (
    document,
    color = "#D1D5DB"
) => {
    document
        .strokeColor(color)
        .lineWidth(1)
        .moveTo(50, document.y)
        .lineTo(545, document.y)
        .stroke()
        .moveDown(0.7);
};

const drawSectionTitle = (
    document,
    title
) => {
    ensureSpace(document, 45);

    document
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#111827")
        .text(title.toUpperCase())
        .moveDown(0.6);
};

const drawLabelValue = (
    document,
    label,
    value
) => {
    ensureSpace(document, 30);

    const y = document.y;

    document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#4B5563")
        .text(
            label,
            50,
            y,
            {
                width: 155
            }
        );

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
            210,
            y,
            {
                width: 335
            }
        );

    document.moveDown(0.55);
};

const drawStatusBanner = (
    document,
    status,
    language = "en"
) => {
    const normalizedStatus =
        String(status || "")
            .toLowerCase();

    const text =
        getPdfText(language);

    let backgroundColor = "#E5E7EB";
    let textColor = "#374151";
    let label =
        formatLabel(
            status,
            language
        );

    if (normalizedStatus === "draft") {
        backgroundColor = "#FEF3C7";
        textColor = "#92400E";
        label = text.draftNotBinding;
    } else if (
        normalizedStatus === "scheduled"
    ) {
        backgroundColor = "#DBEAFE";
        textColor = "#1D4ED8";
    } else if (
        normalizedStatus === "active"
    ) {
        backgroundColor = "#D1FAE5";
        textColor = "#047857";
    } else if (
        [
            "terminated",
            "cancelled",
            "expired"
        ].includes(normalizedStatus)
    ) {
        backgroundColor = "#FEE2E2";
        textColor = "#B91C1C";
    }

    const bannerTop = document.y;

    document
        .roundedRect(
            165,
            bannerTop,
            265,
            30,
            4
        )
        .fill(backgroundColor);

    document
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(textColor)
        .text(
            label,
            165,
            bannerTop + 9,
            {
                width: 265,
                align: "center"
            }
        );

    document.y = bannerTop + 43;
};

const drawClause = (
    document,
    clause,
    index,
    language = "en"
) => {
    const text =
        getPdfText(language);

    /*
     * Clause title and clause_text are intentionally
     * never auto-translated. They remain exactly as
     * approved and stored by the owner.
     */
    const title =
        clause.title ||
        `${text.clause} ${index + 1}`;

    const category =
        formatLabel(
            clause.clause_category,
            language
        );

    const mandatoryLabel =
        clause.is_mandatory
            ? text.mandatory
            : text.additional;

    const clauseText =
        String(
            clause.clause_text || ""
        ).trim();

    const estimatedTextHeight =
        document
            .font("Helvetica")
            .fontSize(9)
            .heightOfString(
                clauseText,
                {
                    width: 455,
                    align: "justify",
                    lineGap: 2
                }
            );

    ensureSpace(
        document,
        Math.min(
            180,
            75 + estimatedTextHeight
        )
    );

    document
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111827")
        .text(
            `${index + 1}. ${title}`,
            {
                width: 495
            }
        );

    document
        .moveDown(0.2)
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6B7280")
        .text(
            `${category} · ${mandatoryLabel}`,
            {
                width: 495
            }
        );

    document
        .moveDown(0.45)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#1F2937")
        .text(
            clauseText,
            {
                width: 495,
                align: "justify",
                lineGap: 2
            }
        );

    document.moveDown(0.9);
};

const drawSignatureBlock = (
    document,
    lease,
    language = "en"
) => {
    const text =
        getPdfText(language);

    ensureSpace(document, 190);

    drawRule(document);

    drawSectionTitle(
        document,
        text.signatures
    );

    document
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#4B5563")
        .text(
            text.signatureNotice,
            {
                width: 495,
                align: "justify"
            }
        )
        .moveDown(1.8);

    const leftX = 50;
    const rightX = 315;
    const lineWidth = 230;
    const signatureY = document.y + 35;

    document
        .strokeColor("#6B7280")
        .lineWidth(0.8)
        .moveTo(
            leftX,
            signatureY
        )
        .lineTo(
            leftX + lineWidth,
            signatureY
        )
        .stroke();

    document
        .moveTo(
            rightX,
            signatureY
        )
        .lineTo(
            rightX + lineWidth,
            signatureY
        )
        .stroke();

    document
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#111827")
        .text(
            text.ownerLandlord,
            leftX,
            signatureY + 8,
            {
                width: lineWidth
            }
        )
        .text(
            text.tenant,
            rightX,
            signatureY + 8,
            {
                width: lineWidth
            }
        );

    document
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#4B5563")
        .text(
            lease.owner.display_name,
            leftX,
            signatureY + 23,
            {
                width: lineWidth
            }
        )
        .text(
            lease.tenant.display_name,
            rightX,
            signatureY + 23,
            {
                width: lineWidth
            }
        );

    const dateLineY =
        signatureY + 72;

    document
        .strokeColor("#9CA3AF")
        .moveTo(
            leftX,
            dateLineY
        )
        .lineTo(
            leftX + 110,
            dateLineY
        )
        .stroke()
        .moveTo(
            rightX,
            dateLineY
        )
        .lineTo(
            rightX + 110,
            dateLineY
        )
        .stroke();

    document
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6B7280")
        .text(
            text.date,
            leftX,
            dateLineY + 5
        )
        .text(
            text.date,
            rightX,
            dateLineY + 5
        );

    document.y =
        dateLineY + 28;
};

/**
 * Resolve the authorized lease snapshot used
 * for PDF generation.
 *
 * Existing lease access rules remain authoritative.
 * PDF download additionally requires financial
 * visibility because the agreement contains rent,
 * deposit and late-fee terms.
 */
const getLeasePdfData = async ({
    leasePublicId,
    authenticatedUser
}) => {
    const lease =
        await getSingleLease({
            leasePublicId,
            authenticatedUser
        });

    if (!lease) {
        return {
            leaseNotFound: true
        };
    }

    if (
        lease.can_view_finances !== true ||
        !lease.financial_terms
    ) {
        return {
            forbidden: true
        };
    }

    const clausesResult =
        await pool.query(
            `
            SELECT
                lc.public_id,
                lc.clause_category,
                lc.title,
                lc.clause_text,
                lc.is_mandatory,
                lc.display_order,
                lc.created_at,
                lc.updated_at
            FROM lease_clauses AS lc

            INNER JOIN leases AS l
                ON l.id = lc.lease_id

            WHERE l.public_id = $1
              AND lc.deleted_at IS NULL

            ORDER BY
                lc.display_order ASC,
                lc.id ASC
            `,
            [
                leasePublicId
            ]
        );

    return {
        leaseNotFound: false,
        forbidden: false,
        lease,
        clauses:
            clausesResult.rows
    };
};

/**
 * Generate the lease agreement PDF in memory.
 */
const generateLeasePdf = async ({
    lease,
    clauses,
    language = "en"
}) => {
    const resolvedLanguage =
        resolvePdfLanguage(language);

    const text =
        getPdfText(
            resolvedLanguage
        );
    return new Promise(
        (resolve, reject) => {
            const document =
                new PDFDocument({
                    size: "A4",
                    bufferPages: true,
                    margins: {
                        top: 45,
                        right: 50,
                        bottom: 60,
                        left: 50
                    },
                    info: {
                        Title:
                            `${text.leaseAgreement} ${lease.lease_number}`,
                        Subject:
                            resolvedLanguage === "sw"
                                ? "Mkataba wa pango wa mali au makazi"
                                : "Residential or property lease agreement",
                        Creator:
                            "Real Estate Management System"
                    }
                });

            const chunks = [];

            document.on(
                "data",
                chunk => {
                    chunks.push(chunk);
                }
            );

            document.on(
                "end",
                () => {
                    resolve(
                        Buffer.concat(
                            chunks
                        )
                    );
                }
            );

            document.on(
                "error",
                reject
            );

            document
                .font("Helvetica-Bold")
                .fontSize(21)
                .fillColor("#111827")
                .text(
                    text.leaseAgreement,
                    {
                        align: "center"
                    }
                );

            document
                .moveDown(0.25)
                .font("Helvetica")
                .fontSize(10)
                .fillColor("#4B5563")
                .text(
                    lease.owner.display_name,
                    {
                        align: "center"
                    }
                )
                .moveDown(0.75);

            drawStatusBanner(
                document,
                lease.status,
                resolvedLanguage
            );

            drawRule(document);

            drawLabelValue(
                document,
                text.leaseNumber,
                lease.lease_number
            );

            drawLabelValue(
                document,
                text.leaseStatus,
                formatLabel(
                    lease.status,
                    resolvedLanguage
                )
            );

            drawLabelValue(
                document,
                text.agreementPeriod,
                `${formatDate(
                    lease.start_date,
                    resolvedLanguage
                )} ${text.to} ${formatDate(
                    lease.end_date,
                    resolvedLanguage
                )}`
            );

            drawLabelValue(
                document,
                text.signedAt,
                lease.lifecycle
                    .signed_at
                    ? `${formatDateTime(
                        lease.lifecycle
                            .signed_at,
                        resolvedLanguage
                    )} UTC`
                    : "-"
            );

            document.moveDown(0.5);
            drawRule(document);

            drawSectionTitle(
                document,
                text.parties
            );

            drawLabelValue(
                document,
                text.ownerLandlord,
                lease.owner
                    .display_name
            );

            drawLabelValue(
                document,
                text.ownerType,
                formatLabel(
                    lease.owner
                        .owner_type,
                    resolvedLanguage
                )
            );

            drawLabelValue(
                document,
                text.tenant,
                lease.tenant
                    .display_name
            );

            drawLabelValue(
                document,
                text.tenantType,
                formatLabel(
                    lease.tenant
                        .tenant_type,
                    resolvedLanguage
                )
            );

            document.moveDown(0.5);
            drawRule(document);

            drawSectionTitle(
                document,
                text.premises
            );

            drawLabelValue(
                document,
                text.property,
                lease.property
                    .property_name
            );

            drawLabelValue(
                document,
                text.propertyCode,
                lease.property
                    .property_code
            );

            drawLabelValue(
                document,
                text.unit,
                lease.unit
                    .unit_name ||
                lease.unit
                    .unit_code
            );

            drawLabelValue(
                document,
                text.unitCode,
                lease.unit
                    .unit_code
            );

            drawLabelValue(
                document,
                text.unitType,
                formatLabel(
                    lease.unit
                        .unit_type,
                    resolvedLanguage
                )
            );

            document.moveDown(0.5);
            drawRule(document);

            drawSectionTitle(
                document,
                text.financialTerms
            );

            const financialTerms =
                lease.financial_terms;

            drawLabelValue(
                document,
                text.rentAmount,
                formatAmount(
                    financialTerms
                        .rent_amount,
                    financialTerms
                        .currency_code,
                    resolvedLanguage
                )
            );

            drawLabelValue(
                document,
                text.billingFrequency,
                formatLabel(
                    financialTerms
                        .billing_frequency,
                    resolvedLanguage
                )
            );

            drawLabelValue(
                document,
                text.paymentDueDay,
                `${text.day} ${financialTerms.payment_due_day}`
            );

            drawLabelValue(
                document,
                text.gracePeriod,
                `${financialTerms.grace_period_days} ${text.days}`
            );

            drawLabelValue(
                document,
                text.securityDeposit,
                formatAmount(
                    financialTerms
                        .security_deposit_amount,
                    financialTerms
                        .currency_code,
                    resolvedLanguage
                )
            );

            let lateFeeDescription =
                text.none;

            if (
                financialTerms
                    .late_fee_type ===
                    "fixed"
            ) {
                lateFeeDescription =
                    formatAmount(
                        financialTerms
                            .late_fee_value,
                        financialTerms
                            .currency_code,
                        resolvedLanguage
                    );
            } else if (
                financialTerms
                    .late_fee_type ===
                    "percentage"
            ) {
                lateFeeDescription =
                    `${Number(
                        financialTerms
                            .late_fee_value
                    ).toLocaleString(
                        text.amountLocale,
                        {
                            maximumFractionDigits:
                                4
                        }
                    )}%`;
            }

            drawLabelValue(
                document,
                text.lateFee,
                lateFeeDescription
            );

            document.moveDown(0.5);
            drawRule(document);

            drawSectionTitle(
                document,
                text.termsConditions
            );

            if (
                !Array.isArray(clauses) ||
                clauses.length === 0
            ) {
                document
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor("#6B7280")
                    .text(
                        text.noClauses,
                        {
                            width: 495
                        }
                    )
                    .moveDown(1);
            } else {
                clauses.forEach(
                    (
                        clause,
                        index
                    ) => {
                        drawClause(
                            document,
                            clause,
                            index,
                            resolvedLanguage
                        );
                    }
                );
            }

            drawSignatureBlock(
                document,
                lease,
                resolvedLanguage
            );

            ensureSpace(
                document,
                55
            );

            document
                .moveDown(0.8)
                .font("Helvetica")
                .fontSize(8)
                .fillColor("#6B7280")
                .text(
                    text.generatedNotice,
                    {
                        align: "center"
                    }
                );

            const range =
                document.bufferedPageRange();

            for (
                let pageIndex = 0;
                pageIndex < range.count;
                pageIndex += 1
            ) {
                document.switchToPage(
                    range.start +
                    pageIndex
                );

                /*
                 * Footer is intentionally drawn inside the
                 * reserved bottom-margin area. PDFKit normally
                 * treats that area as non-flowing content and can
                 * create a new page when text is placed there.
                 * Temporarily remove the bottom margin while the
                 * footer is drawn so page numbering never creates
                 * footer-only blank pages.
                 */
                const originalBottomMargin =
                    document.page.margins.bottom;

                document.page.margins.bottom = 0;

                const footerY =
                    document.page.height -
                    35;

                document
                    .font("Helvetica")
                    .fontSize(7.5)
                    .fillColor("#9CA3AF")
                    .text(
                        `${text.lease} ${lease.lease_number} | ${text.page} ${pageIndex + 1} / ${range.count}`,
                        50,
                        footerY,
                        {
                            width: 495,
                            align: "center",
                            lineBreak: false
                        }
                    );

                document.page.margins.bottom =
                    originalBottomMargin;
            }

            document.end();
        }
    );
};

module.exports = {
    getLeasePdfData,
    generateLeasePdf
};
