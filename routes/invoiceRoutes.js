const express = require("express");

const router = express.Router();

const {
    authMiddleware
} = require(
    "../middleware/authMiddleware"
);

const validateRequest = require(
    "../middleware/validateRequest"
);

const {
    createDraftRentInvoiceController,
    getInvoicesController,
    getSingleInvoiceController,
    updateDraftRentInvoiceController,
    addDraftRentInvoiceItemController,
    updateDraftRentInvoiceItemController,
    deleteDraftRentInvoiceItemController,
    issueRentInvoiceController,
    voidRentInvoiceController
} = require(
    "../controllers/invoiceController"
);

const {
    createDraftRentInvoiceValidator,
    getInvoicesValidator,
    getSingleInvoiceValidator,
    updateDraftRentInvoiceValidator,
    addDraftRentInvoiceItemValidator,
    updateDraftRentInvoiceItemValidator,
    deleteDraftRentInvoiceItemValidator,
    issueRentInvoiceValidator,
    voidRentInvoiceValidator
} = require(
    "../validators/invoiceValidator"
);

/*
 * GET /api/invoices
 *
 * Retrieve invoices visible to the
 * authenticated user.
 */
router.get(
    "/",
    authMiddleware,
    getInvoicesValidator,
    validateRequest,
    getInvoicesController
);

/*
 * GET /api/invoices/:invoice_public_id
 *
 * Retrieve one authorized invoice together
 * with its items and audit information.
 */
router.get(
    "/:invoice_public_id",
    authMiddleware,
    getSingleInvoiceValidator,
    validateRequest,
    getSingleInvoiceController
);

/*
 * POST /api/invoices
 *
 * Create a new draft rent invoice from an
 * eligible lease.
 */
router.post(
    "/",
    authMiddleware,
    createDraftRentInvoiceValidator,
    validateRequest,
    createDraftRentInvoiceController
);

/*
 * POST /api/invoices/:invoice_public_id/items
 *
 * Add a billing line to an authorized
 * draft invoice.
 */
router.post(
    "/:invoice_public_id/items",
    authMiddleware,
    addDraftRentInvoiceItemValidator,
    validateRequest,
    addDraftRentInvoiceItemController
);

/*
 * DELETE /api/invoices/:invoice_public_id/items/:item_public_id
 *
 * Delete an existing billing line belonging
 * to an authorized draft invoice.
 */
router.delete(
    "/:invoice_public_id/items/:item_public_id",
    authMiddleware,
    deleteDraftRentInvoiceItemValidator,
    validateRequest,
    deleteDraftRentInvoiceItemController
);
/*
 * PATCH /api/invoices/:invoice_public_id/items/:item_public_id
 *
 * Update an existing billing line belonging
 * to an authorized draft invoice.
 */
router.patch(
    "/:invoice_public_id/items/:item_public_id",
    authMiddleware,
    updateDraftRentInvoiceItemValidator,
    validateRequest,
    updateDraftRentInvoiceItemController
);
/*
 * PATCH /api/invoices/:invoice_public_id/issue
 *
 * Issue an eligible draft rent invoice and
 * record immutable issuance audit data.
 */
router.patch(
    "/:invoice_public_id/issue",
    authMiddleware,
    issueRentInvoiceValidator,
    validateRequest,
    issueRentInvoiceController
);
/*
 * PATCH /api/invoices/:invoice_public_id/void
 *
 * Void an eligible draft or issued rent
 * invoice and record immutable audit data.
 */
router.patch(
    "/:invoice_public_id/void",
    authMiddleware,
    voidRentInvoiceValidator,
    validateRequest,
    voidRentInvoiceController
);

/*
 * PATCH /api/invoices/:invoice_public_id
 *
 * Update the editable header fields of an
 * authorized draft invoice.
 */
router.patch(
    "/:invoice_public_id",
    authMiddleware,
    updateDraftRentInvoiceValidator,
    validateRequest,
    updateDraftRentInvoiceController
);

module.exports = router;