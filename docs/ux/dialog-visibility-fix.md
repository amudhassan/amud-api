# Dialog visibility during accountant review

The accountant's video showed the Clause Templates dialog beneath the sidebar: the beginnings of labels and paragraphs were obscured, and the background page could scroll behind the long template preview. The content column's stacking context trapped its fixed dialogs below the sidebar; checking overlay bounds alone had missed the occlusion.

`ModalPortal` now renders the accountant workflow dialogs at the document body, outside page stacking and animation contexts. It locks background body scrolling and compensates for the disappearing scrollbar. Multiple open layers share the lock: closing an inline tenant dialog keeps the parent wizard locked; the original body styles return after the last dialog closes. Existing inner dialog headers and content scrolling remain in place.

Applied to tenant creation/activation; lease creation, clauses, templates, agreement confirmation and activation; invoice creation, detail, item addition and issuance; and payment recording. Other application dialogs are outside this change's scope.

Validation:

- Added a real browser hit-test at the left edge of the Owner label. It reproduced the sidebar occlusion before the fix and passed afterward.
- Browser/API acceptance passed at 1440×1000, 390×844 and 1280×640, including long-preview scrolling, reachable sticky Close control, background scroll lock/restoration and nested child-dialog lock retention.
- Each size completed the tenancy → invoice → payment → receipt PDF workflow using real local API responses and an isolated acceptance database.
- Desktop/mobile screenshots were inspected; labels and the dialog panel are visible above the sidebar.
- React component DOM checks and frontend build passed. Lint reports existing warnings; whitespace checks passed.

Accountant review is still required. This change does not deploy production.

## Owner and property follow-up

A later review found the same page stacking issue in Owner Details. All 13 owner dialog components now use the shared portal, including nested user/shareholder dialogs. The property creation and deleted-property overlays also use it and expose accessible dialog names. No record timestamps or ownership dates are changed by this layout fix.

The real browser/API check now opens and scrolls Owner Details, verifies that the backdrop covers the sidebar hit targets, closes it and checks body scroll restoration. It also opens/closes property creation and checks its backdrop and scrolling. These checks and the existing tenancy-to-receipt flow passed at all three viewport sizes. Build passed; lint retains existing warnings.
