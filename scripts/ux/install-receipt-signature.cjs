// Copies a user-selected signature to private, git-ignored runtime storage.
const fs = require('node:fs/promises');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { loadReceiptSignature } = require('../../services/receiptSignatureService');
async function main() {
    const imagePath = process.argv[2];
    const owner = process.argv[3];
    const name = process.argv[4] || '';
    const title = process.argv[5] || 'Operator';
    if (!imagePath || !/^[a-zA-Z0-9_-]{1,120}$/.test(owner || ''))
        throw Error('Usage: node scripts/ux/install-receipt-signature.cjs IMAGE_PATH OWNER_PUBLIC_ID [NAME] [TITLE]');
    const directory = path.resolve(__dirname, '../../private-data');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const configPath = path.join(directory, 'receipt-signature.json');
    try { await fs.access(configPath); throw Error('A signature is already configured; preserve and review the existing configuration before replacing it.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const config = { owner_public_id: owner, image_path: path.resolve(imagePath), signer_name: name, signer_title: title };
    const temporary = path.join(directory, `signature-check-${process.pid}.json`);
    const previous = process.env.RECEIPT_SIGNATURE_CONFIG_PATH;
    try {
        await fs.writeFile(temporary, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
        process.env.RECEIPT_SIGNATURE_CONFIG_PATH = temporary;
        const signature = await loadReceiptSignature({ payee: { public_id: owner } });
        const document = new PDFDocument();
        document.on('data', () => {});
        document.openImage(signature.image); // Decode before publishing configuration.
        document.end();
        config.image_path = path.join(directory, 'receipt-signature-image');
        await fs.writeFile(config.image_path, signature.image, { mode: 0o600 });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
        console.log('PASS: private receipt signature installed for the selected owner; title: ' + title);
    } finally {
        await fs.unlink(temporary).catch(() => {});
        if (previous === undefined) delete process.env.RECEIPT_SIGNATURE_CONFIG_PATH;
        else process.env.RECEIPT_SIGNATURE_CONFIG_PATH = previous;
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
