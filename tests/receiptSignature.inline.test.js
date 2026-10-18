const {loadReceiptSignature}=require('../services/receiptSignatureService');
const old=process.env.RECEIPT_SIGNATURE_INLINE_JSON;
afterEach(()=>{if(old===undefined)delete process.env.RECEIPT_SIGNATURE_INLINE_JSON;else process.env.RECEIPT_SIGNATURE_INLINE_JSON=old;});
const receipt={payee:{public_id:'owner_demo'}};
test('loads owner-specific inline image without a filesystem signature',async()=>{
 const image=Buffer.from([137,80,78,71,13,10,26,10]);
 process.env.RECEIPT_SIGNATURE_INLINE_JSON=JSON.stringify({owner_public_id:'owner_demo',image_base64:image.toString('base64'),signer_title:'Operator'});
 const result=await loadReceiptSignature(receipt);expect(result.image).toEqual(image);expect(result.title).toBe('Operator');
 expect(await loadReceiptSignature({payee:{public_id:'owner_other'}})).toBeNull();
});
test('invalid matching inline image fails instead of silently omitting signature',async()=>{
 process.env.RECEIPT_SIGNATURE_INLINE_JSON=JSON.stringify({owner_public_id:'owner_demo',image_base64:'invalid***'});
 await expect(loadReceiptSignature(receipt)).rejects.toThrow('Invalid inline signature image');
});
