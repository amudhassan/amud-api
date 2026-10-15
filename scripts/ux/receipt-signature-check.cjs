const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadReceiptSignature } = require('../../services/receiptSignatureService');
const { generateReceiptPdf } = require('../../services/receiptPdfService');
async function main() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'receipt-signature-'));
    const configPath = path.join(directory, 'config.json');
    const previous = process.env.RECEIPT_SIGNATURE_CONFIG_PATH;
    process.env.RECEIPT_SIGNATURE_CONFIG_PATH = configPath;
    process.env.RECEIPT_QR_SECRET = 'isolated-signature-test-secret-1234567890';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    try {
        const receipt = { receipt_number: 'RCT-TEST', receipt_status: 'valid', issued_at: new Date(),
            payee: { public_id: 'owner_test', display_name: 'Test Owner' }, payer: { display_name: 'Test Tenant' },
            received_by: { role: 'admin' }, payment: { amount: 180000, currency_code: 'TZS', payment_number: 'PAY-TEST',
                paid_at: new Date(), updated_at: new Date(), payment_method: 'cash' },
            allocations: [{ allocated_amount: 180000, invoice: { invoice_number: 'INV-TEST', currency_code: 'TZS',
                total_amount: 180000, paid_amount: 180000, balance_amount: 0, status: 'paid' } }] };
        assert.equal(await loadReceiptSignature(receipt), null);
        const imagePath = process.env.UX_SIGNATURE_TEST_IMAGE || path.join(directory, 'image.png');
        if (!process.env.UX_SIGNATURE_TEST_IMAGE) await fs.writeFile(imagePath, await require('qrcode').toBuffer('Synthetic test image'));
        const config = { owner_public_id: 'owner_test', image_path: imagePath, signer_title: 'Operator' };
        await fs.writeFile(configPath, JSON.stringify(config));
        assert.equal((await loadReceiptSignature(receipt)).title, 'Operator');
        const other = { ...receipt, payee: { public_id: 'other_owner', display_name: 'Other Owner' } };
        assert.equal(await loadReceiptSignature(other), null);
        const extract = async (value, name) => {
            const file = path.join(directory, name + '.pdf');
            await fs.writeFile(file, await generateReceiptPdf(value));
            return { file, text: execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }) };
        };
        const signed = await extract(receipt, 'signed');
        assert.equal(signed.text.match(/AUTHORIZED SIGNATURE/g).length, 1);
        assert.match(signed.text, /Operator/);
        assert.match(signed.text, /RECEIPT REFERENCE QR/);
        assert.doesNotMatch((await extract(other, 'other')).text, /AUTHORIZED SIGNATURE/);
        assert.match((await extract({ ...receipt, receipt_status: 'reversed' }, 'reversed')).text, /REVERSED/);
        config.image_path = path.join(directory, 'missing.png');
        await fs.writeFile(configPath, JSON.stringify(config));
        await assert.rejects(() => generateReceiptPdf(receipt));
        assert.equal(await loadReceiptSignature(other), null, 'Other owners never load the configured signature image');
        if (process.env.UX_SIGNATURE_TEST_PDF) await fs.copyFile(signed.file, process.env.UX_SIGNATURE_TEST_PDF);
        console.log('PASS: optional configuration, owner isolation, single signature, Operator title, QR, reversed state, and missing-image failure');
    } finally {
        if (previous === undefined) delete process.env.RECEIPT_SIGNATURE_CONFIG_PATH;
        else process.env.RECEIPT_SIGNATURE_CONFIG_PATH = previous;
        await fs.rm(directory, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
