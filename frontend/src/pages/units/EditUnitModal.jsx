import {
    PencilLine,
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

const UNIT_TYPES = [
    "apartment",
    "house",
    "room",
    "shop",
    "office",
    "warehouse",
    "studio",
    "villa",
    "land_section",
    "commercial_space",
    "other"
];

const AREA_UNITS = [
    "square_meter",
    "square_foot",
    "acre",
    "hectare",
    "other"
];

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, c =>
            c.toUpperCase()
        );

const errorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to update unit.";

const inputClass = `
    h-11 w-full rounded-xl
    border border-slate-200
    bg-slate-50 px-3.5
    text-sm text-slate-800
    outline-none transition
    focus:border-blue-500
    focus:bg-white
    focus:ring-4
    focus:ring-blue-100
`;

const toForm = unit => ({
    unit_code:
        unit?.unit_code || "",
    unit_name:
        unit?.unit_name || "",
    unit_type:
        unit?.unit_type || "",
    floor_number:
        unit?.floor_number ??
        "",
    bedrooms:
        unit?.bedrooms ?? 0,
    bathrooms:
        unit?.bathrooms ?? 0,
    area_size:
        unit?.area_size ??
        "",
    area_unit:
        unit?.area_unit || "",
    description:
        unit?.description || ""
});

function FieldLabel({
    htmlFor,
    required = false,
    children
}) {
    return (
        <label
            htmlFor={htmlFor}
            className="
                mb-2 block
                text-sm font-semibold
                text-slate-700
            "
        >
            {children}
            {required && (
                <span className="text-rose-500">
                    {" "}*
                </span>
            )}
        </label>
    );
}

const equalValue = (
    field,
    formValue,
    unitValue
) => {
    if (
        field === "floor_number" ||
        field === "bedrooms" ||
        field === "bathrooms" ||
        field === "area_size"
    ) {
        const normalizedForm =
            formValue === ""
                ? null
                : Number(formValue);

        const normalizedUnit =
            unitValue === null ||
            unitValue === undefined
                ? null
                : Number(unitValue);

        return (
            normalizedForm ===
            normalizedUnit
        );
    }

    const normalizedForm =
        formValue === ""
            ? null
            : String(formValue).trim();

    const normalizedUnit =
        unitValue === null ||
        unitValue === undefined ||
        unitValue === ""
            ? null
            : String(unitValue).trim();

    return (
        normalizedForm ===
        normalizedUnit
    );
};

function EditUnitModal({
    open,
    unit,
    onClose,
    onUpdated
}) {
    const [form, setForm] =
        useState(() =>
            toForm(unit)
        );
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open && unit) {
            setForm(
                toForm(unit)
            );
            setError("");
        }
    }, [open, unit]);

    if (!open || !unit) {
        return null;
    }

    const update = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));

        if (error) {
            setError("");
        }
    };

    const submit = async event => {
        event.preventDefault();

        const unitCode =
            String(
                form.unit_code || ""
            ).trim();

        if (!unitCode) {
            setError(
                "Unit code is required."
            );
            return;
        }

        if (!form.unit_type) {
            setError(
                "Unit type is required."
            );
            return;
        }

        const hasAreaSize =
            form.area_size !== "";
        const hasAreaUnit =
            form.area_unit !== "";

        if (
            hasAreaSize !==
            hasAreaUnit
        ) {
            setError(
                "Area size and area unit must either both have values or both be empty."
            );
            return;
        }

        const candidate = {
            unit_code: unitCode,
            unit_name:
                String(
                    form.unit_name || ""
                ).trim() || null,
            unit_type:
                form.unit_type,
            floor_number:
                form.floor_number === ""
                    ? null
                    : Number(
                        form.floor_number
                    ),
            bedrooms:
                Number(
                    form.bedrooms || 0
                ),
            bathrooms:
                Number(
                    form.bathrooms || 0
                ),
            area_size:
                hasAreaSize
                    ? Number(
                        form.area_size
                    )
                    : null,
            area_unit:
                hasAreaUnit
                    ? form.area_unit
                    : null,
            description:
                String(
                    form.description || ""
                ).trim() || null
        };

        const payload = {};

        for (
            const [
                field,
                value
            ] of Object.entries(
                candidate
            )
        ) {
            if (
                !equalValue(
                    field,
                    value,
                    unit[field]
                )
            ) {
                payload[field] =
                    value;
            }
        }

        if (
            Object.keys(payload)
                .length === 0
        ) {
            setError(
                "No changes were made."
            );
            return;
        }

        /*
         * Preserve the backend's area-pair
         * integrity when either side changes.
         */
        if (
            Object.prototype
                .hasOwnProperty.call(
                    payload,
                    "area_size"
                ) ||
            Object.prototype
                .hasOwnProperty.call(
                    payload,
                    "area_unit"
                )
        ) {
            payload.area_size =
                candidate.area_size;
            payload.area_unit =
                candidate.area_unit;
        }

        try {
            setSubmitting(true);
            setError("");

            await apiClient.patch(
                `/units/${unit.public_id}`,
                payload
            );

            await onUpdated();
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
            aria-labelledby="edit-unit-title"
        >
            <div
                className="
                    max-h-[92vh]
                    w-full max-w-3xl
                    overflow-y-auto
                    rounded-3xl
                    border border-slate-200
                    bg-white
                    shadow-2xl
                "
            >
                <div
                    className="
                        sticky top-0 z-10
                        flex items-start
                        justify-between
                        gap-4
                        border-b
                        border-slate-200
                        bg-white
                        px-6 py-5
                    "
                >
                    <div>
                        <h2
                            id="edit-unit-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Edit Unit
                        </h2>

                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Update physical and
                            descriptive information for{" "}
                            <span className="font-medium">
                                {unit.unit_code}
                            </span>.
                        </p>
                    </div>

                    <IconButton
                        label="Close"
                        icon={X}
                        onClick={onClose}
                        disabled={submitting}
                    />
                </div>

                <form
                    onSubmit={submit}
                    className="p-6"
                >
                    <div
                        className="
                            mb-6 rounded-2xl
                            border border-slate-200
                            bg-slate-50
                            px-4 py-3
                            text-sm text-slate-600
                        "
                    >
                        Operational status and
                        property assignment are
                        controlled separately and are
                        not changed by this form.
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="
                                mb-6 rounded-2xl
                                border border-rose-200
                                bg-rose-50
                                px-4 py-3
                                text-sm text-rose-700
                            "
                        >
                            {error}
                        </div>
                    )}

                    <div
                        className="
                            grid gap-5
                            md:grid-cols-2
                        "
                    >
                        <div>
                            <FieldLabel
                                htmlFor="edit_unit_code"
                                required
                            >
                                Unit Code
                            </FieldLabel>

                            <input
                                id="edit_unit_code"
                                required
                                maxLength={50}
                                value={
                                    form.unit_code
                                }
                                onChange={e =>
                                    update(
                                        "unit_code",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="edit_unit_type"
                                required
                            >
                                Unit Type
                            </FieldLabel>

                            <select
                                id="edit_unit_type"
                                required
                                value={
                                    form.unit_type
                                }
                                onChange={e =>
                                    update(
                                        "unit_type",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            >
                                {UNIT_TYPES.map(
                                    item => (
                                        <option
                                            key={item}
                                            value={item}
                                        >
                                            {humanize(
                                                item
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <FieldLabel htmlFor="edit_unit_name">
                                Unit Name
                            </FieldLabel>

                            <input
                                id="edit_unit_name"
                                maxLength={150}
                                value={
                                    form.unit_name
                                }
                                onChange={e =>
                                    update(
                                        "unit_name",
                                        e.target.value
                                    )
                                }
                                placeholder="Optional descriptive name"
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="edit_floor_number">
                                Floor Number
                            </FieldLabel>

                            <input
                                id="edit_floor_number"
                                type="number"
                                min="-20"
                                max="300"
                                value={
                                    form.floor_number
                                }
                                onChange={e =>
                                    update(
                                        "floor_number",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="edit_bedrooms">
                                Bedrooms
                            </FieldLabel>

                            <input
                                id="edit_bedrooms"
                                type="number"
                                min="0"
                                max="100"
                                value={
                                    form.bedrooms
                                }
                                onChange={e =>
                                    update(
                                        "bedrooms",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="edit_bathrooms">
                                Bathrooms
                            </FieldLabel>

                            <input
                                id="edit_bathrooms"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={
                                    form.bathrooms
                                }
                                onChange={e =>
                                    update(
                                        "bathrooms",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="edit_area_size">
                                Area Size
                            </FieldLabel>

                            <input
                                id="edit_area_size"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={
                                    form.area_size
                                }
                                onChange={e =>
                                    update(
                                        "area_size",
                                        e.target.value
                                    )
                                }
                                placeholder="Optional"
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="edit_area_unit">
                                Area Unit
                            </FieldLabel>

                            <select
                                id="edit_area_unit"
                                value={
                                    form.area_unit
                                }
                                onChange={e =>
                                    update(
                                        "area_unit",
                                        e.target.value
                                    )
                                }
                                className={
                                    inputClass
                                }
                            >
                                <option value="">
                                    No area unit
                                </option>

                                {AREA_UNITS.map(
                                    item => (
                                        <option
                                            key={item}
                                            value={item}
                                        >
                                            {humanize(
                                                item
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <FieldLabel htmlFor="edit_description">
                                Description
                            </FieldLabel>

                            <textarea
                                id="edit_description"
                                rows="4"
                                maxLength={5000}
                                value={
                                    form.description
                                }
                                onChange={e =>
                                    update(
                                        "description",
                                        e.target.value
                                    )
                                }
                                placeholder="Optional notes about this unit"
                                className="
                                    w-full resize-y
                                    rounded-xl
                                    border border-slate-200
                                    bg-slate-50
                                    px-3.5 py-3
                                    text-sm text-slate-800
                                    outline-none transition
                                    focus:border-blue-500
                                    focus:bg-white
                                    focus:ring-4
                                    focus:ring-blue-100
                                "
                            />
                        </div>
                    </div>

                    <div
                        className="
                            mt-7 flex
                            flex-col-reverse gap-2
                            border-t
                            border-slate-200
                            pt-5
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
                            type="submit"
                            leftIcon={PencilLine}
                            loading={submitting}
                        >
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditUnitModal;
