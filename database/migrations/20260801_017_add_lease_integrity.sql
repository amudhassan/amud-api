BEGIN;

-- Required for unit equality plus date-range exclusion.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================================================
-- 1. PREVENT OVERLAPPING BINDING LEASES
-- =========================================================

ALTER TABLE leases

ADD CONSTRAINT
    ex_leases_binding_unit_dates

EXCLUDE USING gist (
    unit_id WITH =,

    daterange(
        start_date,
        end_date,
        '[]'
    ) WITH &&
)

WHERE (
    status IN (
        'scheduled',
        'active'
    )
)

DEFERRABLE
INITIALLY DEFERRED;


-- =========================================================
-- 2. ONE NON-CANCELLED RENEWAL PER SOURCE LEASE
-- =========================================================

CREATE UNIQUE INDEX
    uq_leases_current_renewal_source

ON leases (
    renewed_from_lease_id
)

WHERE renewed_from_lease_id IS NOT NULL
  AND status <> 'cancelled';


-- =========================================================
-- 3. LEASE AUDIT, IMMUTABILITY AND LIFECYCLE PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION
enforce_lease_audit_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    /*
     * Every application-created lease starts
     * as a draft.
     */
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION
                'A new lease must start as draft.'
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END IF;

    /*
     * Lease records are permanent legal records.
     */
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Lease records cannot be hard-deleted.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Closed leases cannot be edited.
     */
    IF OLD.status IN (
        'expired',
        'terminated',
        'cancelled'
    ) THEN
        RAISE EXCEPTION
            'A closed lease cannot be updated.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Permanent record identity.
     */
    IF OLD.public_id IS DISTINCT FROM
        NEW.public_id
    THEN
        RAISE EXCEPTION
            'Lease public ID cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.lease_number IS DISTINCT FROM
        NEW.lease_number
    THEN
        RAISE EXCEPTION
            'Lease number cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.created_by IS DISTINCT FROM
        NEW.created_by
    THEN
        RAISE EXCEPTION
            'Lease creator cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.created_at IS DISTINCT FROM
        NEW.created_at
    THEN
        RAISE EXCEPTION
            'Lease creation timestamp cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.renewed_from_lease_id IS DISTINCT FROM
        NEW.renewed_from_lease_id
    THEN
        RAISE EXCEPTION
            'Lease renewal source cannot be changed.'
        USING ERRCODE = '23514';
    END IF;

    /*
     * Parties may be corrected while the lease
     * remains draft. Once scheduled, they are fixed.
     */
    IF OLD.status <> 'draft' THEN
        IF OLD.owner_id IS DISTINCT FROM
            NEW.owner_id
        THEN
            RAISE EXCEPTION
                'Scheduled lease owner cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.property_id IS DISTINCT FROM
            NEW.property_id
        THEN
            RAISE EXCEPTION
                'Scheduled lease property cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.unit_id IS DISTINCT FROM
            NEW.unit_id
        THEN
            RAISE EXCEPTION
                'Scheduled lease unit cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.tenant_id IS DISTINCT FROM
            NEW.tenant_id
        THEN
            RAISE EXCEPTION
                'Scheduled lease tenant cannot be changed.'
            USING ERRCODE = '23514';
        END IF;

        /*
         * Contractual terms also become immutable
         * after scheduling.
         */
        IF OLD.start_date IS DISTINCT FROM
            NEW.start_date
            OR OLD.end_date IS DISTINCT FROM
            NEW.end_date
            OR OLD.signed_at IS DISTINCT FROM
            NEW.signed_at
            OR OLD.currency_code IS DISTINCT FROM
            NEW.currency_code
            OR OLD.rent_amount IS DISTINCT FROM
            NEW.rent_amount
            OR OLD.billing_frequency IS DISTINCT FROM
            NEW.billing_frequency
            OR OLD.payment_due_day IS DISTINCT FROM
            NEW.payment_due_day
            OR OLD.grace_period_days IS DISTINCT FROM
            NEW.grace_period_days
            OR OLD.security_deposit_amount IS DISTINCT FROM
            NEW.security_deposit_amount
            OR OLD.late_fee_type IS DISTINCT FROM
            NEW.late_fee_type
            OR OLD.late_fee_value IS DISTINCT FROM
            NEW.late_fee_value
            OR OLD.notes IS DISTINCT FROM
            NEW.notes
        THEN
            RAISE EXCEPTION
                'Scheduled lease contractual terms cannot be changed.'
            USING ERRCODE = '23514';
        END IF;
    END IF;

    /*
     * Allowed lifecycle transitions.
     */
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NOT (
            (
                OLD.status = 'draft'
                AND NEW.status IN (
                    'scheduled',
                    'cancelled'
                )
            )
            OR
            (
                OLD.status = 'scheduled'
                AND NEW.status IN (
                    'active',
                    'cancelled'
                )
            )
            OR
            (
                OLD.status = 'active'
                AND NEW.status IN (
                    'expired',
                    'terminated'
                )
            )
        ) THEN
            RAISE EXCEPTION
                'Invalid lease status transition from % to %.',
                OLD.status,
                NEW.status
            USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    enforce_lease_audit_integrity_trigger
ON leases;


CREATE TRIGGER
    enforce_lease_audit_integrity_trigger

BEFORE INSERT OR UPDATE OR DELETE
ON leases

FOR EACH ROW

EXECUTE FUNCTION
    enforce_lease_audit_integrity();


-- =========================================================
-- 4. VALIDATE ONE LEASE
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
     * Draft does not reserve or occupy a unit.
     */
    IF v_lease.status = 'draft' THEN
        -- No binding unit-status requirement.
        NULL;
    END IF;

    /*
     * Scheduled future lease may use an occupied
     * unit if the current lease ends before it starts.
     */
    IF v_lease.status = 'scheduled'
       AND v_lease.unit_status NOT IN (
           'available',
           'reserved',
           'occupied'
       )
    THEN
        RAISE EXCEPTION
            'Scheduled lease unit must be available, reserved or occupied.'
        USING ERRCODE = '23514';
    END IF;

    IF v_lease.status = 'active'
       AND v_lease.unit_status <> 'occupied'
    THEN
        RAISE EXCEPTION
            'Active lease unit must be occupied.'
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


-- =========================================================
-- 5. SHARED DEFERRED VALIDATION TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION
trigger_validate_lease_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_lease_id BIGINT;
BEGIN
    /*
     * Direct lease changes.
     */
    IF TG_TABLE_NAME = 'leases' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        PERFORM
            validate_lease_integrity(
                NEW.id
            );

        RETURN NEW;
    END IF;

    /*
     * Owner changes.
     */
    IF TG_TABLE_NAME = 'owners' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE owner_id =
                COALESCE(NEW.id, OLD.id)
              AND status IN (
                  'draft',
                  'scheduled',
                  'active'
              )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    /*
     * Property changes.
     */
    IF TG_TABLE_NAME = 'properties' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE property_id =
                COALESCE(NEW.id, OLD.id)
              AND status IN (
                  'draft',
                  'scheduled',
                  'active'
              )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    /*
     * Unit changes.
     */
    IF TG_TABLE_NAME = 'units' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE unit_id =
                COALESCE(NEW.id, OLD.id)
              AND status IN (
                  'draft',
                  'scheduled',
                  'active'
              )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    /*
     * Tenant changes.
     */
    IF TG_TABLE_NAME = 'tenants' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE tenant_id =
                COALESCE(NEW.id, OLD.id)
              AND status IN (
                  'draft',
                  'scheduled',
                  'active'
              )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    /*
     * Property ownership changes.
     */
    IF TG_TABLE_NAME = 'property_owners' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE status IN (
                'draft',
                'scheduled',
                'active'
            )
            AND (
                (
                    owner_id = NEW.owner_id
                    AND property_id =
                        NEW.property_id
                )
                OR
                (
                    owner_id = OLD.owner_id
                    AND property_id =
                        OLD.property_id
                )
            )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    /*
     * Owner–tenant relationship changes.
     */
    IF TG_TABLE_NAME = 'owner_tenants' THEN
        FOR v_lease_id IN
            SELECT id
            FROM leases
            WHERE status IN (
                'draft',
                'scheduled',
                'active'
            )
            AND (
                (
                    owner_id = NEW.owner_id
                    AND tenant_id =
                        NEW.tenant_id
                )
                OR
                (
                    owner_id = OLD.owner_id
                    AND tenant_id =
                        OLD.tenant_id
                )
            )
        LOOP
            PERFORM
                validate_lease_integrity(
                    v_lease_id
                );
        END LOOP;

        RETURN COALESCE(NEW, OLD);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- =========================================================
-- 6. DEFERRED CONSTRAINT TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS
    constraint_leases_integrity
ON leases;

CREATE CONSTRAINT TRIGGER
    constraint_leases_integrity

AFTER INSERT OR UPDATE
ON leases

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_owners_active_leases
ON owners;

CREATE CONSTRAINT TRIGGER
    constraint_owners_active_leases

AFTER INSERT OR UPDATE
ON owners

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_properties_active_leases
ON properties;

CREATE CONSTRAINT TRIGGER
    constraint_properties_active_leases

AFTER INSERT OR UPDATE
ON properties

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_units_active_leases
ON units;

CREATE CONSTRAINT TRIGGER
    constraint_units_active_leases

AFTER INSERT OR UPDATE
ON units

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_tenants_active_leases
ON tenants;

CREATE CONSTRAINT TRIGGER
    constraint_tenants_active_leases

AFTER INSERT OR UPDATE
ON tenants

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_property_owners_active_leases
ON property_owners;

CREATE CONSTRAINT TRIGGER
    constraint_property_owners_active_leases

AFTER INSERT OR UPDATE OR DELETE
ON property_owners

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


DROP TRIGGER IF EXISTS
    constraint_owner_tenants_active_leases
ON owner_tenants;

CREATE CONSTRAINT TRIGGER
    constraint_owner_tenants_active_leases

AFTER INSERT OR UPDATE OR DELETE
ON owner_tenants

DEFERRABLE
INITIALLY DEFERRED

FOR EACH ROW

EXECUTE FUNCTION
    trigger_validate_lease_integrity();


-- =========================================================
-- 7. VALIDATE EXISTING DATA BEFORE COMMIT
-- =========================================================

DO $$
DECLARE
    v_lease_id BIGINT;
BEGIN
    FOR v_lease_id IN
        SELECT id
        FROM leases
    LOOP
        PERFORM
            validate_lease_integrity(
                v_lease_id
            );
    END LOOP;
END
$$;

COMMIT;