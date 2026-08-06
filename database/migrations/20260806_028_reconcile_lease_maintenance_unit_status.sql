BEGIN;

-- =========================================================
-- LEASE / MAINTENANCE UNIT-STATUS RECONCILIATION
-- Allows a leased unit to enter temporary maintenance status
-- only while a valid active maintenance lock exists.
-- =========================================================

CREATE OR REPLACE FUNCTION
validate_lease_integrity(
    p_lease_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_lease RECORD;
    v_previous_lease RECORD;
    v_has_active_maintenance_lock BOOLEAN;
BEGIN
    IF p_lease_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        lease_record.id,
        lease_record.owner_id,
        lease_record.property_id,
        lease_record.unit_id,
        lease_record.tenant_id,
        lease_record.renewed_from_lease_id,
        lease_record.status,
        lease_record.start_date,
        lease_record.end_date,

        owner_record.status
            AS owner_status,
        owner_record.deleted_at
            AS owner_deleted_at,

        property_record.operational_status
            AS property_status,
        property_record.deleted_at
            AS property_deleted_at,

        unit_record.property_id
            AS unit_property_id,
        unit_record.operational_status
            AS unit_status,
        unit_record.deleted_at
            AS unit_deleted_at,

        tenant_record.status
            AS tenant_status,
        tenant_record.deleted_at
            AS tenant_deleted_at

    INTO v_lease

    FROM leases AS lease_record

    INNER JOIN owners AS owner_record
        ON owner_record.id =
            lease_record.owner_id

    INNER JOIN properties AS property_record
        ON property_record.id =
            lease_record.property_id

    INNER JOIN units AS unit_record
        ON unit_record.id =
            lease_record.unit_id

    INNER JOIN tenants AS tenant_record
        ON tenant_record.id =
            lease_record.tenant_id

    WHERE lease_record.id =
        p_lease_id

    FOR UPDATE OF
        lease_record,
        owner_record,
        property_record,
        unit_record,
        tenant_record;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    /*
     * Historical closed leases may continue
     * referencing records that are later closed.
     */
    IF v_lease.status NOT IN (
        'draft',
        'scheduled',
        'active'
    ) THEN
        RETURN;
    END IF;

    /*
     * Active lease records cannot reference
     * soft-deleted business records.
     */
    IF v_lease.owner_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A current lease cannot reference a deleted owner.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.property_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A current lease cannot reference a deleted property.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.unit_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A current lease cannot reference a deleted unit.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.tenant_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'A current lease cannot reference a deleted tenant.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Unit must belong to the selected property.
     */
    IF v_lease.unit_property_id <>
        v_lease.property_id
    THEN
        RAISE EXCEPTION
            'Lease unit does not belong to the selected property.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Owner must currently own the property.
     */
    PERFORM 1
    FROM property_owners
    WHERE property_id =
        v_lease.property_id
      AND owner_id =
        v_lease.owner_id
      AND effective_to IS NULL
      AND effective_from <=
        v_lease.start_date
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Lease owner does not have a current ownership relationship with the property.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Tenant must have an active relationship
     * with the lease owner.
     */
    PERFORM 1
    FROM owner_tenants
    WHERE owner_id =
        v_lease.owner_id
      AND tenant_id =
        v_lease.tenant_id
      AND relationship_status =
        'active'
      AND ended_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Lease tenant does not have an active relationship with the owner.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Current business parties must remain active.
     */
    IF v_lease.owner_status <> 'active' THEN
        RAISE EXCEPTION
            'Current lease owner must be active.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.property_status <> 'active' THEN
        RAISE EXCEPTION
            'Current lease property must be active.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.tenant_status <> 'active' THEN
        RAISE EXCEPTION
            'Current lease tenant must be active.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * A maintenance unit-status lock temporarily overrides
     * the normal lease-bound unit status. The lock is safe
     * because maintenance integrity validates that it belongs
     * to an uninhabitable unit request for this same unit.
     */
    SELECT EXISTS (
        SELECT 1
        FROM maintenance_unit_status_locks AS musl
        WHERE musl.unit_id = v_lease.unit_id
          AND musl.is_active = TRUE
    )
    INTO v_has_active_maintenance_lock;

    /*
     * Draft does not reserve or occupy a unit.
     */
    IF v_lease.status = 'draft' THEN
        -- No binding unit-status requirement.
        NULL;
    END IF;

    /*
     * Scheduled future lease may use an occupied unit if the
     * current lease ends before it starts. A temporary
     * maintenance status is also valid while an active
     * maintenance unit-status lock exists.
     */
    IF v_lease.status = 'scheduled'
       AND NOT (
           v_lease.unit_status IN (
               'available',
               'reserved',
               'occupied'
           )
           OR (
               v_lease.unit_status = 'maintenance'
               AND v_has_active_maintenance_lock = TRUE
           )
       )
    THEN
        RAISE EXCEPTION
            'Scheduled lease unit must be available, reserved, occupied, or temporarily under an active maintenance lock.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * An active lease normally requires an occupied unit.
     * Maintenance is permitted only as a temporary override
     * backed by an active maintenance unit-status lock.
     */
    IF v_lease.status = 'active'
       AND NOT (
           v_lease.unit_status = 'occupied'
           OR (
               v_lease.unit_status = 'maintenance'
               AND v_has_active_maintenance_lock = TRUE
           )
       )
    THEN
        RAISE EXCEPTION
            'Active lease unit must be occupied or temporarily under an active maintenance lock.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Renewal integrity.
     */
    IF v_lease.renewed_from_lease_id IS NOT NULL THEN
        IF v_lease.renewed_from_lease_id =
            v_lease.id
        THEN
            RAISE EXCEPTION
                'A lease cannot renew itself.'
            USING ERRCODE = '23514';
        END IF;

        SELECT
            owner_id,
            property_id,
            unit_id,
            tenant_id,
            end_date

        INTO v_previous_lease

        FROM leases

        WHERE id =
            v_lease.renewed_from_lease_id

        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Renewal source lease was not found.'
            USING ERRCODE = '23514';
        END IF;

        IF v_previous_lease.owner_id <>
            v_lease.owner_id
            OR v_previous_lease.property_id <>
                v_lease.property_id
            OR v_previous_lease.unit_id <>
                v_lease.unit_id
            OR v_previous_lease.tenant_id <>
                v_lease.tenant_id
        THEN
            RAISE EXCEPTION
                'Renewal must preserve owner, property, unit and tenant.'
            USING ERRCODE = '23514';
        END IF;

        IF v_lease.start_date <=
            v_previous_lease.end_date
        THEN
            RAISE EXCEPTION
                'Renewal must start after the previous lease ends.'
            USING ERRCODE = '23514';
        END IF;
    END IF;
END;
$$;


COMMENT ON FUNCTION validate_lease_integrity(BIGINT) IS
'Validates current lease relationships and lifecycle integrity. Active or scheduled leases may temporarily reference a unit in maintenance status only while an active maintenance unit-status lock exists.';

-- Validate all existing leases against the revised rule.
DO $$
DECLARE
    v_lease_id BIGINT;
BEGIN
    FOR v_lease_id IN
        SELECT id
        FROM leases
    LOOP
        PERFORM validate_lease_integrity(v_lease_id);
    END LOOP;
END
$$;

SET CONSTRAINTS ALL IMMEDIATE;

COMMIT;
