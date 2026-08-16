import {
    CalendarClock,
    RefreshCw,
    Save,
    X
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import { Button } from "../../components/ui/Button";

const CATEGORIES = [
    "plumbing", "electrical", "appliance", "structural", "roofing",
    "painting", "doors_windows", "security", "water_supply", "sanitation",
    "pest_control", "internet_communication", "cleaning", "common_area", "other"
];

const PRIORITIES = ["low", "medium", "high", "emergency"];
const IMPACT_LEVELS = ["no_operational_impact", "partially_restricted", "uninhabitable"];
const ACCESS_INSTRUCTIONS = ["", "contact_first", "tenant_must_be_present", "authorized_entry"];
const FREQUENCIES = ["one_time", "weekly", "monthly", "quarterly", "semi_annual", "annual", "custom"];

const inputClassName = `
    mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5
    text-sm text-slate-900 outline-none transition placeholder:text-slate-400
    focus:border-blue-500 focus:ring-2 focus:ring-blue-100
    disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500
`;

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character => character.toUpperCase());

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to update preventive maintenance plan.";

const toLocalDateTimeInput = value => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
};

const toIsoTimestamp = value => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const formFromPlan = plan => ({
    title: plan?.title || "",
    description: plan?.description || "",
    category: plan?.category || "",
    priority: plan?.priority || "medium",
    impact_level: plan?.impact_level || "no_operational_impact",
    location_details: plan?.location_details || "",
    access_instruction: plan?.access_instruction || "",
    frequency: plan?.schedule?.frequency || "monthly",
    interval_value: String(plan?.schedule?.interval_value ?? 1),
    custom_interval_days:
        plan?.schedule?.custom_interval_days === null ||
        plan?.schedule?.custom_interval_days === undefined
            ? ""
            : String(plan.schedule.custom_interval_days),
    next_due_at: toLocalDateTimeInput(plan?.schedule?.next_due_at),
    estimated_cost: String(plan?.estimated_cost ?? 0),
    currency_code: plan?.currency_code || "TZS"
});

function FieldLabel({ children, required = false }) {
    return (
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {children}{required && <span className="text-rose-500"> *</span>}
        </span>
    );
}

function EditPreventiveMaintenancePlanModal({
    open,
    planPublicId,
    isAdmin = false,
    onClose,
    onUpdated
}) {
    const [plan, setPlan] = useState(null);
    const [form, setForm] = useState(formFromPlan(null));
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const update = (field, value) => {
        setForm(current => ({ ...current, [field]: value }));
        if (error) setError("");
    };

    const loadPlan = useCallback(async () => {
        if (!open || !planPublicId) return;

        try {
            setLoading(true);
            setError("");

            const params = {};
            if (!isAdmin) params.access_context = "owner";

            const response = await apiClient.get(
                `/maintenance/preventive-plans/${planPublicId}`,
                { params }
            );

            const loaded = response?.data?.data?.preventive_plan || null;
            setPlan(loaded);
            setForm(formFromPlan(loaded));
        } catch (requestError) {
            setPlan(null);
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [isAdmin, open, planPublicId]);

    useEffect(() => {
        if (open) loadPlan();
        else {
            setPlan(null);
            setError("");
            setSubmitting(false);
        }
    }, [loadPlan, open]);

    useEffect(() => {
        if (form.frequency === "one_time") {
            setForm(current => ({ ...current, interval_value: "1", custom_interval_days: "" }));
        } else if (form.frequency !== "custom") {
            setForm(current => ({ ...current, custom_interval_days: "" }));
        }
    }, [form.frequency]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = event => {
            if (event.key === "Escape" && !submitting) onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, open, submitting]);

    if (!open) return null;

    const validate = () => {
        if (form.title.trim().length < 3 || form.title.trim().length > 255) {
            return "Title must contain between 3 and 255 characters.";
        }
        if (form.description.trim().length < 10 || form.description.trim().length > 5000) {
            return "Description must contain between 10 and 5000 characters.";
        }
        if (!CATEGORIES.includes(form.category)) return "Maintenance category is required.";

        const interval = Number(form.interval_value);
        if (!Number.isInteger(interval) || interval < 1) {
            return "Interval value must be a positive whole number.";
        }
        if (form.frequency === "one_time" && interval !== 1) {
            return "One-time plans must use interval 1.";
        }
        if (form.frequency === "custom") {
            const customDays = Number(form.custom_interval_days);
            if (!Number.isInteger(customDays) || customDays < 1) {
                return "Custom interval days must be a positive whole number.";
            }
        }

        const nextDue = toIsoTimestamp(form.next_due_at);
        if (!nextDue) return "Next due date and time is required.";

        const estimatedCost = Number(form.estimated_cost);
        if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
            return "Estimated cost must be zero or greater.";
        }
        if (!/^[A-Z]{3}$/.test(form.currency_code.trim().toUpperCase())) {
            return "Currency code must contain exactly three uppercase letters.";
        }
        if (plan?.request_scope === "property_common_area" && !form.location_details.trim()) {
            return "Location details are required for a property common-area plan.";
        }
        return "";
    };

    const submit = async event => {
        event.preventDefault();

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!plan?.updated_at) {
            setError("The plan update timestamp is unavailable. Refresh the plan and try again.");
            return;
        }

        const payload = {
            expected_updated_at: plan.updated_at,
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            priority: form.priority,
            impact_level: form.impact_level,
            location_details: form.location_details.trim() || null,
            access_instruction: form.access_instruction || null,
            frequency: form.frequency,
            interval_value: Number(form.interval_value),
            custom_interval_days:
                form.frequency === "custom"
                    ? Number(form.custom_interval_days)
                    : null,
            next_due_at: toIsoTimestamp(form.next_due_at),
            estimated_cost: Number(form.estimated_cost),
            currency_code: form.currency_code.trim().toUpperCase()
        };

        try {
            setSubmitting(true);
            setError("");

            const params = {};
            if (!isAdmin) params.access_context = "owner";

            const response = await apiClient.patch(
                `/maintenance/preventive-plans/${plan.public_id}`,
                payload,
                { params }
            );

            const updatedPlan = response?.data?.data?.preventive_plan || null;
            onUpdated?.(updatedPlan);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    };

    const immutableLocation = plan
        ? `${plan.owner?.display_name || "—"} · ${plan.property?.property_name || plan.property?.property_code || "—"} · ${plan.unit?.unit_name || plan.unit?.unit_code || formatLabel(plan.request_scope)}`
        : "—";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <div className="max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-950">Edit Preventive Plan</h2>
                            <p className="mt-1 text-sm text-slate-500">{immutableLocation}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={submit} className="max-h-[calc(94vh-82px)] overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {loading || !plan ? (
                        <div className="py-16 text-center">
                            <p className="text-sm text-slate-500">
                                {loading ? "Loading preventive maintenance plan..." : "Plan detail is unavailable."}
                            </p>
                            {!loading && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={RefreshCw}
                                    className="mt-4"
                                    onClick={loadPlan}
                                >
                                    Retry
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Owner, property, unit and scope are fixed for this plan. This edit updates the plan definition and schedule only.
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                                <label className="md:col-span-2">
                                    <FieldLabel required>Title</FieldLabel>
                                    <input className={inputClassName} value={form.title} onChange={e => update("title", e.target.value)} />
                                </label>

                                <label className="md:col-span-2">
                                    <FieldLabel required>Description</FieldLabel>
                                    <textarea rows={4} className={inputClassName} value={form.description} onChange={e => update("description", e.target.value)} />
                                </label>

                                <label>
                                    <FieldLabel required>Category</FieldLabel>
                                    <select className={inputClassName} value={form.category} onChange={e => update("category", e.target.value)}>
                                        {CATEGORIES.map(value => <option key={value} value={value}>{formatLabel(value)}</option>)}
                                    </select>
                                </label>

                                <label>
                                    <FieldLabel required>Priority</FieldLabel>
                                    <select className={inputClassName} value={form.priority} onChange={e => update("priority", e.target.value)}>
                                        {PRIORITIES.map(value => <option key={value} value={value}>{formatLabel(value)}</option>)}
                                    </select>
                                </label>

                                <label>
                                    <FieldLabel required>Impact Level</FieldLabel>
                                    <select className={inputClassName} value={form.impact_level} onChange={e => update("impact_level", e.target.value)}>
                                        {IMPACT_LEVELS.map(value => <option key={value} value={value}>{formatLabel(value)}</option>)}
                                    </select>
                                </label>

                                <label>
                                    <FieldLabel>Access Instruction</FieldLabel>
                                    <select className={inputClassName} value={form.access_instruction} onChange={e => update("access_instruction", e.target.value)}>
                                        {ACCESS_INSTRUCTIONS.map(value => <option key={value || "none"} value={value}>{value ? formatLabel(value) : "None"}</option>)}
                                    </select>
                                </label>

                                <label className="md:col-span-2">
                                    <FieldLabel required={plan.request_scope === "property_common_area"}>Location Details</FieldLabel>
                                    <input className={inputClassName} value={form.location_details} onChange={e => update("location_details", e.target.value)} />
                                </label>

                                <label>
                                    <FieldLabel required>Frequency</FieldLabel>
                                    <select className={inputClassName} value={form.frequency} onChange={e => update("frequency", e.target.value)}>
                                        {FREQUENCIES.map(value => <option key={value} value={value}>{formatLabel(value)}</option>)}
                                    </select>
                                </label>

                                <label>
                                    <FieldLabel required>Interval</FieldLabel>
                                    <input type="number" min="1" step="1" disabled={form.frequency === "one_time"} className={inputClassName} value={form.interval_value} onChange={e => update("interval_value", e.target.value)} />
                                </label>

                                {form.frequency === "custom" && (
                                    <label>
                                        <FieldLabel required>Custom Interval Days</FieldLabel>
                                        <input type="number" min="1" step="1" className={inputClassName} value={form.custom_interval_days} onChange={e => update("custom_interval_days", e.target.value)} />
                                    </label>
                                )}

                                <label>
                                    <FieldLabel required>Next Due</FieldLabel>
                                    <input type="datetime-local" className={inputClassName} value={form.next_due_at} onChange={e => update("next_due_at", e.target.value)} />
                                </label>

                                <label>
                                    <FieldLabel required>Estimated Cost</FieldLabel>
                                    <input type="number" min="0" step="0.01" className={inputClassName} value={form.estimated_cost} onChange={e => update("estimated_cost", e.target.value)} />
                                </label>

                                <label>
                                    <FieldLabel required>Currency</FieldLabel>
                                    <input maxLength={3} className={inputClassName} value={form.currency_code} onChange={e => update("currency_code", e.target.value.toUpperCase())} />
                                </label>
                            </div>

                            <div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
                                <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" leftIcon={Save} disabled={submitting}>
                                    {submitting ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

export default EditPreventiveMaintenancePlanModal;
