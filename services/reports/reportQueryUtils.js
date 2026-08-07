const createConditionBuilder = () => {
    const values = [];

    const addValue = value => {
        values.push(value);
        return `$${values.length}`;
    };

    return {
        values,
        addValue
    };
};

const normalizeAmount = value => {
    if (value === null || value === undefined) {
        return "0.00";
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue)
        ? numericValue.toFixed(2)
        : "0.00";
};

const normalizeDecimal = (
    value,
    fractionDigits = 2
) => {
    if (value === null || value === undefined) {
        return null;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue)
        ? numericValue.toFixed(fractionDigits)
        : null;
};

const buildReportContext = ({
    scope,
    filters,
    extraFilters = {}
}) => ({
    access_type: scope.access_type,
    selected_owner: scope.selected_owner,
    selected_property: scope.selected_property,
    filters: {
        owner_public_id:
            filters.owner_public_id || null,
        property_public_id:
            filters.property_public_id || null,
        date_from:
            filters.date_from || null,
        date_to:
            filters.date_to || null,
        currency_code:
            filters.currency_code || null,
        ...extraFilters
    }
});

const isScopeFailure = scope => (
    scope.forbidden ||
    scope.ownerNotFound ||
    scope.propertyNotFound
);

module.exports = {
    createConditionBuilder,
    normalizeAmount,
    normalizeDecimal,
    buildReportContext,
    isScopeFailure
};
