# Mainland residential clause default

Leases → Clause Templates → select an owner → Preview 20 clauses and review checklist → Add / open mainland residential template. Review/edit the saved owner copy, then apply it to a Draft lease through Contract Clauses. Installation does not apply or sign a contract automatically.

The Kiswahili preset covers parties, residential use, occupants, rent/receipts, advance payments, deposits, handover, repairs, utilities, privacy/access, alterations, subletting, neighbours, optional house rules, notices, termination, final accounts and disputes. It supplements the main lease fields and signed attachments. It is an original draft, not an official form or a certification of legal compliance.

## Legal basis and review boundary

Sources consulted on 15 October 2026:

- [Land Act, Cap. 113 R.E. 2023](https://www.oag.go.tz/uploads/documents/en-1771907993-THE%20LAND%20ACT.pdf), particularly ss. 83–84, 92–93 and 105–114: tenancy type, notices, covenants and remedies.
- [Law of Contract Act, Cap. 345 R.E. 2023](https://oagmis.oag.go.tz/portal/acts/revised/448/download), ss. 10–11 and 23: consent, capacity and lawful terms.
- [Land Disputes Courts Act, Cap. 216 R.E. 2023](https://oagmis.oag.go.tz/portal/acts/revised/320/download): competent dispute resolution bodies. No obsolete housing tribunal is prescribed.

The proposed 30-day deposit accounting/refund period and 48-hour routine access notice are **contract choices**, not universal statutory deadlines. A software grace period does not replace a statutory notice. The preset does not impose a universal advance-rent period, deposit amount, late fee, rent increase or notice period for all terminations.

The Rent Restriction Act's application/exemptions and current advance-payment restrictions for the particular premises have **not been established** by this feature. They remain an explicit pre-signing check. Verify applicable amendments, any special regime, authority/consents, stamp duty, registration and execution formalities with a Tanzanian advocate. Zanzibar, customary leases, commercial premises and other special arrangements are outside this preset's intended scope. Signing requires the completed main lease and relevant attachments; this preset alone is not a complete executed tenancy agreement.

## Behaviour and validation

Authenticated users can preview the built-in catalog. Installation uses existing owner-management authorization: administrators or users with both property and finance management permission. One transaction creates the parent and all 20 items. The owner lock serializes installation. Repeating installation opens the existing version even if renamed or edited; it does not reset it. Soft-deleted copies stay deleted and can be replaced. Existing active owner-template names remain unique; a conflicting manually created name produces the existing conflict response rather than overwriting it.

Items are included by default. The existing `is_mandatory` inclusion flag is not a claim of statutory status. Applying an owner template uses the existing Draft-only independent snapshot mechanism. No migration is needed.

Validation: `scripts/ux/residential-template-check.cjs` covers authentication/input validation, permission denial, exact ordered import, repeat/edit preservation, snapshot independence, deletion/replacement, owner isolation, inactive owners and rollback after an injected item failure. The browser acceptance script exercises preview and import/reopen at desktop and mobile widths, followed by the existing tenancy-to-receipt flow. Frontend build passed; lint has existing warnings.
