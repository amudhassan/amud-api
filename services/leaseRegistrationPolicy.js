/** Explicit registration of a current tenancy that started before data entry.
 * This does not create invoices, payments or backdate the scheduling audit.
 * Inputs are DATE values returned by PostgreSQL, or ISO date-only strings.
 */
const dateOnly = (value) =>
    value instanceof Date
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
        : String(value || "").slice(0, 10);

const evaluateLeaseRegistration = ({
    startDate,
    endDate,
    currentDate,
    role,
    registrationRequested,
    reason,
}) => {
    const start = dateOnly(startDate);
    const end = dateOnly(endDate);
    const today = dateOnly(currentDate);
    if (
        registrationRequested !== undefined &&
        typeof registrationRequested !== "boolean"
    ) {
        return { existingTenancyInvalidRequest: true };
    }
    if (registrationRequested === true) {
        if (role !== "admin") return { existingTenancyForbidden: true };
        if (
            typeof reason !== "string" ||
            reason.trim().length < 10 ||
            reason.trim().length > 1000
        ) {
            return { existingTenancyReasonRequired: true };
        }
        if (
            ![start, end, today].every((value) =>
                /^\d{4}-\d{2}-\d{2}$/.test(value),
            ) ||
            start >= end ||
            start >= today ||
            end < today
        ) {
            return { existingTenancyDateInvalid: true };
        }
        return {
            registrationNote: `Existing tenancy registered on ${today}; original start date ${start}. Reason: ${reason.trim()}`,
        };
    }
    if (reason !== undefined) return { existingTenancyInvalidRequest: true };
    if (start < today) return { pastStartDate: true };
    return { registrationNote: null };
};
module.exports = { evaluateLeaseRegistration };
