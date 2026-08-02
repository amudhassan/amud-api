const asyncHandler = require(
    "../utils/asyncHandler"
);

const AppError = require(
    "../utils/AppError"
);

const {
    createDraftRentInvoice,
    getInvoices,
    getSingleInvoice,
    updateDraftRentInvoice,
    addDraftRentInvoiceItem,
    updateDraftRentInvoiceItem,
    deleteDraftRentInvoiceItem,
    issueRentInvoice,
    voidRentInvoice
} = require(
    "../services/invoiceService"
);

/*
 * POST /api/invoices
 */
const createDraftRentInvoiceController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await createDraftRentInvoice({
                        invoiceData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.leaseNotFound) {
                    return next(
                        new AppError(
                            "Lease not found.",
                            404
                        )
                    );
                }

                if (
                    result.leaseNotEligible
                ) {
                    return next(
                        new AppError(
                            "The selected lease is not eligible for invoicing.",
                            409
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to create invoices for this owner.",
                            403
                        )
                    );
                }

                if (
                    result.relationshipConflict
                ) {
                    return next(
                        new AppError(
                            "The lease relationships are not valid for invoice creation.",
                            409
                        )
                    );
                }

                if (
                    result.invalidBillingPeriod
                ) {
                    return next(
                        new AppError(
                            "The supplied invoice billing period is invalid.",
                            422
                        )
                    );
                }

                if (
                    result
                        .billingPeriodOutsideLease
                ) {
                    return next(
                        new AppError(
                            "Invoice billing period must be within the lease period.",
                            409
                        )
                    );
                }

                if (result.invalidDueDate) {
                    return next(
                        new AppError(
                            "Invoice due date cannot be before the billing period start.",
                            422
                        )
                    );
                }

                if (
                    result.billingPeriodConflict
                ) {
                    return next(
                        new AppError(
                            "The selected lease already has a conflicting invoice for the supplied billing period.",
                            409
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Draft rent invoice created successfully.",
                        data: {
                            invoice:
                                result.invoice,
                            lease:
                                result.lease,
                            owner:
                                result.owner,
                            property:
                                result.property,
                            unit:
                                result.unit,
                            tenant:
                                result.tenant
                        }
                    });
            } catch (error) {
                /*
                 * Public ID or invoice-number
                 * uniqueness conflict.
                 */
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The generated invoice identifier conflicts with an existing invoice. Please try again.",
                            409
                        )
                    );
                }

                /*
                 * Overlapping non-void invoice
                 * billing period.
                 */
                if (error.code === "23P01") {
                    return next(
                        new AppError(
                            "The selected lease already has a conflicting invoice for the supplied billing period.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied invoice violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

/*
 * GET /api/invoices
 */
const getInvoicesController =
    asyncHandler(
        async (req, res, next) => {
            const result =
                await getInvoices({
                    filters:
                        req.query,

                    authenticatedUser:
                        req.user
                });

            if (result.forbidden) {
                return next(
                    new AppError(
                        "You do not have permission to view invoices.",
                        403
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Invoices retrieved successfully.",
                    count:
                        result.invoices.length,
                    pagination:
                        result.pagination,
                    data: {
                        invoices:
                            result.invoices
                    }
                });
        }
    );

/*
 * GET /api/invoices/:invoice_public_id
 */
const getSingleInvoiceController =
    asyncHandler(
        async (req, res, next) => {
            const invoice =
                await getSingleInvoice({
                    invoicePublicId:
                        req.params
                            .invoice_public_id,

                    authenticatedUser:
                        req.user
                });

            /*
             * Missing and inaccessible invoices
             * use the same response to prevent
             * record-existence disclosure.
             */
            if (!invoice) {
                return next(
                    new AppError(
                        "Invoice not found.",
                        404
                    )
                );
            }

            return res
                .status(200)
                .json({
                    success: true,
                    message:
                        "Invoice retrieved successfully.",
                    data: {
                        invoice
                    }
                });
        }
    );

/*
 * PATCH /api/invoices/:invoice_public_id
 */
const updateDraftRentInvoiceController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateDraftRentInvoice({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        invoiceData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to update this invoice.",
                            403
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Only draft invoices can be updated.",
                            409
                        )
                    );
                }

                if (result.invalidDueDate) {
                    return next(
                        new AppError(
                            "Invoice due date cannot be before the billing period start.",
                            422
                        )
                    );
                }

                if (
                    result.invalidCurrencyCode
                ) {
                    return next(
                        new AppError(
                            "Invoice currency code must contain exactly three uppercase letters.",
                            422
                        )
                    );
                }

                if (result.noChanges) {
                    return next(
                        new AppError(
                            "No actual invoice changes were supplied.",
                            400
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Draft rent invoice updated successfully.",
                        data: {
                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied invoice update violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice update violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );

/*
 * POST /api/invoices/:invoice_public_id/items
 */
const addDraftRentInvoiceItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await addDraftRentInvoiceItem({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        itemData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to add items to this invoice.",
                            403
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Items can only be added while the invoice is draft.",
                            409
                        )
                    );
                }

                if (result.invalidItemType) {
                    return next(
                        new AppError(
                            "Invalid invoice item type.",
                            422
                        )
                    );
                }

                if (result.invalidDescription) {
                    return next(
                        new AppError(
                            "Invoice item description is invalid.",
                            422
                        )
                    );
                }

                if (result.invalidQuantity) {
                    return next(
                        new AppError(
                            "Invoice item quantity is invalid.",
                            422
                        )
                    );
                }

                if (result.invalidUnitAmount) {
                    return next(
                        new AppError(
                            "Invoice item unit amount is invalid.",
                            422
                        )
                    );
                }

                return res
                    .status(201)
                    .json({
                        success: true,
                        message:
                            "Draft invoice item added successfully.",
                        data: {
                            item:
                                result.item,

                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Generated item public-ID
                 * uniqueness conflict.
                 */
                if (error.code === "23505") {
                    return next(
                        new AppError(
                            "The generated invoice item identifier conflicts with an existing item. Please try again.",
                            409
                        )
                    );
                }

                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied invoice item violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice item references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice item violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
/*
 * PATCH /api/invoices/:invoice_public_id/items/:item_public_id
 */
const updateDraftRentInvoiceItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await updateDraftRentInvoiceItem({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        itemPublicId:
                            req.params
                                .item_public_id,

                        itemData:
                            req.body,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to update items on this invoice.",
                            403
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Items can only be updated while the invoice is draft.",
                            409
                        )
                    );
                }

                if (result.itemNotFound) {
                    return next(
                        new AppError(
                            "Invoice item not found.",
                            404
                        )
                    );
                }

                if (result.invalidItemType) {
                    return next(
                        new AppError(
                            "Invalid invoice item type.",
                            422
                        )
                    );
                }

                if (result.invalidDescription) {
                    return next(
                        new AppError(
                            "Invoice item description is invalid.",
                            422
                        )
                    );
                }

                if (result.invalidQuantity) {
                    return next(
                        new AppError(
                            "Invoice item quantity is invalid.",
                            422
                        )
                    );
                }

                if (result.invalidUnitAmount) {
                    return next(
                        new AppError(
                            "Invoice item unit amount is invalid.",
                            422
                        )
                    );
                }

                if (result.noChanges) {
                    return next(
                        new AppError(
                            "No actual invoice item changes were supplied.",
                            400
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Draft invoice item updated successfully.",
                        data: {
                            item:
                                result.item,

                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "The supplied invoice item update violates a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice item references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice item update violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * DELETE /api/invoices/:invoice_public_id/items/:item_public_id
 */
const deleteDraftRentInvoiceItemController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await deleteDraftRentInvoiceItem({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        itemPublicId:
                            req.params
                                .item_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to delete items from this invoice.",
                            403
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Items can only be deleted while the invoice is draft.",
                            409
                        )
                    );
                }

                if (result.itemNotFound) {
                    return next(
                        new AppError(
                            "Invoice item not found.",
                            404
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Draft invoice item deleted successfully.",
                        data: {
                            deleted_item:
                                result.deletedItem,

                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Deleting this invoice item would violate a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice item cannot be deleted because it is still referenced by another record.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "Deleting this invoice item would violate a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/invoices/:invoice_public_id/issue
 */
const issueRentInvoiceController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await issueRentInvoice({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to issue this invoice.",
                            403
                        )
                    );
                }

                if (result.notDraft) {
                    return next(
                        new AppError(
                            "Only draft invoices can be issued.",
                            409
                        )
                    );
                }

                if (result.noItems) {
                    return next(
                        new AppError(
                            "The invoice must contain at least one item before it can be issued.",
                            409
                        )
                    );
                }

                if (result.invalidTotal) {
                    return next(
                        new AppError(
                            "The invoice must have a positive total before it can be issued.",
                            409
                        )
                    );
                }

                if (result.financialConflict) {
                    return next(
                        new AppError(
                            "The invoice financial values are not eligible for issuance.",
                            409
                        )
                    );
                }

                if (result.invalidDueDate) {
                    return next(
                        new AppError(
                            "Invoice due date cannot be before the issue date.",
                            422
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Rent invoice issued successfully.",
                        data: {
                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Issuing this invoice would violate a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice cannot be issued because it violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
    /*
 * PATCH /api/invoices/:invoice_public_id/void
 */
const voidRentInvoiceController =
    asyncHandler(
        async (req, res, next) => {
            try {
                const result =
                    await voidRentInvoice({
                        invoicePublicId:
                            req.params
                                .invoice_public_id,

                        voidReason:
                            req.body
                                .void_reason,

                        authenticatedUser:
                            req.user
                    });

                if (result.invoiceNotFound) {
                    return next(
                        new AppError(
                            "Invoice not found.",
                            404
                        )
                    );
                }

                if (result.forbidden) {
                    return next(
                        new AppError(
                            "You are not authorized to void this invoice.",
                            403
                        )
                    );
                }

                if (result.invalidStatus) {
                    return next(
                        new AppError(
                            "Only draft or issued invoices without payments can be voided.",
                            409
                        )
                    );
                }

                if (result.paymentConflict) {
                    return next(
                        new AppError(
                            "An invoice with recorded payments cannot be voided.",
                            409
                        )
                    );
                }

                if (result.invalidVoidReason) {
                    return next(
                        new AppError(
                            "A valid invoice void reason is required.",
                            422
                        )
                    );
                }

                return res
                    .status(200)
                    .json({
                        success: true,
                        message:
                            "Rent invoice voided successfully.",
                        data: {
                            invoice:
                                result.invoice
                        }
                    });
            } catch (error) {
                /*
                 * Database CHECK constraint
                 * violation.
                 */
                if (error.code === "23514") {
                    return next(
                        new AppError(
                            "Voiding this invoice would violate a business rule.",
                            422
                        )
                    );
                }

                /*
                 * Foreign-key integrity conflict.
                 */
                if (error.code === "23503") {
                    return next(
                        new AppError(
                            "The invoice references a related record that is no longer available.",
                            409
                        )
                    );
                }

                /*
                 * Controlled database-integrity
                 * trigger exception.
                 */
                if (error.code === "P0001") {
                    return next(
                        new AppError(
                            error.message ||
                                "The invoice cannot be voided because it violates a business integrity rule.",
                            422
                        )
                    );
                }

                return next(error);
            }
        }
    );
module.exports = {
    createDraftRentInvoiceController,
    getInvoicesController,
    getSingleInvoiceController,
    updateDraftRentInvoiceController,
    addDraftRentInvoiceItemController,
    updateDraftRentInvoiceItemController,
    deleteDraftRentInvoiceItemController,
    issueRentInvoiceController,
    voidRentInvoiceController
};