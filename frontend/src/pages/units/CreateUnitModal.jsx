import {
    Plus,
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

const emptyForm = () => ({
    unit_code: "",
    unit_name: "",
    unit_type: "",
    floor_number: "",
    bedrooms: "0",
    bathrooms: "0",
    area_size: "",
    area_unit: "",
    description: ""
});

const humanize = value =>
    String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, c =>
            c.toUpperCase()
        );

const errorMessage = error =>
    error?.response?.data?.message ||
    error?.message ||
    "Unable to create unit.";

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

function CreateUnitModal({
    open,
    property,
    onClose,
    onCreated
}) {
    const [form, setForm] =
        useState(emptyForm);
    const [submitting, setSubmitting] =
        useState(false);
    const [error, setError] =
        useState("");

    useEffect(() => {
        if (open) {
            setForm(emptyForm());
            setError("");
        }
    }, [open, property?.public_id]);

    if (!open || !property) {
        return null;
    }

    const update = (field, value) => {
        setForm(current => ({
            ...current,
            [field]: value
        }));
        if (error) setError("");
    };

    const submit = async event => {
        event.preventDefault();

        const unitCode =
            form.unit_code.trim();

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

        const hasArea =
            form.area_size !== "";
        const hasAreaUnit =
            form.area_unit !== "";

        if (hasArea !== hasAreaUnit) {
            setError(
                "Area size and area unit must be supplied together."
            );
            return;
        }

        const payload = {
            unit_code: unitCode,
            unit_type: form.unit_type,
            bedrooms:
                Number(form.bedrooms || 0),
            bathrooms:
                Number(form.bathrooms || 0)
        };

        const unitName =
            form.unit_name.trim();
        const description =
            form.description.trim();

        if (unitName) {
            payload.unit_name =
                unitName;
        }

        if (form.floor_number !== "") {
            payload.floor_number =
                Number(
                    form.floor_number
                );
        }

        if (hasArea) {
            payload.area_size =
                Number(form.area_size);
            payload.area_unit =
                form.area_unit;
        }

        if (description) {
            payload.description =
                description;
        }

        try {
            setSubmitting(true);
            setError("");

            await apiClient.post(
                `/properties/${property.public_id}/units`,
                payload
            );

            await onCreated();
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
            aria-labelledby="create-unit-title"
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
                            id="create-unit-title"
                            className="
                                text-xl font-bold
                                text-slate-950
                            "
                        >
                            Add Unit
                        </h2>
                        <p
                            className="
                                mt-1 text-sm
                                text-slate-500
                            "
                        >
                            Create a unit under{" "}
                            <span className="font-medium">
                                {property.property_name}
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
                            border border-blue-100
                            bg-blue-50/70
                            px-4 py-3
                            text-sm text-blue-800
                        "
                    >
                        New units start in{" "}
                        <strong>Inactive</strong>{" "}
                        status. Activation is a
                        separate controlled action.
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
                                htmlFor="unit_code"
                                required
                            >
                                Unit Code
                            </FieldLabel>
                            <input
                                id="unit_code"
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
                                placeholder="e.g. A-101"
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel
                                htmlFor="unit_type"
                                required
                            >
                                Unit Type
                            </FieldLabel>
                            <select
                                id="unit_type"
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
                                <option value="">
                                    Select unit type
                                </option>
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
                            <FieldLabel htmlFor="unit_name">
                                Unit Name
                            </FieldLabel>
                            <input
                                id="unit_name"
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
                            <FieldLabel htmlFor="floor_number">
                                Floor Number
                            </FieldLabel>
                            <input
                                id="floor_number"
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
                                placeholder="Optional"
                                className={
                                    inputClass
                                }
                            />
                        </div>

                        <div>
                            <FieldLabel htmlFor="bedrooms">
                                Bedrooms
                            </FieldLabel>
                            <input
                                id="bedrooms"
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
                            <FieldLabel htmlFor="bathrooms">
                                Bathrooms
                            </FieldLabel>
                            <input
                                id="bathrooms"
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
                            <FieldLabel htmlFor="area_size">
                                Area Size
                            </FieldLabel>
                            <input
                                id="area_size"
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
                            <FieldLabel htmlFor="area_unit">
                                Area Unit
                            </FieldLabel>
                            <select
                                id="area_unit"
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
                                    Select area unit
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
                            <FieldLabel htmlFor="description">
                                Description
                            </FieldLabel>
                            <textarea
                                id="description"
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
                            leftIcon={Plus}
                            loading={submitting}
                        >
                            Create Unit
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateUnitModal;
