# Inline tenant activation

Manual review found that inline tenant creation selected a prospective profile while lease creation requires an active profile, causing “Active tenant not found.”

New prospective tenants now open the existing explicit activation dialog. Cancelling preserves the profile and blocks lease progression until activation. The selected owner's prospective tenants can be selected again and activated; blocked and inactive profiles remain excluded. The existing backend permission and eligibility checks are unchanged.

The tenant form preserves its original callback argument and additionally passes the full creation result so the wizard can retain the owner relationship.

Verification: frontend build and lint passed with existing warnings; component checks passed. Real browser/API checks covered an existing active tenant on desktop and actual inline prospective creation on mobile, cancelling activation, blocked progression, explicit activation, and continuing through invoice/payment/receipt PDF.

Earlier tests missed this because the component fixture created an already-active tenant and the browser flow selected an existing tenant. The browser regression now creates and activates a real prospective profile.
