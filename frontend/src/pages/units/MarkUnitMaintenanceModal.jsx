import {
    Wrench,
    X
} from "lucide-react";
import {
    useEffect,
    useState
} from "react";

import apiClient from "../../api/apiClient";
import {
    Button,
    IconButton
} from "../../components/ui/Button";

const errorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to mark unit as maintenance.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function MarkUnitMaintenanceModal({
    open,
    unit,
    property,
    onClose,
    onMarkedMaintenance
}) {
    const [
        submitting,
        setSubmitting
    ] = useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open) {
            setError("");
        }
    }, [open]);

    if (!open || !unit) {
        return null;
    }

    const soldProperty =
        property?.operational_status ===
        "sold";

    const markMaintenance =
        async () => {
            if (soldProperty) {
                setError(
                    "A unit under a sold property cannot be marked as maintenance."
                );
                return;
            }

            try {
                setSubmitting(true);
                setError("");

                /*
                 * Backend validator does not
                 * accept request body fields.
                 */
                await apiClient.patch(
                    `/units/${unit.public_id}/maintenance`
                );

                await onMarkedMaintenance();
            } catch (requestError) {
                setError(
                    errorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(false);
            }
        };

    return (
        <div
            className="
                fixed inset-0 z-50
                flex items-center
                justify-center
                bg-slate-950/45
                p-4
                backdrop-blur-[2px]
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="mark-maintenance-title"
        >
            <div
                className="
                    w-full max-w-lg
                    overflow-hidden
                    rounded-3xl
                    border border-slate-200
                    bg-white
                    shadow-2xl
                "
            >
                <div
                    className="
                        flex items-start
                        justify-between gap-4
                        border-b
                        border-slate-200
                        px-6 py-5
                    "
                >
                    <div
                        className="
                            flex items-start
                            gap-3
                        "
                    >
                        <div
                            className="
                                flex h-11 w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-2xl
                                bg-amber-50
                                text-amber-700
                            "
                        >
                            <Wrench
                                className="
                                    h-5 w-5
                                "
                            />
                        </div>

                        <div>
                            <h2
                                id="mark-maintenance-title"
                                className="
                                    text-xl
                                    font-bold
                                    text-slate-950
                                "
                            >
                                Mark Unit Maintenance
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Confirm the operational
                                status transition.
                            </p>
                        </div>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                <div className="p-6">
                    {error && (
                        <div
                            role="alert"
                            className="
                                mb-5
                                rounded-2xl
                                border
                                border-rose-200
                                bg-rose-50
                                px-4 py-3
                                text-sm
                                text-rose-700
                            "
                        >
                            {error}
                        </div>
                    )}

                    <div
                        className="
                            rounded-2xl
                            border
                            border-slate-200
                            bg-slate-50
                            p-4
                        "
                    >
                        <p
                            className="
                                text-sm
                                font-semibold
                                text-slate-900
                            "
                        >
                            {unit.unit_name ||
                                unit.unit_code}
                        </p>

                        <p
                            className="
                                mt-1
                                text-sm
                                text-slate-500
                            "
                        >
                            {unit.unit_code}
                        </p>

                        <div
                            className="
                                mt-4 grid
                                grid-cols-2
                                gap-3
                            "
                        >
                            <div
                                className="
                                    rounded-xl
                                    bg-white p-3
                                "
                            >
                                <p
                                    className="
                                        text-xs
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-slate-400
                                    "
                                >
                                    Current Status
                                </p>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-semibold
                                        text-slate-800
                                    "
                                >
                                    {formatLabel(
                                        unit
                                            .operational_status
                                    )}
                                </p>
                            </div>

                            <div
                                className="
                                    rounded-xl
                                    bg-white p-3
                                "
                            >
                                <p
                                    className="
                                        text-xs
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-slate-400
                                    "
                                >
                                    New Status
                                </p>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-semibold
                                        text-amber-700
                                    "
                                >
                                    Maintenance
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        className="
                            mt-4
                            rounded-2xl
                            border
                            border-amber-200
                            bg-amber-50
                            px-4 py-3
                            text-sm
                            text-amber-800
                        "
                    >
                        Use this action only when the
                        unit should be removed from
                        normal availability while
                        maintenance work is required.
                    </div>

                    <div
                        className="
                            mt-6 flex
                            flex-col-reverse
                            gap-2
                            sm:flex-row
                            sm:justify-end
                        "
                    >
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="warning"
                            leftIcon={Wrench}
                            loading={submitting}
                            disabled={soldProperty}
                            onClick={
                                markMaintenance
                            }
                        >
                            Mark Maintenance
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MarkUnitMaintenanceModal;
