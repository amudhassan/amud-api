import {
    BellRing,
    RotateCcw,
    Save,
    X
} from "lucide-react";

import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";

import {
    Button
} from "../../components/ui/Button";

const CATEGORY_OPTIONS = [
    ["access", "Access & Security"],
    ["lease", "Lease"],
    ["billing", "Billing"],
    ["payment", "Payment"],
    ["maintenance", "Maintenance"],
    ["preventive_maintenance", "Preventive Maintenance"],
    ["system", "System"]
];

const CHANNEL_OPTIONS = [
    ["in_app", "In App"],
    ["email", "Email"],
    ["sms", "SMS"],
    ["whatsapp", "WhatsApp"],
    ["push", "Push"]
];

const DEFAULT_FORM = {
    notifications_enabled: true,
    channels: {
        in_app: true,
        email: false,
        sms: false,
        whatsapp: false,
        push: false
    },
    minimum_priority: "low",
    digest_frequency: "immediate",
    quiet_hours: {
        enabled: false,
        start: "",
        end: "",
        timezone: "UTC"
    },
    categories: {
        access: true,
        lease: true,
        billing: true,
        payment: true,
        maintenance: true,
        preventive_maintenance: true,
        system: true
    }
};

const getErrorMessage = error =>
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    "Unable to manage notification preferences.";

const extractPreferences = response =>
    response?.data?.data?.preferences ||
    response?.data?.preferences ||
    null;

const normalizeTimeValue = value => {
    if (!value) {
        return "";
    }

    return String(value).slice(0, 5);
};

const makeForm = preferences => ({
    notifications_enabled:
        preferences?.notifications_enabled ??
        DEFAULT_FORM.notifications_enabled,
    channels: {
        ...DEFAULT_FORM.channels,
        ...(preferences?.channels || {})
    },
    minimum_priority:
        preferences?.minimum_priority ||
        DEFAULT_FORM.minimum_priority,
    digest_frequency:
        preferences?.digest_frequency ||
        DEFAULT_FORM.digest_frequency,
    quiet_hours: {
        enabled:
            preferences?.quiet_hours?.enabled ??
            false,
        start: normalizeTimeValue(
            preferences?.quiet_hours?.start
        ),
        end: normalizeTimeValue(
            preferences?.quiet_hours?.end
        ),
        timezone:
            preferences?.quiet_hours?.timezone ||
            "UTC"
    },
    categories: {
        ...DEFAULT_FORM.categories,
        ...(preferences?.categories || {}),
        access: true,
        system: true
    }
});

function ToggleRow({
    label,
    description,
    checked,
    disabled = false,
    onChange
}) {
    return (
        <label
            className={`flex items-start justify-between gap-4 rounded-xl border p-3 ${
                disabled
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-200 bg-white"
            }`}
        >
            <span>
                <span className="block text-sm font-semibold text-slate-800">
                    {label}
                </span>
                {description ? (
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {description}
                    </span>
                ) : null}
            </span>

            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={event =>
                    onChange(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
            />
        </label>
    );
}

function NotificationPreferencesModal({
    open,
    onClose,
    onSaved
}) {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] =
        useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        let active = true;

        const loadPreferences = async () => {
            setLoading(true);
            setError("");
            setSuccessMessage("");

            try {
                const response = await apiClient.get(
                    "/notifications/preferences"
                );

                if (!active) {
                    return;
                }

                setForm(
                    makeForm(
                        extractPreferences(response)
                    )
                );
            } catch (loadError) {
                if (active) {
                    setError(
                        getErrorMessage(loadError)
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadPreferences();

        return () => {
            active = false;
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = event => {
            if (
                event.key === "Escape" &&
                !saving &&
                !resetting
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
        resetting,
        saving
    ]);

    if (!open) {
        return null;
    }

    const updateTopLevel = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
        setError("");
        setSuccessMessage("");
    };

    const updateChannel = (channel, value) => {
        setForm(current => ({
            ...current,
            channels: {
                ...current.channels,
                [channel]: value
            }
        }));
        setError("");
        setSuccessMessage("");
    };

    const updateCategory = (category, value) => {
        if (
            category === "access" ||
            category === "system"
        ) {
            return;
        }

        setForm(current => ({
            ...current,
            categories: {
                ...current.categories,
                [category]: value,
                access: true,
                system: true
            }
        }));
        setError("");
        setSuccessMessage("");
    };

    const updateQuietHours = (field, value) => {
        setForm(current => ({
            ...current,
            quiet_hours: {
                ...current.quiet_hours,
                [field]: value,
                ...(field === "enabled" && value === false
                    ? {
                        start: "",
                        end: ""
                    }
                    : {})
            }
        }));
        setError("");
        setSuccessMessage("");
    };

    const savePreferences = async event => {
        event.preventDefault();

        if (
            form.quiet_hours.enabled &&
            (!form.quiet_hours.start ||
                !form.quiet_hours.end)
        ) {
            setError(
                "Quiet hours require both a start and end time."
            );
            return;
        }

        if (
            form.quiet_hours.enabled &&
            form.quiet_hours.start ===
                form.quiet_hours.end
        ) {
            setError(
                "Quiet-hours start and end times must be different."
            );
            return;
        }

        const quietHours = {
            enabled: form.quiet_hours.enabled,
            timezone:
                form.quiet_hours.timezone.trim() ||
                "UTC"
        };

        if (form.quiet_hours.enabled) {
            quietHours.start = form.quiet_hours.start;
            quietHours.end = form.quiet_hours.end;
        }

        const payload = {
            notifications_enabled:
                form.notifications_enabled,
            channels: {
                ...form.channels
            },
            minimum_priority:
                form.minimum_priority,
            digest_frequency:
                form.digest_frequency,
            quiet_hours: quietHours,
            categories: {
                ...form.categories,
                access: true,
                system: true
            }
        };

        setSaving(true);
        setError("");
        setSuccessMessage("");

        try {
            const response = await apiClient.patch(
                "/notifications/preferences",
                payload
            );

            const preferences =
                extractPreferences(response);

            if (preferences) {
                setForm(makeForm(preferences));
            }

            setSuccessMessage(
                response?.data?.message ||
                "Notification preferences saved successfully."
            );

            if (onSaved) {
                onSaved(preferences);
            }
        } catch (saveError) {
            setError(getErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    };

    const resetPreferences = async () => {
        setResetting(true);
        setError("");
        setSuccessMessage("");

        try {
            const response = await apiClient.patch(
                "/notifications/preferences/reset"
            );

            const preferences =
                extractPreferences(response);

            setForm(makeForm(preferences));
            setSuccessMessage(
                response?.data?.message ||
                "Notification preferences reset successfully."
            );

            if (onSaved) {
                onSaved(preferences);
            }
        } catch (resetError) {
            setError(getErrorMessage(resetError));
        } finally {
            setResetting(false);
        }
    };

    const busy = loading || saving || resetting;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <BellRing className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Notification Preferences
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Control notification delivery, priority, quiet hours and categories.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={saving || resetting}
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        aria-label="Close notification preferences"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={savePreferences}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                        {error ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error}
                            </div>
                        ) : null}

                        {successMessage ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {successMessage}
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                                Loading notification preferences...
                            </div>
                        ) : (
                            <>
                                <section className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            General
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Use the master switch to enable or disable optional notifications for your account.
                                        </p>
                                    </div>

                                    <ToggleRow
                                        label="Notifications Enabled"
                                        description="Master preference for notification delivery. Mandatory access and critical-system rules remain backend controlled."
                                        checked={form.notifications_enabled}
                                        onChange={value =>
                                            updateTopLevel(
                                                "notifications_enabled",
                                                value
                                            )
                                        }
                                    />
                                </section>

                                <section className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            Delivery Channels
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Choose the channels you want enabled in your preference profile.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {CHANNEL_OPTIONS.map(
                                            ([channel, label]) => (
                                                <ToggleRow
                                                    key={channel}
                                                    label={label}
                                                    checked={
                                                        form.channels[channel]
                                                    }
                                                    onChange={value =>
                                                        updateChannel(
                                                            channel,
                                                            value
                                                        )
                                                    }
                                                />
                                            )
                                        )}
                                    </div>
                                </section>

                                <section className="grid gap-4 md:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Minimum Priority
                                        </span>
                                        <select
                                            value={form.minimum_priority}
                                            onChange={event =>
                                                updateTopLevel(
                                                    "minimum_priority",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        >
                                            <option value="low">Low</option>
                                            <option value="normal">Normal</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Digest Frequency
                                        </span>
                                        <select
                                            value={form.digest_frequency}
                                            onChange={event =>
                                                updateTopLevel(
                                                    "digest_frequency",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        >
                                            <option value="immediate">Immediate</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="disabled">Disabled</option>
                                        </select>
                                    </label>
                                </section>

                                <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <ToggleRow
                                        label="Quiet Hours"
                                        description="When enabled, provide different start and end times using your selected timezone."
                                        checked={form.quiet_hours.enabled}
                                        onChange={value =>
                                            updateQuietHours(
                                                "enabled",
                                                value
                                            )
                                        }
                                    />

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Start
                                            </span>
                                            <input
                                                type="time"
                                                value={form.quiet_hours.start}
                                                disabled={!form.quiet_hours.enabled}
                                                onChange={event =>
                                                    updateQuietHours(
                                                        "start",
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                End
                                            </span>
                                            <input
                                                type="time"
                                                value={form.quiet_hours.end}
                                                disabled={!form.quiet_hours.enabled}
                                                onChange={event =>
                                                    updateQuietHours(
                                                        "end",
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Timezone
                                            </span>
                                            <input
                                                type="text"
                                                maxLength={64}
                                                value={form.quiet_hours.timezone}
                                                onChange={event =>
                                                    updateQuietHours(
                                                        "timezone",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="UTC"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            Categories
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Access & Security and System are mandatory categories and cannot be disabled.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {CATEGORY_OPTIONS.map(
                                            ([category, label]) => {
                                                const mandatory =
                                                    category === "access" ||
                                                    category === "system";

                                                return (
                                                    <ToggleRow
                                                        key={category}
                                                        label={label}
                                                        description={
                                                            mandatory
                                                                ? "Mandatory"
                                                                : "Optional category"
                                                        }
                                                        checked={
                                                            mandatory
                                                                ? true
                                                                : form.categories[category]
                                                        }
                                                        disabled={mandatory}
                                                        onChange={value =>
                                                            updateCategory(
                                                                category,
                                                                value
                                                            )
                                                        }
                                                    />
                                                );
                                            }
                                        )}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            type="button"
                            variant="secondary"
                            leftIcon={RotateCcw}
                            disabled={busy}
                            onClick={resetPreferences}
                        >
                            {resetting
                                ? "Resetting..."
                                : "Reset Defaults"}
                        </Button>

                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={saving || resetting}
                                onClick={onClose}
                            >
                                Close
                            </Button>

                            <Button
                                type="submit"
                                leftIcon={Save}
                                disabled={busy}
                            >
                                {saving
                                    ? "Saving..."
                                    : "Save Preferences"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NotificationPreferencesModal;
