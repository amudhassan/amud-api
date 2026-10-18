const fs = require('node:fs/promises');
const path = require('node:path');

// Private runtime configuration and image stay outside version control.
const loadReceiptSignature = async receipt => {
    const configPath = process.env.RECEIPT_SIGNATURE_CONFIG_PATH ||
        path.resolve(__dirname, '../private-data/receipt-signature.json');
    let raw = process.env.RECEIPT_SIGNATURE_INLINE_JSON;
    if (!raw) {
        try { raw = await fs.readFile(configPath, 'utf8'); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }
    const config = JSON.parse(raw);
    if (!config.owner_public_id || config.owner_public_id !== receipt.payee?.public_id) return null;
    let image;
    if (config.image_base64) {
        if (typeof config.image_base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(config.image_base64) || config.image_base64.length > 7 * 1024 * 1024) throw Error('Invalid inline signature image.');
        image = Buffer.from(config.image_base64, 'base64');
    } else {
        if (!path.isAbsolute(config.image_path || '')) throw Error('Receipt signature image path must be absolute.');
        image = await fs.readFile(config.image_path);
    }
    if (image.length > 5 * 1024 * 1024) throw Error('Receipt signature image exceeds 5 MB.');
    const png = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = image[0] === 255 && image[1] === 216 && image[2] === 255;
    if (!png && !jpeg) throw Error('Receipt signature must be a PNG or JPEG image.');
    const name = String(config.signer_name || '').trim();
    const title = String(config.signer_title || 'Operator').trim();
    if (name.length > 100 || title.length > 60 || /[\r\n]/.test(name + title)) throw Error('Invalid receipt signer text.');
    return { image, name, title };
};
module.exports = { loadReceiptSignature };
