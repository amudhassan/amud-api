import {
    Plus,
    RefreshCw,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const inputClassName = `
    mt-2 w-full rounded-xl
    border border-slate-300
    bg-white px-3 py-2.5
    text-sm text-slate-900
    outline-none transition
    placeholder:text-slate-400
    focus:border-blue-500
    focus:ring-2
    focus:ring-blue-100
    disabled:cursor-not-allowed
    disabled:bg-slate-100
    disabled:text-slate-500
`;

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

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to create maintenance assignment.";

const emptyForm = () => ({
    assignment_type:
        "external_vendor",
    assigned_user_public_id: "",
    vendor_name: "",
    company_name: "",
    contact_person: "",
    phone_number: "",
    email: "",
    service_description: "",
    assignment_notes: ""
});

function FieldLabel({
    children,
    required = false
}) {
    return (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {children}

            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </span>
    );
}

function CreateMaintenanceAssignmentModal({
    open,
    maintenanceRequest,
    accessContext,
    onClose,
    onCreated
}) {
    const [
        form,
        setForm
    ] = useState(
        emptyForm
    );

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        error,
        setError
    ] = useState("");

    const [
        technicians,
        setTechnicians
    ] = useState([]);

    const [
        techniciansLoading,
        setTechniciansLoading
    ] = useState(false);

    const [
        technicianLoadError,
        setTechnicianLoadError
    ] = useState("");

    const isAdmin =
        !accessContext;

    const internalMode =
        form.assignment_type ===
        "internal_technician";

    const canUseTechnicianDropdown =
        isAdmin;

    const loadTechnicians =
        useCallback(
            async () => {
                if (
                    !open ||
                    !internalMode ||
                    !canUseTechnicianDropdown
                ) {
                    return;
                }

                try {
                    setTechniciansLoading(
                        true
                    );
                    setTechnicianLoadError(
                        ""
                    );

                    const response =
                        await apiClient.get(
                            "/users",
                            {
                                params: {
                                    role: "user",
                                    page: 1,
                                    limit: 100
                                }
                            }
                        );

                    const rows =
                        Array.isArray(
                            response?.data
                                ?.users
                        )
                            ? response.data
                                  .users
                            : [];

                    setTechnicians(
                        rows
                    );
                } catch (
                    requestError
                ) {
                    setTechnicians([]);

                    setTechnicianLoadError(
                        getErrorMessage(
                            requestError
                        )
                    );
                } finally {
                    setTechniciansLoading(
                        false
                    );
                }
            },
            [
                canUseTechnicianDropdown,
                internalMode,
                open
            ]
        );

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(
            emptyForm()
        );
        setError("");
        setTechnicians([]);
        setTechnicianLoadError("");
        setSubmitting(false);
    }, [
        open,
        maintenanceRequest
            ?.public_id
    ]);

    useEffect(() => {
        if (
            !open ||
            !internalMode
        ) {
            return;
        }

        if (
            canUseTechnicianDropdown
        ) {
            loadTechnicians();
        }
    }, [
        canUseTechnicianDropdown,
        internalMode,
        loadTechnicians,
        open
    ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown =
            event => {
                if (
                    event.key ===
                        "Escape" &&
                    !submitting
                ) {
                    onClose();
                }
            };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
    }, [
        onClose,
        open,
        submitting
    ]);

    const selectedTechnician =
        useMemo(
            () =>
                technicians.find(
                    technician =>
                        technician.public_id ===
                        form.assigned_user_public_id
                ) || null,
            [
                form.assigned_user_public_id,
                technicians
            ]
        );

    if (
        !open ||
        !maintenanceRequest
    ) {
        return null;
    }

    const update = (
        field,
        value
    ) => {
        setForm(
            current => ({
                ...current,
                [field]: value
            })
        );

        if (error) {
            setError("");
        }
    };

    const changeAssignmentType =
        value => {
            setForm({
                ...emptyForm(),
                assignment_type:
                    value
            });

            setError("");
            setTechnicianLoadError(
                ""
            );
        };

    const validate = () => {
        if (
            maintenanceRequest.status !==
            "under_review"
        ) {
            return "A new assignment can only be created while the maintenance request is under review.";
        }

        if (
            !maintenanceRequest.updated_at
        ) {
            return "The maintenance request updated-at timestamp is missing. Close and reopen the request before assigning work.";
        }

        if (internalMode) {
            if (
                !form.assigned_user_public_id
                    .trim()
            ) {
                return "Select or enter an internal technician.";
            }

            if (
                !/^user_[A-Za-z0-9_-]+$/.test(
                    form.assigned_user_public_id
                        .trim()
                )
            ) {
                return "Internal technician public ID is invalid.";
            }

            return "";
        }

        if (
            !form.vendor_name.trim()
        ) {
            return "Vendor name is required.";
        }

        const phone =
            form.phone_number.trim();

        const email =
            form.email.trim();

        if (!phone && !email) {
            return "External vendor requires a phone number or email address.";
        }

        if (
            phone &&
            (
                phone.length < 5 ||
                phone.length > 50
            )
        ) {
            return "Phone number must contain between 5 and 50 characters.";
        }

        if (
            email &&
            (
                email.length > 320 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    email
                )
            )
        ) {
            return "Enter a valid vendor email address.";
        }

        return "";
    };

    const submit =
        async event => {
            event.preventDefault();

            const validationError =
                validate();

            if (validationError) {
                setError(
                    validationError
                );
                return;
            }

            const payload = {
                expected_request_status:
                    "under_review",
                expected_request_updated_at:
                    maintenanceRequest.updated_at,
                assignment_type:
                    form.assignment_type
            };

            if (internalMode) {
                payload.assigned_user_public_id =
                    form.assigned_user_public_id
                        .trim();
            } else {
                payload.vendor_name =
                    form.vendor_name.trim();

                const optionalVendorFields = {
                    company_name:
                        form.company_name.trim(),
                    contact_person:
                        form.contact_person.trim(),
                    phone_number:
                        form.phone_number.trim(),
                    email:
                        form.email.trim(),
                    service_description:
                        form.service_description.trim()
                };

                Object.entries(
                    optionalVendorFields
                ).forEach(
                    ([
                        key,
                        value
                    ]) => {
                        if (value) {
                            payload[key] =
                                value;
                        }
                    }
                );
            }

            const assignmentNotes =
                form.assignment_notes
                    .trim();

            if (assignmentNotes) {
                payload.assignment_notes =
                    assignmentNotes;
            }

            try {
                setSubmitting(true);
                setError("");

                const config = {};

                if (accessContext) {
                    config.params = {
                        access_context:
                            accessContext
                    };
                }

                await apiClient.post(
                    `/maintenance/requests/${encodeURIComponent(
                        maintenanceRequest.public_id
                    )}/assignments`,
                    payload,
                    config
                );

                onCreated();
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
            <form
                onSubmit={submit}
                className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-950">
                            Create Maintenance Assignment
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {maintenanceRequest.request_number ||
                                maintenanceRequest.public_id}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label="Close create maintenance assignment"
                        disabled={submitting}
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                    <div className="space-y-5">
                        {error && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            <p className="font-semibold">
                                Request is ready for assignment
                            </p>

                            <p className="mt-1 text-xs leading-5">
                                Status:{" "}
                                <strong>
                                    {formatLabel(
                                        maintenanceRequest.status
                                    )}
                                </strong>
                                {" • "}Last updated:{" "}
                                <strong>
                                    {formatDateTime(
                                        maintenanceRequest.updated_at
                                    )}
                                </strong>
                            </p>
                        </div>

                        <label className="block">
                            <FieldLabel required>
                                Assignment Type
                            </FieldLabel>

                            <select
                                value={
                                    form.assignment_type
                                }
                                disabled={
                                    submitting
                                }
                                onChange={
                                    event =>
                                        changeAssignmentType(
                                            event
                                                .target
                                                .value
                                        )
                                }
                                className={
                                    inputClassName
                                }
                            >
                                <option value="external_vendor">
                                    External Vendor
                                </option>

                                <option value="internal_technician">
                                    Internal Technician
                                </option>
                            </select>
                        </label>

                        {internalMode ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                {canUseTechnicianDropdown ? (
                                    <label className="block">
                                        <FieldLabel required>
                                            Internal Technician
                                        </FieldLabel>

                                        <select
                                            value={
                                                form.assigned_user_public_id
                                            }
                                            disabled={
                                                techniciansLoading ||
                                                submitting
                                            }
                                            onChange={
                                                event =>
                                                    update(
                                                        "assigned_user_public_id",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        >
                                            <option value="">
                                                {techniciansLoading
                                                    ? "Loading system users..."
                                                    : "Select technician"}
                                            </option>

                                            {technicians.map(
                                                technician => (
                                                    <option
                                                        key={
                                                            technician.public_id
                                                        }
                                                        value={
                                                            technician.public_id
                                                        }
                                                    >
                                                        {technician.full_name}
                                                        {technician.email
                                                            ? ` — ${technician.email}`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        {technicianLoadError && (
                                            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                <span>
                                                    {
                                                        technicianLoadError
                                                    }
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={
                                                        loadTechnicians
                                                    }
                                                    className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    Retry
                                                </button>
                                            </div>
                                        )}

                                        {!techniciansLoading &&
                                            !technicianLoadError &&
                                            technicians.length ===
                                                0 && (
                                                <p className="mt-2 text-xs text-slate-500">
                                                    No regular system user is available in the admin user selector.
                                                </p>
                                            )}

                                        {selectedTechnician && (
                                            <p className="mt-2 text-xs text-emerald-700">
                                                Selected user public ID will be submitted automatically.
                                            </p>
                                        )}
                                    </label>
                                ) : (
                                    <label className="block">
                                        <FieldLabel required>
                                            Internal Technician Public ID
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.assigned_user_public_id
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={50}
                                            placeholder="user_..."
                                            onChange={
                                                event =>
                                                    update(
                                                        "assigned_user_public_id",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />

                                        <p className="mt-2 text-xs leading-5 text-slate-500">
                                            The current general user-list API is admin-only, so owner-context assignment cannot safely browse all system accounts. Enter the authorized technician public ID supplied by your administrator.
                                        </p>
                                    </label>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="block">
                                        <FieldLabel required>
                                            Vendor Name
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.vendor_name
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={255}
                                            placeholder="Vendor or technician name"
                                            onChange={
                                                event =>
                                                    update(
                                                        "vendor_name",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />
                                    </label>

                                    <label className="block">
                                        <FieldLabel>
                                            Company Name
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.company_name
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={255}
                                            placeholder="Company name"
                                            onChange={
                                                event =>
                                                    update(
                                                        "company_name",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />
                                    </label>

                                    <label className="block">
                                        <FieldLabel>
                                            Contact Person
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.contact_person
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={255}
                                            placeholder="Contact person"
                                            onChange={
                                                event =>
                                                    update(
                                                        "contact_person",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />
                                    </label>

                                    <div className="hidden md:block" />

                                    <label className="block">
                                        <FieldLabel>
                                            Phone Number
                                        </FieldLabel>

                                        <input
                                            type="text"
                                            value={
                                                form.phone_number
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={50}
                                            placeholder="+255..."
                                            onChange={
                                                event =>
                                                    update(
                                                        "phone_number",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />
                                    </label>

                                    <label className="block">
                                        <FieldLabel>
                                            Email
                                        </FieldLabel>

                                        <input
                                            type="email"
                                            value={
                                                form.email
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={320}
                                            placeholder="vendor@example.com"
                                            onChange={
                                                event =>
                                                    update(
                                                        "email",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={
                                                inputClassName
                                            }
                                        />
                                    </label>

                                    <p className="text-xs text-slate-500 md:col-span-2">
                                        At least one contact method — phone number or email — is required.
                                    </p>

                                    <label className="block md:col-span-2">
                                        <FieldLabel>
                                            Service Description
                                        </FieldLabel>

                                        <textarea
                                            value={
                                                form.service_description
                                            }
                                            disabled={
                                                submitting
                                            }
                                            maxLength={5000}
                                            rows={4}
                                            placeholder="Describe the service expected from this vendor..."
                                            onChange={
                                                event =>
                                                    update(
                                                        "service_description",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                            }
                                            className={`${inputClassName} min-h-28 resize-y`}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        <label className="block">
                            <FieldLabel>
                                Assignment Notes
                            </FieldLabel>

                            <textarea
                                value={
                                    form.assignment_notes
                                }
                                disabled={
                                    submitting
                                }
                                maxLength={5000}
                                rows={4}
                                placeholder="Optional internal assignment notes..."
                                onChange={
                                    event =>
                                        update(
                                            "assignment_notes",
                                            event
                                                .target
                                                .value
                                        )
                                }
                                className={`${inputClassName} min-h-28 resize-y`}
                            />
                        </label>
                    </div>
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        leftIcon={Plus}
                        disabled={
                            submitting ||
                            techniciansLoading
                        }
                    >
                        {submitting
                            ? "Assigning..."
                            : "Create Assignment"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default CreateMaintenanceAssignmentModal;
