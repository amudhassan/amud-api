import {
    FileText,
    RefreshCw
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const ATTACHMENT_TYPES = [
    "",
    "problem_evidence",
    "quotation",
    "approval_document",
    "work_progress",
    "purchase_receipt",
    "vendor_invoice",
    "completion_evidence",
    "other"
];

const VISIBILITY_VALUES = [
    "",
    "internal",
    "tenant_visible",
    "technician_visible",
    "shared"
];

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(parsed);
};

const formatBytes = value => {
    const amount =
        Number(value);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return "—";
    }

    if (amount < 1024) {
        return `${amount} B`;
    }

    if (amount < 1024 * 1024) {
        return `${(
            amount / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        amount /
        (1024 * 1024)
    ).toFixed(1)} MB`;
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to load maintenance attachments.";

function MaintenanceAttachmentsPanel({
    maintenanceRequest,
    accessContext
}) {
    const [
        attachments,
        setAttachments
    ] = useState([]);

    const [
        loading,
        setLoading
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        attachmentType,
        setAttachmentType
    ] = useState("");

    const [
        visibility,
        setVisibility
    ] = useState("");

    const [
        includeRevoked,
        setIncludeRevoked
    ] = useState(false);

    const loadAttachments =
        useCallback(
            async () => {
                if (
                    !maintenanceRequest
                        ?.public_id
                ) {
                    return;
                }

                try {
                    setLoading(true);
                    setError("");

                    const params = {
                        sort_order: "desc",
                        page: 1,
                        limit: 50
                    };

                    if (accessContext) {
                        params.access_context =
                            accessContext;
                    }

                    if (attachmentType) {
                        params.attachment_type =
                            attachmentType;
                    }

                    if (visibility) {
                        params.visibility =
                            visibility;
                    }

                    if (includeRevoked) {
                        params.include_revoked =
                            true;
                    }

                    const response =
                        await apiClient.get(
                            `/maintenance/requests/${encodeURIComponent(
                                maintenanceRequest.public_id
                            )}/attachments`,
                            {
                                params
                            }
                        );

                    const rows =
                        response?.data?.data
                            ?.maintenance_attachments;

                    setAttachments(
                        Array.isArray(rows)
                            ? rows
                            : []
                    );
                } catch (
                    requestError
                ) {
                    setAttachments([]);
                    setError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                accessContext,
                attachmentType,
                includeRevoked,
                maintenanceRequest
                    ?.public_id,
                visibility
            ]
        );

    useEffect(() => {
        loadAttachments();
    }, [
        loadAttachments
    ]);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                        <FileText className="h-5 w-5" />
                    </span>

                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            Maintenance Attachments
                        </h3>

                        <p className="mt-0.5 text-xs text-slate-500">
                            Evidence and document metadata visible in your maintenance access context.
                        </p>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="secondary"
                    leftIcon={RefreshCw}
                    disabled={loading}
                    onClick={
                        loadAttachments
                    }
                >
                    Refresh Attachments
                </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Attachment Type
                        </span>

                        <select
                            value={
                                attachmentType
                            }
                            onChange={
                                event =>
                                    setAttachmentType(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {ATTACHMENT_TYPES.map(
                                item => (
                                    <option
                                        key={
                                            item ||
                                            "all"
                                        }
                                        value={
                                            item
                                        }
                                    >
                                        {item
                                            ? formatLabel(
                                                  item
                                              )
                                            : "All Types"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Visibility
                        </span>

                        <select
                            value={
                                visibility
                            }
                            onChange={
                                event =>
                                    setVisibility(
                                        event
                                            .target
                                            .value
                                    )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {VISIBILITY_VALUES.map(
                                item => (
                                    <option
                                        key={
                                            item ||
                                            "all"
                                        }
                                        value={
                                            item
                                        }
                                    >
                                        {item
                                            ? formatLabel(
                                                  item
                                              )
                                            : "All Visibility"}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label className="flex items-end">
                        <span className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={
                                    includeRevoked
                                }
                                onChange={
                                    event =>
                                        setIncludeRevoked(
                                            event
                                                .target
                                                .checked
                                        )
                                }
                                className="h-4 w-4"
                            />

                            Include Revoked
                        </span>
                    </label>
                </div>

                {loading && (
                    <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Loading attachments...
                    </div>
                )}

                {!loading &&
                    attachments.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                            No visible maintenance attachments found.
                        </div>
                    )}

                {!loading &&
                    attachments.length >
                        0 && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">
                                            File
                                        </th>
                                        <th className="px-4 py-3">
                                            Type
                                        </th>
                                        <th className="px-4 py-3">
                                            Visibility
                                        </th>
                                        <th className="px-4 py-3">
                                            Size
                                        </th>
                                        <th className="px-4 py-3">
                                            Uploaded
                                        </th>
                                        <th className="px-4 py-3">
                                            Status
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {attachments.map(
                                        attachment => (
                                            <tr
                                                key={
                                                    attachment.public_id
                                                }
                                                className="align-top"
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">
                                                        {attachment.original_file_name ||
                                                            attachment.stored_file_name ||
                                                            "Attachment"}
                                                    </p>

                                                    {attachment.description && (
                                                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                                                            {
                                                                attachment.description
                                                            }
                                                        </p>
                                                    )}

                                                    <p className="mt-1 break-all text-[11px] text-slate-400">
                                                        {attachment.mime_type ||
                                                            "—"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-3 text-slate-700">
                                                    {formatLabel(
                                                        attachment.attachment_type
                                                    ) ||
                                                        "—"}
                                                </td>

                                                <td className="px-4 py-3 text-slate-700">
                                                    {formatLabel(
                                                        attachment.visibility
                                                    ) ||
                                                        "—"}
                                                </td>

                                                <td className="px-4 py-3 text-slate-700">
                                                    {formatBytes(
                                                        attachment.file_size_bytes
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-slate-700">
                                                    {formatDateTime(
                                                        attachment.uploaded_at
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {attachment.revoked_at ? (
                                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                                            Revoked
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                            Active
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    This screen reads registered attachment metadata only. The current backend attachment POST endpoint expects file metadata after a separate upload/storage pipeline has already stored the file.
                </div>
            </div>
        </section>
    );
}

export default MaintenanceAttachmentsPanel;
