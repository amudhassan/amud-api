# Local preview profile import

The preview-only command is `scripts/ux/legacy-rental-preview-import.cjs`. Supply an extracted source directory using `--source-dir` and confirmed property regions using `--region` or `--regions-file`.

Use `--plan-only` for an offline summary. The default database mode is a read-only dry-run. `--apply` performs a transaction after source validation and preview identity checks. Regions must be supplied before applying.

The shared connection adapter restricts database mode to local acceptance targets. Existing owner/import identity conflicts require review. The import journal prevents duplicates on an unchanged repeat and rejects changed inputs for separate review. An injected failure test verifies complete transactional rollback.

Imported profiles require lifecycle review. Properties and units begin inactive; tenant profiles begin prospective. Source contact duplicates are flagged rather than merged. Blank-name records are held. Original source metadata remains available in the target preview for review.

This command does not transfer accounting balances, issue contracts, import login credentials or schedule messages. Historical contracts and financial records require a separate reconciliation step.

Keep private source files and credentials outside version control. Test with synthetic input by running `scripts/ux/legacy-rental-preview-import-check.cjs` through the existing isolated acceptance test setup. An optional `--source-dir` permits local source verification without bundling those files in the repository.

A passing isolated test does not mean the user's local preview has been imported. Verify the local dry-run result, apply to the authorized preview, then inspect records through the existing application.
