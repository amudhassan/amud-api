# Owner-scoped receipt signature

PDF receipts can include a configured handwritten signature image, optional signer name and title. Matching uses the payee's exact owner public ID, never the displayed company name or the user recording payment. Other owners' PDFs stay unsigned. Receipt status, amounts, dates and verification QR are retained, including reversed receipt status.

Run `node scripts/ux/install-receipt-signature.cjs IMAGE_PATH OWNER_PUBLIC_ID [NAME] [TITLE]` from the repository. The default title is Operator. The signature appears as a Multiply overlay to the right of the QR reference text, with the title beneath it. The QR remains separate and readable. PNG/JPEG images up to 5 MB are accepted and decoded before configuration is installed. Existing configuration is never silently replaced.

Configuration and image are stored in `private-data/`, excluded from Git and outside the publicly served uploads directory. Keep this directory private and persistent on the application host. Never commit signatures. An optional `RECEIPT_SIGNATURE_CONFIG_PATH` selects an alternative JSON configuration with `owner_public_id`, absolute `image_path`, `signer_name`, and `signer_title`.

Configuration is read for each PDF request. No configuration means normal unsigned receipts. A broken matching configuration fails PDF generation rather than silently removing the signature. Existing downloads are unchanged; newly downloaded PDFs for existing receipts use the current configured signature. This is a visible signature image, not a certificate-based PDF digital signature or a historical signing snapshot.

Verification: `node scripts/ux/receipt-signature-check.cjs` requires Poppler's `pdftotext` and checks owner isolation, optional configuration, signature/title placement, QR, reversed state and missing-image failure. It uses synthetic records and a synthetic image unless a local QA image is explicitly selected through `UX_SIGNATURE_TEST_IMAGE`.

For hosts without a private persistent filesystem, `RECEIPT_SIGNATURE_INLINE_JSON` can supply the same owner/name/title fields with `image_base64` instead of `image_path`. Keep this value in the host secret configuration, never source control. Inline configuration takes precedence over file configuration. Owner isolation, image checks and fail-closed behavior are unchanged.
