import {
    Trash2,
    TriangleAlert,
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
    "Unable to delete unit.";

const formatLabel = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );

function DeleteUnitModal({
    open,
    unit,
    property,
    onClose,
    onDeleted
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

    const protectedStatus = [
        "reserved",
        "occupied"
    ].includes(
        unit.operational_status
    );

    const soldProperty =
        property?.operational_status ===
        "sold";

    const blocked =
        protectedStatus ||
        soldProperty;

    const deleteUnit = async () => {
        if (protectedStatus) {
            setError(
                `A ${unit.operational_status} unit cannot be deleted.`
            );
            return;
        }

        if (soldProperty) {
            setError(
                "A unit under a sold property cannot be deleted."
            );
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            /*
             * DELETE /api/units/:unit_public_id
             * Backend validator does not accept
             * request body fields.
             */
            await apiClient.delete(
                `/units/${unit.public_id}`
            );

            onDeleted();
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
            aria-labelledby="delete-unit-title"
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
                                bg-rose-50
                                text-rose-700
                            "
                        >
                            <TriangleAlert
                                className="
                                    h-5 w-5
                                "
                            />
                        </div>

                        <div>
                            <h2
                                id="delete-unit-title"
                                className="
                                    text-xl
                                    font-bold
                                    text-slate-950
                                "
                            >
                                Delete Unit
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    text-slate-500
                                "
                            >
                                Confirm this soft-delete
                                operation.
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
                                    Delete Type
                                </p>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-semibold
                                        text-rose-700
                                    "
                                >
                                    Soft Delete
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        className="
                            mt-4
                            rounded-2xl
                            border
                            border-rose-200
                            bg-rose-50
                            px-4 py-3
                            text-sm
                            text-rose-800
                        "
                    >
                        This removes the unit from
                        current unit records. The
                        backend preserves it as a
                        soft-deleted record and forces
                        its operational status to
                        Inactive.
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
                            variant="dangerSolid"
                            leftIcon={Trash2}
                            loading={submitting}
                            disabled={blocked}
                            onClick={deleteUnit}
                        >
                            Delete Unit
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DeleteUnitModal;
