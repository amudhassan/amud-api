BEGIN;

-- =========================================================
-- MAINTENANCE MODULE FINAL INTEGRITY
-- Adds lifecycle audit fields, cross-table validators,
-- immutable audit protection, synchronization functions,
-- deferred constraint triggers and existing-data validation.
-- =========================================================

-- =========================================================
-- 1. GENERIC STATUS-TRANSITION AUDIT FIELDS
-- These fields are server-controlled and are copied into
-- immutable history/activity records by database triggers.
-- =========================================================

ALTER TABLE maintenance_requests
    ADD COLUMN status_changed_by BIGINT,
    ADD COLUMN status_changed_at TIMESTAMPTZ,
    ADD COLUMN status_change_reason TEXT;

UPDATE maintenance_requests
SET
    status_changed_by = reported_by,
    status_changed_at = reported_at,
    status_change_reason = 'Request reported.'
WHERE status_changed_at IS NULL;

ALTER TABLE maintenance_requests
    ALTER COLUMN status_changed_at SET NOT NULL,
    ALTER COLUMN status_change_reason SET NOT NULL,

    ADD CONSTRAINT chk_maintenance_requests_status_audit
        CHECK (
            btrim(status_change_reason) <> ''
            AND status_changed_at >= reported_at
        ),

    ADD CONSTRAINT fk_maintenance_requests_status_changed_by
        FOREIGN KEY (status_changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;


ALTER TABLE maintenance_assignments
    ADD COLUMN status_changed_by BIGINT,
    ADD COLUMN status_changed_at TIMESTAMPTZ,
    ADD COLUMN status_change_reason TEXT;

UPDATE maintenance_assignments
SET
    status_changed_by = assigned_by,
    status_changed_at = assigned_at,
    status_change_reason = 'Assignment created.'
WHERE status_changed_at IS NULL;

ALTER TABLE maintenance_assignments
    ALTER COLUMN status_changed_at SET NOT NULL,
    ALTER COLUMN status_change_reason SET NOT NULL,

    ADD CONSTRAINT chk_maintenance_assignments_status_audit
        CHECK (
            btrim(status_change_reason) <> ''
            AND status_changed_at >= assigned_at
        ),

    ADD CONSTRAINT fk_maintenance_assignments_status_changed_by
        FOREIGN KEY (status_changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;


ALTER TABLE maintenance_visits
    ADD COLUMN status_changed_by BIGINT,
    ADD COLUMN status_changed_at TIMESTAMPTZ,
    ADD COLUMN status_change_reason TEXT;

UPDATE maintenance_visits
SET
    status_changed_by = created_by,
    status_changed_at = created_at,
    status_change_reason = 'Visit scheduled.'
WHERE status_changed_at IS NULL;

ALTER TABLE maintenance_visits
    ALTER COLUMN status_changed_at SET NOT NULL,
    ALTER COLUMN status_change_reason SET NOT NULL,

    ADD CONSTRAINT chk_maintenance_visits_status_audit
        CHECK (
            btrim(status_change_reason) <> ''
            AND status_changed_at >= created_at
        ),

    ADD CONSTRAINT fk_maintenance_visits_status_changed_by
        FOREIGN KEY (status_changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;


ALTER TABLE maintenance_costs
    ADD COLUMN status_changed_by BIGINT,
    ADD COLUMN status_changed_at TIMESTAMPTZ,
    ADD COLUMN status_change_reason TEXT;

UPDATE maintenance_costs
SET
    status_changed_by = recorded_by,
    status_changed_at = created_at,
    status_change_reason = 'Cost created.'
WHERE status_changed_at IS NULL;

ALTER TABLE maintenance_costs
    ALTER COLUMN status_changed_at SET NOT NULL,
    ALTER COLUMN status_change_reason SET NOT NULL,

    ADD CONSTRAINT chk_maintenance_costs_status_audit
        CHECK (
            btrim(status_change_reason) <> ''
            AND status_changed_at >= created_at
        ),

    ADD CONSTRAINT fk_maintenance_costs_status_changed_by
        FOREIGN KEY (status_changed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;


ALTER TABLE maintenance_responsibility_allocations
    ADD COLUMN revoked_at TIMESTAMPTZ,
    ADD COLUMN revoked_by BIGINT,
    ADD COLUMN revocation_reason TEXT,

    ADD CONSTRAINT chk_maintenance_resp_allocations_revocation
        CHECK (
            (
                revoked_at IS NULL
                AND revoked_by IS NULL
                AND revocation_reason IS NULL
            )
            OR
            (
                revoked_at IS NOT NULL
                AND revoked_by IS NOT NULL
                AND revocation_reason IS NOT NULL
                AND btrim(revocation_reason) <> ''
                AND revoked_at >= approved_at
            )
        ),

    ADD CONSTRAINT fk_maintenance_resp_allocations_revoked_by
        FOREIGN KEY (revoked_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

CREATE INDEX idx_maintenance_resp_allocations_active
ON maintenance_responsibility_allocations(
    maintenance_responsibility_id,
    party_type
)
WHERE revoked_at IS NULL;


CREATE INDEX idx_maintenance_requests_status_changed_by
ON maintenance_requests(status_changed_by);

CREATE INDEX idx_maintenance_assignments_status_changed_by
ON maintenance_assignments(status_changed_by);

CREATE INDEX idx_maintenance_visits_status_changed_by
ON maintenance_visits(status_changed_by);

CREATE INDEX idx_maintenance_costs_status_changed_by
ON maintenance_costs(status_changed_by);


-- =========================================================
-- 2. INTERNAL HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION maintenance_make_public_id(
    p_prefix TEXT,
    p_hash_length INTEGER DEFAULT 24
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    IF p_prefix IS NULL
       OR btrim(p_prefix) = ''
       OR p_hash_length < 8
       OR p_hash_length > 32 THEN
        RAISE EXCEPTION
            'Invalid maintenance public-ID generation parameters.'
            USING ERRCODE = '22023';
    END IF;

    RETURN p_prefix || substr(
        md5(
            random()::TEXT
            || clock_timestamp()::TEXT
            || txid_current()::TEXT
        ),
        1,
        p_hash_length
    );
END;
$$;


CREATE OR REPLACE FUNCTION set_maintenance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION prevent_maintenance_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Maintenance audit and lifecycle records cannot be hard deleted from table %.',
        TG_TABLE_NAME
        USING ERRCODE = 'P0001';
END;
$$;


CREATE OR REPLACE FUNCTION enforce_maintenance_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'Records in table % are append-only and cannot be edited.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    RAISE EXCEPTION
        'Records in table % cannot be hard deleted.',
        TG_TABLE_NAME
        USING ERRCODE = 'P0001';
END;
$$;


CREATE OR REPLACE FUNCTION record_maintenance_activity(
    p_request_id BIGINT,
    p_activity_type VARCHAR,
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_performed_by BIGINT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO maintenance_activity_history (
        public_id,
        maintenance_request_id,
        activity_type,
        old_value,
        new_value,
        metadata,
        reason,
        performed_by,
        created_at
    )
    VALUES (
        maintenance_make_public_id('maintenance_activity_'),
        p_request_id,
        p_activity_type,
        p_old_value,
        p_new_value,
        COALESCE(p_metadata, '{}'::JSONB),
        NULLIF(btrim(p_reason), ''),
        p_performed_by,
        CURRENT_TIMESTAMP
    );
END;
$$;


CREATE OR REPLACE FUNCTION enqueue_maintenance_event(
    p_request_id BIGINT,
    p_event_type VARCHAR,
    p_idempotency_key TEXT,
    p_payload JSONB DEFAULT '{}'::JSONB,
    p_occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO maintenance_events (
        public_id,
        maintenance_request_id,
        event_type,
        idempotency_key,
        payload,
        occurred_at,
        available_at,
        created_at
    )
    VALUES (
        maintenance_make_public_id('maintenance_event_'),
        p_request_id,
        p_event_type,
        p_idempotency_key,
        COALESCE(p_payload, '{}'::JSONB),
        p_occurred_at,
        GREATEST(p_occurred_at, CURRENT_TIMESTAMP),
        GREATEST(p_occurred_at, CURRENT_TIMESTAMP)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;


-- =========================================================
-- 3. UPDATED-AT TRIGGERS
-- =========================================================

CREATE TRIGGER a_set_maintenance_requests_updated_at
BEFORE UPDATE ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_maintenance_assignments_updated_at
BEFORE UPDATE ON maintenance_assignments
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_maintenance_visits_updated_at
BEFORE UPDATE ON maintenance_visits
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_maintenance_costs_updated_at
BEFORE UPDATE ON maintenance_costs
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_maintenance_responsibilities_updated_at
BEFORE UPDATE ON maintenance_responsibilities
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_preventive_plans_updated_at
BEFORE UPDATE ON preventive_maintenance_plans
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();

CREATE TRIGGER a_set_preventive_occurrences_updated_at
BEFORE UPDATE ON preventive_maintenance_occurrences
FOR EACH ROW
EXECUTE FUNCTION set_maintenance_updated_at();


-- =========================================================
-- 4. REQUEST CREATION AND RELATIONSHIP INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_request_creation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_default_review_interval INTERVAL;
    v_default_work_interval INTERVAL;
    v_default_resolution_interval INTERVAL;
BEGIN
    IF NEW.status <> 'reported' THEN
        RAISE EXCEPTION
            'A new maintenance request must start with reported status.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM owners AS o
        WHERE o.id = NEW.owner_id
          AND o.deleted_at IS NULL
          AND o.status = 'active'
    ) THEN
        RAISE EXCEPTION
            'Maintenance request owner must be active and current.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM properties AS p
        JOIN property_owners AS po
            ON po.property_id = p.id
           AND po.owner_id = NEW.owner_id
           AND po.effective_to IS NULL
        WHERE p.id = NEW.property_id
          AND p.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'Property is not a current property of the selected owner.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.request_scope = 'unit' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM units AS u
            WHERE u.id = NEW.unit_id
              AND u.property_id = NEW.property_id
              AND u.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION
                'Maintenance unit must be current and belong to the selected property.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.tenant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM tenants AS t
            JOIN owner_tenants AS ot
                ON ot.tenant_id = t.id
               AND ot.owner_id = NEW.owner_id
               AND ot.relationship_status = 'active'
               AND ot.ended_at IS NULL
            WHERE t.id = NEW.tenant_id
              AND t.deleted_at IS NULL
              AND t.status = 'active'
        ) THEN
            RAISE EXCEPTION
                'Tenant must have a current active relationship with the selected owner.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM leases AS l
            WHERE l.id = NEW.lease_id
              AND l.owner_id = NEW.owner_id
              AND l.property_id = NEW.property_id
              AND l.unit_id = NEW.unit_id
              AND l.tenant_id = NEW.tenant_id
              AND l.status = 'active'
              AND NEW.reported_at::DATE
                    BETWEEN l.start_date AND l.end_date
        ) THEN
            RAISE EXCEPTION
                'Tenant-linked maintenance requests require the matching active lease.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.reporter_type = 'tenant_user' THEN
        IF NEW.tenant_id IS NULL
           OR NEW.lease_id IS NULL
           OR NOT EXISTS (
                SELECT 1
                FROM tenant_users AS tu
                WHERE tu.tenant_id = NEW.tenant_id
                  AND tu.user_id = NEW.reported_by
                  AND tu.revoked_at IS NULL
                  AND tu.can_submit_maintenance = TRUE
           ) THEN
            RAISE EXCEPTION
                'Tenant reporter does not have current maintenance-submission permission.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.reporter_type = 'owner_user' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM owner_users AS ou
            WHERE ou.owner_id = NEW.owner_id
              AND ou.user_id = NEW.reported_by
              AND ou.revoked_at IS NULL
              AND (
                    ou.relationship_role = 'owner'
                    OR ou.is_primary = TRUE
                    OR ou.can_create_maintenance_requests = TRUE
              )
        ) THEN
            RAISE EXCEPTION
                'Owner reporter does not have current maintenance-creation permission.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.request_source = 'preventive_schedule' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM preventive_maintenance_plans AS pmp
            WHERE pmp.id = NEW.preventive_plan_id
              AND pmp.owner_id = NEW.owner_id
              AND pmp.property_id = NEW.property_id
              AND pmp.unit_id IS NOT DISTINCT FROM NEW.unit_id
              AND pmp.request_scope = NEW.request_scope
              AND pmp.status = 'active'
        ) THEN
            RAISE EXCEPTION
                'Preventive request must match an active preventive-maintenance plan.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    CASE NEW.priority
        WHEN 'low' THEN
            v_default_review_interval := INTERVAL '3 days';
            v_default_work_interval := INTERVAL '7 days';
            v_default_resolution_interval := INTERVAL '14 days';
        WHEN 'medium' THEN
            v_default_review_interval := INTERVAL '24 hours';
            v_default_work_interval := INTERVAL '3 days';
            v_default_resolution_interval := INTERVAL '7 days';
        WHEN 'high' THEN
            v_default_review_interval := INTERVAL '4 hours';
            v_default_work_interval := INTERVAL '24 hours';
            v_default_resolution_interval := INTERVAL '3 days';
        WHEN 'emergency' THEN
            v_default_review_interval := INTERVAL '30 minutes';
            v_default_work_interval := INTERVAL '2 hours';
            v_default_resolution_interval := INTERVAL '24 hours';
    END CASE;

    NEW.target_review_at := COALESCE(
        NEW.target_review_at,
        NEW.reported_at + v_default_review_interval
    );

    NEW.target_work_start_at := COALESCE(
        NEW.target_work_start_at,
        NEW.reported_at + v_default_work_interval
    );

    NEW.target_resolution_at := COALESCE(
        NEW.target_resolution_at,
        NEW.reported_at + v_default_resolution_interval
    );

    NEW.status_changed_by := NEW.reported_by;
    NEW.status_changed_at := NEW.reported_at;
    NEW.status_change_reason := 'Request reported.';

    RETURN NEW;
END;
$$;


-- Forward declaration. The complete validator replaces this
-- implementation in the responsibility section below.
CREATE OR REPLACE FUNCTION validate_maintenance_responsibility_integrity(
    p_request_id BIGINT,
    p_require_complete BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION validate_maintenance_request_integrity(
    p_request_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_estimated_total NUMERIC(14, 2);
    v_approved_total NUMERIC(14, 2);
    v_actual_total NUMERIC(14, 2);
    v_latest_resolution maintenance_resolutions%ROWTYPE;
    v_active_assignment_count BIGINT;
    v_active_visit_count BIGINT;
    v_pending_approval_count BIGINT;
    v_active_lock_count BIGINT;
    v_completion_evidence_count BIGINT;
BEGIN
    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM owners AS o
        WHERE o.id = v_request.owner_id
    ) THEN
        RAISE EXCEPTION
            'Maintenance request references an owner that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM properties AS p
        WHERE p.id = v_request.property_id
    ) THEN
        RAISE EXCEPTION
            'Maintenance request references a property that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM property_owners AS po
        WHERE po.property_id = v_request.property_id
          AND po.owner_id = v_request.owner_id
          AND po.effective_from <= v_request.reported_at::DATE
          AND (
                po.effective_to IS NULL
                OR po.effective_to >= v_request.reported_at::DATE
          )
    ) THEN
        RAISE EXCEPTION
            'Maintenance request owner did not own the property when the request was reported.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_request.request_scope = 'unit' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM units AS u
            WHERE u.id = v_request.unit_id
              AND u.property_id = v_request.property_id
        ) THEN
            RAISE EXCEPTION
                'Maintenance request unit and property relationship is inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_request.tenant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM leases AS l
            WHERE l.id = v_request.lease_id
              AND l.owner_id = v_request.owner_id
              AND l.property_id = v_request.property_id
              AND l.unit_id = v_request.unit_id
              AND l.tenant_id = v_request.tenant_id
        ) THEN
            RAISE EXCEPTION
                'Maintenance request tenant and lease relationships are inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_request.preventive_plan_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM preventive_maintenance_plans AS pmp
            WHERE pmp.id = v_request.preventive_plan_id
              AND pmp.owner_id = v_request.owner_id
              AND pmp.property_id = v_request.property_id
              AND pmp.unit_id IS NOT DISTINCT FROM v_request.unit_id
              AND pmp.request_scope = v_request.request_scope
        ) THEN
            RAISE EXCEPTION
                'Maintenance request does not match its preventive plan.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    SELECT
        COALESCE(
            SUM(estimated_amount) FILTER (
                WHERE status NOT IN ('rejected', 'cancelled')
            ),
            0
        )::NUMERIC(14, 2),
        COALESCE(
            SUM(approved_amount) FILTER (
                WHERE status IN ('approved', 'incurred')
            ),
            0
        )::NUMERIC(14, 2),
        COALESCE(
            SUM(actual_amount) FILTER (
                WHERE status = 'incurred'
            ),
            0
        )::NUMERIC(14, 2)
    INTO
        v_estimated_total,
        v_approved_total,
        v_actual_total
    FROM maintenance_costs
    WHERE maintenance_request_id = v_request.id;

    IF v_request.total_estimated_cost <> v_estimated_total
       OR v_request.total_approved_cost <> v_approved_total
       OR v_request.total_actual_cost <> v_actual_total THEN
        RAISE EXCEPTION
            'Maintenance request cost totals do not match maintenance cost records.'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM maintenance_costs AS mc
        WHERE mc.maintenance_request_id = v_request.id
          AND mc.currency_code <> v_request.currency_code
    ) THEN
        RAISE EXCEPTION
            'Maintenance cost currency must match the request currency.'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM maintenance_unit_status_locks AS musl
        JOIN units AS u
            ON u.id = musl.unit_id
        WHERE musl.maintenance_request_id = v_request.id
          AND musl.is_active = TRUE
          AND u.operational_status <> 'maintenance'
    ) THEN
        RAISE EXCEPTION
            'Active maintenance unit-status lock requires maintenance unit status.'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM maintenance_responsibilities AS mr
        WHERE mr.maintenance_request_id = v_request.id
          AND (
                mr.coverage_type <> v_request.coverage_type
                OR mr.responsibility_status <> v_request.responsibility_status
          )
    ) THEN
        RAISE EXCEPTION
            'Maintenance responsibility summary does not match the request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM maintenance_responsibilities AS mr
        WHERE mr.maintenance_request_id = v_request.id
    )
    AND (
        v_request.coverage_type <> 'under_investigation'
        OR v_request.responsibility_status <> 'pending_review'
    ) THEN
        RAISE EXCEPTION
            'Request responsibility summary requires a responsibility record.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_request.status = 'assigned' THEN
        SELECT COUNT(*)
        INTO v_active_assignment_count
        FROM maintenance_assignments
        WHERE maintenance_request_id = v_request.id
          AND status IN ('pending', 'accepted', 'active');

        IF v_active_assignment_count = 0 THEN
            RAISE EXCEPTION
                'Assigned maintenance request requires a current assignment.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_request.status IN ('resolved', 'closed') THEN
        SELECT *
        INTO v_latest_resolution
        FROM maintenance_resolutions
        WHERE maintenance_request_id = v_request.id
        ORDER BY sequence_number DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Resolved or closed maintenance request requires a resolution record.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_latest_resolution.confirmation_status = 'disputed' THEN
            RAISE EXCEPTION
                'A disputed resolution cannot remain resolved or closed.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_request.resolution_confirmation_status
            <> v_latest_resolution.confirmation_status
           OR v_request.resolution_confirmation_deadline_at
                IS DISTINCT FROM
              v_latest_resolution.confirmation_deadline_at THEN
            RAISE EXCEPTION
                'Request resolution-confirmation summary is inconsistent.'
                USING ERRCODE = 'P0001';
        END IF;

        SELECT COUNT(*)
        INTO v_completion_evidence_count
        FROM maintenance_attachments AS ma
        WHERE ma.maintenance_request_id = v_request.id
          AND (
                ma.resolution_id = v_latest_resolution.id
                OR ma.resolution_id IS NULL
          )
          AND ma.attachment_type = 'completion_evidence'
          AND ma.revoked_at IS NULL;

        IF v_completion_evidence_count = 0
           AND v_latest_resolution.evidence_override_reason IS NULL THEN
            RAISE EXCEPTION
                'Resolution requires active completion evidence or an override reason.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_request.status = 'closed' THEN
        IF v_latest_resolution.confirmation_status NOT IN (
            'confirmed',
            'no_response',
            'not_required'
        ) THEN
            RAISE EXCEPTION
                'Closed maintenance request requires terminal resolution confirmation.'
                USING ERRCODE = 'P0001';
        END IF;

        SELECT COUNT(*)
        INTO v_active_assignment_count
        FROM maintenance_assignments
        WHERE maintenance_request_id = v_request.id
          AND status IN ('pending', 'accepted', 'active');

        SELECT COUNT(*)
        INTO v_active_visit_count
        FROM maintenance_visits
        WHERE maintenance_request_id = v_request.id
          AND status IN (
                'scheduled',
                'confirmed',
                'rescheduled',
                'in_progress'
          );

        SELECT COUNT(*)
        INTO v_pending_approval_count
        FROM maintenance_cost_approvals AS mca
        JOIN maintenance_costs AS mc
            ON mc.id = mca.maintenance_cost_id
        WHERE mc.maintenance_request_id = v_request.id
          AND mca.decision = 'pending';

        SELECT COUNT(*)
        INTO v_active_lock_count
        FROM maintenance_unit_status_locks
        WHERE maintenance_request_id = v_request.id
          AND is_active = TRUE;

        IF v_active_assignment_count > 0 THEN
            RAISE EXCEPTION
                'Maintenance request cannot close with an active assignment.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_active_visit_count > 0 THEN
            RAISE EXCEPTION
                'Maintenance request cannot close with an active visit.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_pending_approval_count > 0 THEN
            RAISE EXCEPTION
                'Maintenance request cannot close with pending cost approval.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_active_lock_count > 0 THEN
            RAISE EXCEPTION
                'Maintenance request cannot close before its unit-status lock is released.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_actual_total > 0
           AND v_request.responsibility_status = 'pending_review' THEN
            RAISE EXCEPTION
                'Maintenance request cannot close while cost responsibility is pending review.'
                USING ERRCODE = 'P0001';
        END IF;

        PERFORM validate_maintenance_responsibility_integrity(
            v_request.id,
            TRUE
        );
    END IF;
END;
$$;


-- =========================================================
-- 5. REQUEST LIFECYCLE AND IMMUTABILITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_request_mutation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_reopen_allowed BOOLEAN := FALSE;
    v_latest_terminal_at TIMESTAMPTZ;
    v_review_interval INTERVAL;
    v_work_interval INTERVAL;
    v_resolution_interval INTERVAL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance requests cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.request_number IS DISTINCT FROM OLD.request_number
       OR NEW.request_scope IS DISTINCT FROM OLD.request_scope
       OR NEW.request_source IS DISTINCT FROM OLD.request_source
       OR NEW.preventive_plan_id IS DISTINCT FROM OLD.preventive_plan_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
       OR NEW.reported_by IS DISTINCT FROM OLD.reported_by
       OR NEW.reporter_type IS DISTINCT FROM OLD.reporter_type
       OR NEW.reported_at IS DISTINCT FROM OLD.reported_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance request identity and ownership relationships are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('closed', 'rejected', 'cancelled')
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION
            'Terminal maintenance request is read-only.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('closed', 'rejected', 'cancelled')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
        SELECT MAX(changed_at)
        INTO v_latest_terminal_at
        FROM maintenance_status_history
        WHERE maintenance_request_id = OLD.id
          AND new_status = OLD.status;

        SELECT EXISTS (
            SELECT 1
            FROM maintenance_reopen_requests AS mrr
            WHERE mrr.maintenance_request_id = OLD.id
              AND mrr.from_status = OLD.status
              AND mrr.target_status = NEW.status
              AND mrr.status = 'approved'
              AND mrr.decided_at IS NOT NULL
              AND mrr.decided_at >= COALESCE(
                    v_latest_terminal_at,
                    OLD.status_changed_at
              )
        )
        INTO v_reopen_allowed;

        IF NOT v_reopen_allowed THEN
            RAISE EXCEPTION
                'Terminal maintenance request can only change through an approved reopening request.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'reported'
                AND NEW.status IN (
                    'under_review',
                    'rejected',
                    'cancelled'
                ))
            OR
            (OLD.status = 'under_review'
                AND NEW.status IN (
                    'assigned',
                    'in_progress',
                    'rejected',
                    'cancelled'
                ))
            OR
            (OLD.status = 'assigned'
                AND NEW.status IN (
                    'under_review',
                    'in_progress',
                    'cancelled'
                ))
            OR
            (OLD.status = 'in_progress'
                AND NEW.status IN (
                    'on_hold',
                    'resolved'
                ))
            OR
            (OLD.status = 'on_hold'
                AND NEW.status IN (
                    'in_progress',
                    'cancelled'
                ))
            OR
            (OLD.status = 'resolved'
                AND NEW.status IN (
                    'in_progress',
                    'closed'
                ))
        ) THEN
            RAISE EXCEPTION
                'Invalid maintenance request transition from % to %.',
                OLD.status,
                NEW.status
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status_changed_at IS NULL
           OR NEW.status_changed_at < OLD.status_changed_at
           OR NEW.status_changed_at > CURRENT_TIMESTAMP + INTERVAL '5 minutes'
           OR NEW.status_change_reason IS NULL
           OR btrim(NEW.status_change_reason) = '' THEN
            RAISE EXCEPTION
                'Status change requires a valid actor timestamp and reason.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status_changed_by IS NULL THEN
            RAISE EXCEPTION
                'Maintenance status change requires an actor.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status = 'under_review'
           AND OLD.status = 'reported'
           AND (
                NEW.reviewed_at IS NULL
                OR NEW.reviewed_by IS NULL
           ) THEN
            RAISE EXCEPTION
                'Review transition requires reviewed_at and reviewed_by.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status = 'in_progress'
           AND OLD.status <> 'on_hold'
           AND NEW.work_started_at IS NULL THEN
            NEW.work_started_at := NEW.status_changed_at;
            NEW.work_started_by := NEW.status_changed_by;
        END IF;

        IF NEW.status = 'on_hold' THEN
            NEW.resolution_clock_paused_at := NEW.status_changed_at;
        ELSIF OLD.status = 'on_hold' THEN
            IF OLD.resolution_clock_paused_at IS NULL THEN
                RAISE EXCEPTION
                    'On-hold request is missing its pause timestamp.'
                    USING ERRCODE = 'P0001';
            END IF;

            NEW.total_resolution_hold_seconds :=
                OLD.total_resolution_hold_seconds
                + GREATEST(
                    FLOOR(
                        EXTRACT(
                            EPOCH FROM (
                                NEW.status_changed_at
                                - OLD.resolution_clock_paused_at
                            )
                        )
                    )::BIGINT,
                    0
                );

            NEW.resolution_clock_paused_at := NULL;
        END IF;
    ELSE
        IF NEW.status_changed_by IS DISTINCT FROM OLD.status_changed_by
           OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
           OR NEW.status_change_reason IS DISTINCT FROM OLD.status_change_reason THEN
            RAISE EXCEPTION
                'Status audit fields can only change with request status.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        CASE NEW.priority
            WHEN 'low' THEN
                v_review_interval := INTERVAL '3 days';
                v_work_interval := INTERVAL '7 days';
                v_resolution_interval := INTERVAL '14 days';
            WHEN 'medium' THEN
                v_review_interval := INTERVAL '24 hours';
                v_work_interval := INTERVAL '3 days';
                v_resolution_interval := INTERVAL '7 days';
            WHEN 'high' THEN
                v_review_interval := INTERVAL '4 hours';
                v_work_interval := INTERVAL '24 hours';
                v_resolution_interval := INTERVAL '3 days';
            WHEN 'emergency' THEN
                v_review_interval := INTERVAL '30 minutes';
                v_work_interval := INTERVAL '2 hours';
                v_resolution_interval := INTERVAL '24 hours';
        END CASE;

        IF OLD.target_review_at > CURRENT_TIMESTAMP THEN
            NEW.target_review_at := NEW.reported_at + v_review_interval;
        END IF;

        IF OLD.target_work_start_at > CURRENT_TIMESTAMP THEN
            NEW.target_work_start_at := NEW.reported_at + v_work_interval;
        END IF;

        IF OLD.target_resolution_at > CURRENT_TIMESTAMP THEN
            NEW.target_resolution_at := NEW.reported_at + v_resolution_interval;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_maintenance_request_creation_integrity
BEFORE INSERT ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_request_creation_integrity();

CREATE TRIGGER c_enforce_maintenance_request_mutation_integrity
BEFORE UPDATE OR DELETE ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_request_mutation_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_request_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_activity_type VARCHAR(60);
    v_event_type VARCHAR(70);
    v_old_status VARCHAR(30);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_status := NULL;
    ELSE
        IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
            RETURN NULL;
        END IF;
        v_old_status := OLD.status;
    END IF;

    INSERT INTO maintenance_status_history (
        public_id,
        maintenance_request_id,
        old_status,
        new_status,
        reason,
        changed_by,
        changed_at,
        metadata
    )
    VALUES (
        maintenance_make_public_id('maintenance_status_'),
        NEW.id,
        v_old_status,
        NEW.status,
        NEW.status_change_reason,
        NEW.status_changed_by,
        NEW.status_changed_at,
        jsonb_build_object(
            'priority', NEW.priority,
            'impact_level', NEW.impact_level,
            'request_scope', NEW.request_scope
        )
    );

    v_activity_type := CASE NEW.status
        WHEN 'reported' THEN 'request_created'
        WHEN 'resolved' THEN 'request_resolved'
        WHEN 'closed' THEN 'request_closed'
        WHEN 'cancelled' THEN 'request_cancelled'
        WHEN 'rejected' THEN 'request_rejected'
        ELSE 'status_changed'
    END;

    IF v_old_status IN ('closed', 'rejected', 'cancelled') THEN
        v_activity_type := 'request_reopened';
    END IF;

    PERFORM record_maintenance_activity(
        NEW.id,
        v_activity_type,
        CASE
            WHEN v_old_status IS NULL THEN NULL
            ELSE jsonb_build_object('status', v_old_status)
        END,
        jsonb_build_object('status', NEW.status),
        NEW.status_change_reason,
        NEW.status_changed_by,
        jsonb_build_object(
            'status_changed_at', NEW.status_changed_at
        )
    );

    v_event_type := CASE NEW.status
        WHEN 'reported' THEN 'maintenance_reported'
        WHEN 'assigned' THEN 'maintenance_assigned'
        WHEN 'resolved' THEN 'maintenance_resolved'
        WHEN 'closed' THEN 'maintenance_closed'
        ELSE 'maintenance_status_changed'
    END;

    PERFORM enqueue_maintenance_event(
        NEW.id,
        v_event_type,
        format(
            'maintenance-request:%s:status:%s:%s:%s',
            NEW.id,
            COALESCE(v_old_status, 'none'),
            NEW.status,
            to_char(
                NEW.status_changed_at AT TIME ZONE 'UTC',
                'YYYYMMDDHH24MISSUS'
            )
        ),
        jsonb_build_object(
            'request_public_id', NEW.public_id,
            'request_number', NEW.request_number,
            'old_status', v_old_status,
            'new_status', NEW.status,
            'priority', NEW.priority
        ),
        NEW.status_changed_at
    );

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_request_status
AFTER INSERT OR UPDATE OF status ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_request_status_trigger();


CREATE OR REPLACE FUNCTION refresh_maintenance_sla_flags(
    p_request_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_new_review_overdue BOOLEAN;
    v_new_work_overdue BOOLEAN;
    v_new_resolution_overdue BOOLEAN;
    v_became_overdue BOOLEAN;
BEGIN
    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Terminal requests retain their last SLA snapshot and
    -- are not updated by recurring SLA refresh jobs.
    IF v_request.status IN ('closed', 'rejected', 'cancelled') THEN
        RETURN;
    END IF;

    v_new_review_overdue := (
        v_request.reviewed_at IS NULL
        AND v_request.status NOT IN ('rejected', 'cancelled', 'closed')
        AND v_request.target_review_at IS NOT NULL
        AND v_request.target_review_at < CURRENT_TIMESTAMP
    );

    v_new_work_overdue := (
        v_request.work_started_at IS NULL
        AND v_request.status NOT IN ('rejected', 'cancelled', 'closed')
        AND v_request.target_work_start_at IS NOT NULL
        AND v_request.target_work_start_at < CURRENT_TIMESTAMP
    );

    v_new_resolution_overdue := (
        v_request.status NOT IN (
            'on_hold',
            'resolved',
            'closed',
            'rejected',
            'cancelled'
        )
        AND v_request.target_resolution_at IS NOT NULL
        AND (
            v_request.target_resolution_at
            + make_interval(
                secs => v_request.total_resolution_hold_seconds::DOUBLE PRECISION
            )
        ) < CURRENT_TIMESTAMP
    );

    v_became_overdue :=
        (v_new_review_overdue AND NOT v_request.review_overdue)
        OR (v_new_work_overdue AND NOT v_request.work_start_overdue)
        OR (v_new_resolution_overdue AND NOT v_request.resolution_overdue);

    UPDATE maintenance_requests
    SET
        review_overdue = v_new_review_overdue,
        work_start_overdue = v_new_work_overdue,
        resolution_overdue = v_new_resolution_overdue
    WHERE id = p_request_id;

    IF v_became_overdue THEN
        PERFORM record_maintenance_activity(
            v_request.id,
            'maintenance_overdue',
            jsonb_build_object(
                'review_overdue', v_request.review_overdue,
                'work_start_overdue', v_request.work_start_overdue,
                'resolution_overdue', v_request.resolution_overdue
            ),
            jsonb_build_object(
                'review_overdue', v_new_review_overdue,
                'work_start_overdue', v_new_work_overdue,
                'resolution_overdue', v_new_resolution_overdue
            ),
            'One or more maintenance SLA targets are overdue.',
            NULL,
            '{}'::JSONB
        );

        PERFORM enqueue_maintenance_event(
            v_request.id,
            'maintenance_overdue',
            format(
                'maintenance-request:%s:overdue:%s:%s:%s',
                v_request.id,
                v_new_review_overdue,
                v_new_work_overdue,
                v_new_resolution_overdue
            ),
            jsonb_build_object(
                'request_public_id', v_request.public_id,
                'review_overdue', v_new_review_overdue,
                'work_start_overdue', v_new_work_overdue,
                'resolution_overdue', v_new_resolution_overdue
            ),
            CURRENT_TIMESTAMP
        );

        IF v_request.priority = 'emergency' THEN
            PERFORM record_maintenance_activity(
                v_request.id,
                'emergency_escalated',
                NULL,
                jsonb_build_object(
                    'review_overdue', v_new_review_overdue,
                    'work_start_overdue', v_new_work_overdue,
                    'resolution_overdue', v_new_resolution_overdue
                ),
                'Emergency maintenance request exceeded an SLA target.',
                NULL,
                '{}'::JSONB
            );

            PERFORM enqueue_maintenance_event(
                v_request.id,
                'maintenance_emergency_escalated',
                format(
                    'maintenance-request:%s:emergency-escalation',
                    v_request.id
                ),
                jsonb_build_object(
                    'request_public_id', v_request.public_id,
                    'review_overdue', v_new_review_overdue,
                    'work_start_overdue', v_new_work_overdue,
                    'resolution_overdue', v_new_resolution_overdue
                ),
                CURRENT_TIMESTAMP
            );
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 6. ASSIGNMENT INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_assignment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance assignments cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT status
    INTO v_request_status
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance assignment references a request that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_request_status <> 'under_review' THEN
            RAISE EXCEPTION
                'New assignment can only be added while the request is under review.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION
                'New maintenance assignment must start as pending.'
                USING ERRCODE = 'P0001';
        END IF;

        NEW.status_changed_by := NEW.assigned_by;
        NEW.status_changed_at := NEW.assigned_at;
        NEW.status_change_reason := 'Assignment created.';

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.assignment_type IS DISTINCT FROM OLD.assignment_type
       OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
       OR NEW.vendor_name IS DISTINCT FROM OLD.vendor_name
       OR NEW.company_name IS DISTINCT FROM OLD.company_name
       OR NEW.contact_person IS DISTINCT FROM OLD.contact_person
       OR NEW.phone_number IS DISTINCT FROM OLD.phone_number
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.service_description IS DISTINCT FROM OLD.service_description
       OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
       OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance assignment target and creation identity are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('declined', 'completed', 'revoked')
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal maintenance assignment is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'pending'
                AND NEW.status IN (
                    'accepted',
                    'declined',
                    'active',
                    'revoked'
                ))
            OR
            (OLD.status = 'accepted'
                AND NEW.status IN ('active', 'revoked'))
            OR
            (OLD.status = 'active'
                AND NEW.status IN ('completed', 'revoked'))
        ) THEN
            RAISE EXCEPTION
                'Invalid maintenance assignment transition from % to %.',
                OLD.status,
                NEW.status
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status_changed_by IS NULL
           OR NEW.status_changed_at IS NULL
           OR NEW.status_changed_at < OLD.status_changed_at
           OR NEW.status_change_reason IS NULL
           OR btrim(NEW.status_change_reason) = '' THEN
            RAISE EXCEPTION
                'Assignment status change requires actor, timestamp and reason.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        IF NEW.status_changed_by IS DISTINCT FROM OLD.status_changed_by
           OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
           OR NEW.status_change_reason IS DISTINCT FROM OLD.status_change_reason THEN
            RAISE EXCEPTION
                'Assignment status audit fields can only change with status.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_maintenance_assignment_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_assignments
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_assignment_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_assignment_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_activity_type VARCHAR(60);
    v_request maintenance_requests%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NULL;
    END IF;

    v_activity_type := CASE NEW.status
        WHEN 'pending' THEN 'assignment_created'
        WHEN 'declined' THEN 'assignment_declined'
        WHEN 'revoked' THEN 'assignment_revoked'
        ELSE 'assignment_changed'
    END;

    PERFORM record_maintenance_activity(
        NEW.maintenance_request_id,
        v_activity_type,
        CASE
            WHEN TG_OP = 'INSERT' THEN NULL
            ELSE jsonb_build_object('status', OLD.status)
        END,
        jsonb_build_object(
            'assignment_public_id', NEW.public_id,
            'status', NEW.status,
            'assignment_type', NEW.assignment_type
        ),
        NEW.status_change_reason,
        NEW.status_changed_by,
        '{}'::JSONB
    );

    IF NEW.status IN ('pending', 'accepted', 'active') THEN
        SELECT *
        INTO v_request
        FROM maintenance_requests
        WHERE id = NEW.maintenance_request_id
        FOR UPDATE;

        IF v_request.status = 'under_review' THEN
            UPDATE maintenance_requests
            SET
                status = 'assigned',
                status_changed_by = NEW.status_changed_by,
                status_changed_at = NEW.status_changed_at,
                status_change_reason = NEW.status_change_reason
            WHERE id = NEW.maintenance_request_id;
        END IF;
    ELSIF NEW.status IN ('declined', 'revoked') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM maintenance_assignments AS ma
            WHERE ma.maintenance_request_id = NEW.maintenance_request_id
              AND ma.id <> NEW.id
              AND ma.status IN ('pending', 'accepted', 'active')
        ) THEN
            UPDATE maintenance_requests
            SET
                status = 'under_review',
                status_changed_by = NEW.status_changed_by,
                status_changed_at = NEW.status_changed_at,
                status_change_reason = NEW.status_change_reason
            WHERE id = NEW.maintenance_request_id
              AND status = 'assigned';
        END IF;
    END IF;


    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_assignment_activity
AFTER INSERT OR UPDATE OF status ON maintenance_assignments
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_assignment_activity_trigger();


-- =========================================================
-- 7. VISIT INTEGRITY AND IMMUTABLE VISIT HISTORY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_visit_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance visits cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance visit references a request that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.assignment_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM maintenance_assignments AS ma
            WHERE ma.id = NEW.assignment_id
              AND ma.maintenance_request_id = NEW.maintenance_request_id
       ) THEN
        RAISE EXCEPTION
            'Maintenance visit assignment belongs to a different request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.scheduled_start_at < v_request.reported_at THEN
        RAISE EXCEPTION
            'Maintenance visit cannot be scheduled before the request was reported.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_request.status IN ('resolved', 'closed', 'rejected', 'cancelled') THEN
            RAISE EXCEPTION
                'New visit cannot be added to a terminal maintenance request.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status <> 'scheduled' THEN
            RAISE EXCEPTION
                'New maintenance visit must start as scheduled.'
                USING ERRCODE = 'P0001';
        END IF;

        NEW.status_changed_by := NEW.created_by;
        NEW.status_changed_at := NEW.created_at;
        NEW.status_change_reason := 'Visit scheduled.';

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.visit_type IS DISTINCT FROM OLD.visit_type
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance visit identity and request relationship are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('completed', 'missed', 'cancelled')
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal maintenance visit is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status IN ('scheduled', 'confirmed', 'rescheduled')
                AND NEW.status IN (
                    'confirmed',
                    'rescheduled',
                    'in_progress',
                    'missed',
                    'cancelled'
                ))
            OR
            (OLD.status = 'in_progress'
                AND NEW.status IN ('completed', 'cancelled'))
        ) THEN
            RAISE EXCEPTION
                'Invalid maintenance visit transition from % to %.',
                OLD.status,
                NEW.status
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.scheduled_start_at IS DISTINCT FROM OLD.scheduled_start_at
       OR NEW.scheduled_end_at IS DISTINCT FROM OLD.scheduled_end_at THEN
        IF NEW.status_changed_by IS NULL
           OR NEW.status_changed_at IS NULL
           OR NEW.status_changed_at < OLD.status_changed_at
           OR NEW.status_change_reason IS NULL
           OR btrim(NEW.status_change_reason) = '' THEN
            RAISE EXCEPTION
                'Visit lifecycle or schedule change requires actor, timestamp and reason.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        IF NEW.status_changed_by IS DISTINCT FROM OLD.status_changed_by
           OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
           OR NEW.status_change_reason IS DISTINCT FROM OLD.status_change_reason THEN
            RAISE EXCEPTION
                'Visit status audit fields require a lifecycle or schedule change.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF (
        NEW.scheduled_start_at IS DISTINCT FROM OLD.scheduled_start_at
        OR NEW.scheduled_end_at IS DISTINCT FROM OLD.scheduled_end_at
    )
    AND NEW.status <> 'rescheduled' THEN
        RAISE EXCEPTION
            'Changing a visit schedule requires rescheduled status.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_maintenance_visit_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_visits
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_visit_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_visit_history_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_activity_type VARCHAR(60);
    v_event_type VARCHAR(70);
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.scheduled_start_at IS NOT DISTINCT FROM OLD.scheduled_start_at
       AND NEW.scheduled_end_at IS NOT DISTINCT FROM OLD.scheduled_end_at THEN
        RETURN NULL;
    END IF;

    INSERT INTO maintenance_visit_history (
        public_id,
        maintenance_visit_id,
        old_status,
        new_status,
        old_schedule_start_at,
        old_schedule_end_at,
        new_schedule_start_at,
        new_schedule_end_at,
        reason,
        changed_by,
        changed_at,
        metadata
    )
    VALUES (
        maintenance_make_public_id(
            'maintenance_visit_history_',
            20
        ),
        NEW.id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
        NEW.status,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.scheduled_start_at END,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.scheduled_end_at END,
        NEW.scheduled_start_at,
        NEW.scheduled_end_at,
        NEW.status_change_reason,
        NEW.status_changed_by,
        NEW.status_changed_at,
        '{}'::JSONB
    );

    v_activity_type := CASE NEW.status
        WHEN 'scheduled' THEN 'visit_scheduled'
        WHEN 'rescheduled' THEN 'visit_rescheduled'
        WHEN 'in_progress' THEN 'visit_started'
        WHEN 'completed' THEN 'visit_completed'
        WHEN 'missed' THEN 'visit_missed'
        WHEN 'cancelled' THEN 'visit_cancelled'
        ELSE 'status_changed'
    END;

    PERFORM record_maintenance_activity(
        NEW.maintenance_request_id,
        v_activity_type,
        CASE
            WHEN TG_OP = 'INSERT' THEN NULL
            ELSE jsonb_build_object(
                'status', OLD.status,
                'scheduled_start_at', OLD.scheduled_start_at,
                'scheduled_end_at', OLD.scheduled_end_at
            )
        END,
        jsonb_build_object(
            'visit_public_id', NEW.public_id,
            'status', NEW.status,
            'scheduled_start_at', NEW.scheduled_start_at,
            'scheduled_end_at', NEW.scheduled_end_at
        ),
        NEW.status_change_reason,
        NEW.status_changed_by,
        '{}'::JSONB
    );

    IF NEW.status = 'in_progress' THEN
        UPDATE maintenance_requests
        SET
            status = 'in_progress',
            status_changed_by = NEW.status_changed_by,
            status_changed_at = NEW.status_changed_at,
            status_change_reason = NEW.status_change_reason
        WHERE id = NEW.maintenance_request_id
          AND status IN ('under_review', 'assigned');
    END IF;

    v_event_type := CASE NEW.status
        WHEN 'scheduled' THEN 'maintenance_visit_scheduled'
        WHEN 'rescheduled' THEN 'maintenance_visit_rescheduled'
        ELSE NULL
    END;

    IF v_event_type IS NOT NULL THEN
        PERFORM enqueue_maintenance_event(
            NEW.maintenance_request_id,
            v_event_type,
            format(
                'maintenance-visit:%s:%s:%s',
                NEW.id,
                NEW.status,
                to_char(
                    NEW.status_changed_at AT TIME ZONE 'UTC',
                    'YYYYMMDDHH24MISSUS'
                )
            ),
            jsonb_build_object(
                'visit_public_id', NEW.public_id,
                'status', NEW.status,
                'scheduled_start_at', NEW.scheduled_start_at,
                'scheduled_end_at', NEW.scheduled_end_at
            ),
            NEW.status_changed_at
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_visit_history
AFTER INSERT OR UPDATE OF status, scheduled_start_at, scheduled_end_at
ON maintenance_visits
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_visit_history_trigger();


-- =========================================================
-- 8. COST, APPROVAL AND REQUEST-TOTAL INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_cost_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance costs cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT status
    INTO v_request_status
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance cost references a request that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.assignment_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM maintenance_assignments AS ma
            WHERE ma.id = NEW.assignment_id
              AND ma.maintenance_request_id = NEW.maintenance_request_id
       ) THEN
        RAISE EXCEPTION
            'Maintenance cost assignment belongs to a different request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_request_status IN ('closed', 'rejected', 'cancelled') THEN
            RAISE EXCEPTION
                'Cost cannot be added to a terminal maintenance request.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION
                'New maintenance cost must start as draft.'
                USING ERRCODE = 'P0001';
        END IF;

        NEW.status_changed_by := NEW.recorded_by;
        NEW.status_changed_at := NEW.created_at;
        NEW.status_change_reason := 'Cost created.';

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.cost_type IS DISTINCT FROM OLD.cost_type
       OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance cost identity and request relationship are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status IN ('rejected', 'cancelled', 'incurred')
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal maintenance cost is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status <> 'draft'
       AND (
            NEW.description IS DISTINCT FROM OLD.description
            OR NEW.quantity IS DISTINCT FROM OLD.quantity
            OR NEW.unit_cost IS DISTINCT FROM OLD.unit_cost
            OR NEW.estimated_amount IS DISTINCT FROM OLD.estimated_amount
            OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
            OR NEW.vendor_reference IS DISTINCT FROM OLD.vendor_reference
            OR NEW.quotation_reference IS DISTINCT FROM OLD.quotation_reference
       ) THEN
        RAISE EXCEPTION
            'Submitted maintenance cost terms are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'draft'
                AND NEW.status IN ('submitted', 'cancelled'))
            OR
            (OLD.status = 'submitted'
                AND NEW.status IN (
                    'approved',
                    'rejected',
                    'cancelled'
                ))
            OR
            (OLD.status = 'approved'
                AND NEW.status IN ('incurred', 'cancelled'))
        ) THEN
            RAISE EXCEPTION
                'Invalid maintenance cost transition from % to %.',
                OLD.status,
                NEW.status
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status_changed_by IS NULL
           OR NEW.status_changed_at IS NULL
           OR NEW.status_changed_at < OLD.status_changed_at
           OR NEW.status_change_reason IS NULL
           OR btrim(NEW.status_change_reason) = '' THEN
            RAISE EXCEPTION
                'Cost status change requires actor, timestamp and reason.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        IF NEW.status_changed_by IS DISTINCT FROM OLD.status_changed_by
           OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
           OR NEW.status_change_reason IS DISTINCT FROM OLD.status_change_reason THEN
            RAISE EXCEPTION
                'Cost status audit fields can only change with status.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF pg_trigger_depth() = 1
       AND NEW.approved_amount IS DISTINCT FROM OLD.approved_amount
       AND NEW.status NOT IN ('approved', 'incurred') THEN
        RAISE EXCEPTION
            'Approved amount is controlled by approved cost decisions.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_maintenance_cost_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_costs
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_cost_integrity();


CREATE OR REPLACE FUNCTION enforce_maintenance_cost_approval_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost maintenance_costs%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance cost approvals cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_cost
    FROM maintenance_costs
    WHERE id = NEW.maintenance_cost_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Cost approval references a cost that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.decision <> 'pending' THEN
            RAISE EXCEPTION
                'New cost approval must start as pending.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.approval_type = 'initial'
           AND v_cost.status <> 'submitted' THEN
            RAISE EXCEPTION
                'Initial approval requires a submitted cost.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.approval_type IN ('additional', 'correction')
           AND v_cost.status <> 'approved' THEN
            RAISE EXCEPTION
                'Additional or correction approval requires an approved cost.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.decision <> 'pending'
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Decided cost approval is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_cost_id IS DISTINCT FROM OLD.maintenance_cost_id
       OR NEW.approval_type IS DISTINCT FROM OLD.approval_type
       OR NEW.submitted_amount IS DISTINCT FROM OLD.submitted_amount
       OR NEW.submission_note IS DISTINCT FROM OLD.submission_note
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Cost approval submission identity is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.decision IS DISTINCT FROM OLD.decision
       AND NOT (
            OLD.decision = 'pending'
            AND NEW.decision IN (
                'approved',
                'rejected',
                'cancelled'
            )
       ) THEN
        RAISE EXCEPTION
            'Invalid maintenance cost approval decision transition.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_cost_approval_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_cost_approvals
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_cost_approval_integrity();


CREATE OR REPLACE FUNCTION synchronize_maintenance_cost_approval_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost maintenance_costs%ROWTYPE;
    v_approved_ceiling NUMERIC(14, 2);
BEGIN
    IF TG_OP <> 'UPDATE'
       OR NEW.decision IS NOT DISTINCT FROM OLD.decision THEN
        RETURN NULL;
    END IF;

    SELECT *
    INTO v_cost
    FROM maintenance_costs
    WHERE id = NEW.maintenance_cost_id
    FOR UPDATE;

    SELECT submitted_amount::NUMERIC(14, 2)
    INTO v_approved_ceiling
    FROM maintenance_cost_approvals
    WHERE maintenance_cost_id = NEW.maintenance_cost_id
      AND decision = 'approved'
    ORDER BY decided_at DESC, id DESC
    LIMIT 1;

    IF NEW.approval_type = 'initial' THEN
        IF NEW.decision = 'approved' THEN
            UPDATE maintenance_costs
            SET
                status = 'approved',
                approved_amount = NEW.submitted_amount,
                status_changed_by = NEW.decided_by,
                status_changed_at = NEW.decided_at,
                status_change_reason = NEW.decision_note
            WHERE id = NEW.maintenance_cost_id;
        ELSIF NEW.decision = 'rejected' THEN
            UPDATE maintenance_costs
            SET
                status = 'rejected',
                approved_amount = NULL,
                status_changed_by = NEW.decided_by,
                status_changed_at = NEW.decided_at,
                status_change_reason = NEW.decision_note
            WHERE id = NEW.maintenance_cost_id;
        ELSE
            UPDATE maintenance_costs
            SET
                status = 'cancelled',
                approved_amount = NULL,
                status_changed_by = NEW.decided_by,
                status_changed_at = NEW.decided_at,
                status_change_reason = NEW.decision_note
            WHERE id = NEW.maintenance_cost_id;
        END IF;
    ELSIF NEW.decision = 'approved' THEN
        UPDATE maintenance_costs
        SET approved_amount = v_approved_ceiling
        WHERE id = NEW.maintenance_cost_id;
    END IF;

    IF NEW.approval_type IN ('additional', 'correction') THEN
        PERFORM record_maintenance_activity(
            v_cost.maintenance_request_id,
            CASE NEW.decision
                WHEN 'approved' THEN 'cost_approved'
                WHEN 'rejected' THEN 'cost_rejected'
                ELSE 'cost_cancelled'
            END,
            jsonb_build_object('decision', OLD.decision),
            jsonb_build_object(
                'decision', NEW.decision,
                'submitted_amount', NEW.submitted_amount,
                'approval_type', NEW.approval_type
            ),
            NEW.decision_note,
            NEW.decided_by,
            jsonb_build_object(
                'cost_public_id', v_cost.public_id,
                'approval_public_id', NEW.public_id
            )
        );
    END IF;

    IF NEW.decision = 'approved' THEN
        PERFORM enqueue_maintenance_event(
            v_cost.maintenance_request_id,
            'maintenance_cost_approved',
            format(
                'maintenance-cost-approval:%s:%s',
                NEW.id,
                NEW.decision
            ),
            jsonb_build_object(
                'cost_public_id', v_cost.public_id,
                'approval_public_id', NEW.public_id,
                'submitted_amount', NEW.submitted_amount,
                'approval_type', NEW.approval_type
            ),
            NEW.decided_at
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER synchronize_maintenance_cost_approval
AFTER UPDATE OF decision ON maintenance_cost_approvals
FOR EACH ROW
EXECUTE FUNCTION synchronize_maintenance_cost_approval_trigger();


CREATE OR REPLACE FUNCTION synchronize_maintenance_request_cost_totals(
    p_request_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estimated NUMERIC(14, 2);
    v_approved NUMERIC(14, 2);
    v_actual NUMERIC(14, 2);
BEGIN
    SELECT
        COALESCE(
            SUM(estimated_amount) FILTER (
                WHERE status NOT IN ('rejected', 'cancelled')
            ),
            0
        )::NUMERIC(14, 2),
        COALESCE(
            SUM(approved_amount) FILTER (
                WHERE status IN ('approved', 'incurred')
            ),
            0
        )::NUMERIC(14, 2),
        COALESCE(
            SUM(actual_amount) FILTER (
                WHERE status = 'incurred'
            ),
            0
        )::NUMERIC(14, 2)
    INTO
        v_estimated,
        v_approved,
        v_actual
    FROM maintenance_costs
    WHERE maintenance_request_id = p_request_id;

    UPDATE maintenance_requests
    SET
        total_estimated_cost = v_estimated,
        total_approved_cost = v_approved,
        total_actual_cost = v_actual
    WHERE id = p_request_id;
END;
$$;


CREATE OR REPLACE FUNCTION synchronize_maintenance_cost_totals_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.maintenance_request_id <> NEW.maintenance_request_id THEN
        PERFORM synchronize_maintenance_request_cost_totals(
            OLD.maintenance_request_id
        );
    END IF;

    PERFORM synchronize_maintenance_request_cost_totals(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END
    );

    RETURN NULL;
END;
$$;


CREATE TRIGGER synchronize_maintenance_cost_totals
AFTER INSERT OR UPDATE OR DELETE ON maintenance_costs
FOR EACH ROW
EXECUTE FUNCTION synchronize_maintenance_cost_totals_trigger();


CREATE OR REPLACE FUNCTION record_maintenance_cost_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_activity_type VARCHAR(60);
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NULL;
    END IF;

    v_activity_type := CASE NEW.status
        WHEN 'draft' THEN 'cost_created'
        WHEN 'submitted' THEN 'cost_submitted'
        WHEN 'approved' THEN 'cost_approved'
        WHEN 'rejected' THEN 'cost_rejected'
        WHEN 'cancelled' THEN 'cost_cancelled'
        WHEN 'incurred' THEN 'cost_incurred'
    END;

    PERFORM record_maintenance_activity(
        NEW.maintenance_request_id,
        v_activity_type,
        CASE
            WHEN TG_OP = 'INSERT' THEN NULL
            ELSE jsonb_build_object('status', OLD.status)
        END,
        jsonb_build_object(
            'cost_public_id', NEW.public_id,
            'status', NEW.status,
            'estimated_amount', NEW.estimated_amount,
            'approved_amount', NEW.approved_amount,
            'actual_amount', NEW.actual_amount,
            'currency_code', NEW.currency_code
        ),
        NEW.status_change_reason,
        NEW.status_changed_by,
        '{}'::JSONB
    );

    IF NEW.status = 'submitted' THEN
        PERFORM enqueue_maintenance_event(
            NEW.maintenance_request_id,
            'maintenance_cost_submitted',
            format(
                'maintenance-cost:%s:submitted:%s',
                NEW.id,
                to_char(
                    NEW.status_changed_at AT TIME ZONE 'UTC',
                    'YYYYMMDDHH24MISSUS'
                )
            ),
            jsonb_build_object(
                'cost_public_id', NEW.public_id,
                'estimated_amount', NEW.estimated_amount,
                'currency_code', NEW.currency_code
            ),
            NEW.status_changed_at
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_cost_activity
AFTER INSERT OR UPDATE OF status ON maintenance_costs
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_cost_activity_trigger();


CREATE OR REPLACE FUNCTION validate_maintenance_cost_integrity(
    p_cost_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost maintenance_costs%ROWTYPE;
    v_approved_ceiling NUMERIC(14, 2);
BEGIN
    SELECT *
    INTO v_cost
    FROM maintenance_costs
    WHERE id = p_cost_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_cost.assignment_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM maintenance_assignments AS ma
            WHERE ma.id = v_cost.assignment_id
              AND ma.maintenance_request_id = v_cost.maintenance_request_id
       ) THEN
        RAISE EXCEPTION
            'Maintenance cost assignment and request are inconsistent.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT submitted_amount::NUMERIC(14, 2)
    INTO v_approved_ceiling
    FROM maintenance_cost_approvals
    WHERE maintenance_cost_id = v_cost.id
      AND decision = 'approved'
    ORDER BY decided_at DESC, id DESC
    LIMIT 1;

    IF v_cost.status IN ('approved', 'incurred') THEN
        IF v_approved_ceiling IS NULL
           OR v_cost.approved_amount <> v_approved_ceiling THEN
            RAISE EXCEPTION
                'Approved maintenance cost does not match approved decisions.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_cost.status = 'incurred'
       AND v_cost.actual_amount > v_cost.approved_amount THEN
        IF NOT EXISTS (
            SELECT 1
            FROM maintenance_cost_approvals AS mca
            WHERE mca.maintenance_cost_id = v_cost.id
              AND mca.approval_type IN ('additional', 'correction')
              AND mca.decision = 'approved'
              AND mca.submitted_amount >= v_cost.actual_amount
        ) THEN
            RAISE EXCEPTION
                'Actual maintenance cost exceeds approval without additional approval.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 9. RESPONSIBILITY AND ALLOCATION INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_responsibility_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance responsibility records cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT status
    INTO v_request_status
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance responsibility references a request that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT'
       AND v_request_status IN ('closed', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION
            'Responsibility cannot be added after terminal request status.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION
                'Maintenance responsibility identity is immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_request_status IN ('closed', 'rejected', 'cancelled')
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Responsibility cannot change after terminal request status.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_maintenance_responsibility_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_responsibilities
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_responsibility_integrity();


CREATE OR REPLACE FUNCTION synchronize_maintenance_responsibility_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE maintenance_requests
    SET
        coverage_type = NEW.coverage_type,
        responsibility_status = NEW.responsibility_status
    WHERE id = NEW.maintenance_request_id;

    IF TG_OP = 'INSERT'
       OR NEW.coverage_type IS DISTINCT FROM OLD.coverage_type
       OR NEW.responsibility_status IS DISTINCT FROM OLD.responsibility_status THEN
        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'responsibility_determined',
            CASE
                WHEN TG_OP = 'INSERT' THEN NULL
                ELSE jsonb_build_object(
                    'coverage_type', OLD.coverage_type,
                    'responsibility_status', OLD.responsibility_status
                )
            END,
            jsonb_build_object(
                'coverage_type', NEW.coverage_type,
                'responsibility_status', NEW.responsibility_status
            ),
            NEW.coverage_notes,
            NEW.determined_by,
            jsonb_build_object(
                'responsibility_public_id', NEW.public_id
            )
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER synchronize_maintenance_responsibility
AFTER INSERT OR UPDATE ON maintenance_responsibilities
FOR EACH ROW
EXECUTE FUNCTION synchronize_maintenance_responsibility_trigger();


CREATE OR REPLACE FUNCTION enforce_maintenance_allocation_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_responsibility_id BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance responsibility allocations cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    v_responsibility_id := CASE
        WHEN TG_OP = 'UPDATE' THEN OLD.maintenance_responsibility_id
        ELSE NEW.maintenance_responsibility_id
    END;

    SELECT mrq.*
    INTO v_request
    FROM maintenance_responsibilities AS mr
    JOIN maintenance_requests AS mrq
        ON mrq.id = mr.maintenance_request_id
    WHERE mr.id = v_responsibility_id
    FOR UPDATE OF mrq;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Responsibility allocation references an invalid responsibility record.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.maintenance_responsibility_id IS DISTINCT FROM OLD.maintenance_responsibility_id
           OR NEW.party_type IS DISTINCT FROM OLD.party_type
           OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
           OR NEW.provider_name IS DISTINCT FROM OLD.provider_name
           OR NEW.allocated_amount IS DISTINCT FROM OLD.allocated_amount
           OR NEW.allocation_percentage IS DISTINCT FROM OLD.allocation_percentage
           OR NEW.reason IS DISTINCT FROM OLD.reason
           OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION
                'Responsibility allocation financial identity is immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.revoked_at IS NOT NULL
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Revoked responsibility allocation is immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.revoked_at IS NULL
           AND NEW.revoked_at IS NULL
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Responsibility allocation can only be changed through revocation.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF v_request.status IN ('closed', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION
            'Allocation cannot be added to a terminal maintenance request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.party_type = 'tenant'
       AND NEW.tenant_id IS DISTINCT FROM v_request.tenant_id THEN
        RAISE EXCEPTION
            'Tenant responsibility allocation must reference the request tenant.'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM maintenance_responsibility_allocations AS mra
        WHERE mra.maintenance_responsibility_id = NEW.maintenance_responsibility_id
          AND mra.revoked_at IS NULL
          AND (
                (mra.allocated_amount IS NULL)
                <> (NEW.allocated_amount IS NULL)
          )
    ) THEN
        RAISE EXCEPTION
            'Responsibility allocations cannot mix amounts and percentages.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_allocation_integrity
BEFORE INSERT OR UPDATE OR DELETE
ON maintenance_responsibility_allocations
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_allocation_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_allocation_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    SELECT maintenance_request_id
    INTO v_request_id
    FROM maintenance_responsibilities
    WHERE id = NEW.maintenance_responsibility_id;

    IF TG_OP = 'INSERT' THEN
        PERFORM record_maintenance_activity(
            v_request_id,
            'responsibility_allocated',
            NULL,
            jsonb_build_object(
                'allocation_public_id', NEW.public_id,
                'party_type', NEW.party_type,
                'allocated_amount', NEW.allocated_amount,
                'allocation_percentage', NEW.allocation_percentage,
                'revoked', FALSE
            ),
            NEW.reason,
            NEW.approved_by,
            '{}'::JSONB
        );
    ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
        PERFORM record_maintenance_activity(
            v_request_id,
            'responsibility_allocated',
            jsonb_build_object(
                'allocation_public_id', OLD.public_id,
                'revoked', FALSE
            ),
            jsonb_build_object(
                'allocation_public_id', NEW.public_id,
                'revoked', TRUE
            ),
            NEW.revocation_reason,
            NEW.revoked_by,
            jsonb_build_object('operation', 'allocation_revoked')
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_allocation_activity
AFTER INSERT OR UPDATE OF revoked_at
ON maintenance_responsibility_allocations
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_allocation_activity_trigger();


CREATE OR REPLACE FUNCTION validate_maintenance_responsibility_integrity(
    p_request_id BIGINT,
    p_require_complete BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_responsibility maintenance_responsibilities%ROWTYPE;
    v_amount_rows BIGINT;
    v_percentage_rows BIGINT;
    v_amount_total NUMERIC(14, 2);
    v_percentage_total NUMERIC(9, 4);
BEGIN
    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT *
    INTO v_responsibility
    FROM maintenance_responsibilities
    WHERE maintenance_request_id = p_request_id;

    IF NOT FOUND THEN
        IF p_require_complete
           AND v_request.total_actual_cost > 0 THEN
            RAISE EXCEPTION
                'Actual maintenance cost requires a responsibility record.'
                USING ERRCODE = 'P0001';
        END IF;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM maintenance_responsibility_allocations AS mra
        WHERE mra.maintenance_responsibility_id = v_responsibility.id
          AND mra.revoked_at IS NULL
          AND mra.party_type = 'tenant'
          AND mra.tenant_id IS DISTINCT FROM v_request.tenant_id
    ) THEN
        RAISE EXCEPTION
            'Responsibility allocation contains a tenant unrelated to the request.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE allocated_amount IS NOT NULL),
        COUNT(*) FILTER (WHERE allocation_percentage IS NOT NULL),
        COALESCE(SUM(allocated_amount), 0)::NUMERIC(14, 2),
        COALESCE(SUM(allocation_percentage), 0)::NUMERIC(9, 4)
    INTO
        v_amount_rows,
        v_percentage_rows,
        v_amount_total,
        v_percentage_total
    FROM maintenance_responsibility_allocations
    WHERE maintenance_responsibility_id = v_responsibility.id
      AND revoked_at IS NULL;

    IF v_amount_rows > 0
       AND v_percentage_rows > 0 THEN
        RAISE EXCEPTION
            'Responsibility allocations cannot mix amount and percentage methods.'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_require_complete
       AND v_request.total_actual_cost > 0
       AND v_responsibility.responsibility_status IN (
            'tenant',
            'shared',
            'warranty_provider',
            'insurance_provider',
            'external_party'
       ) THEN
        IF v_amount_rows = 0
           AND v_percentage_rows = 0 THEN
            RAISE EXCEPTION
                'Completed responsibility requires allocation records.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_amount_rows > 0
           AND v_amount_total <> v_request.total_actual_cost THEN
            RAISE EXCEPTION
                'Responsibility amount allocations must equal actual maintenance cost.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_percentage_rows > 0
           AND v_percentage_total <> 100.0000 THEN
            RAISE EXCEPTION
                'Responsibility percentage allocations must total 100 percent.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
END;
$$;


-- =========================================================
-- 10. RESOLUTION, CONFIRMATION AND DISPUTE INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_resolution_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_expected_sequence INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance resolutions cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance resolution references a request that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_request.status <> 'in_progress' THEN
            RAISE EXCEPTION
                'Resolution can only be submitted for an in-progress request.'
                USING ERRCODE = 'P0001';
        END IF;

        SELECT COALESCE(MAX(sequence_number), 0) + 1
        INTO v_expected_sequence
        FROM maintenance_resolutions
        WHERE maintenance_request_id = NEW.maintenance_request_id;

        IF NEW.sequence_number <> v_expected_sequence THEN
            RAISE EXCEPTION
                'Resolution sequence must be %. Received %.',
                v_expected_sequence,
                NEW.sequence_number
                USING ERRCODE = 'P0001';
        END IF;

        IF v_request.tenant_id IS NULL THEN
            NEW.confirmation_status := 'not_required';
            NEW.confirmation_deadline_at := NULL;
        ELSE
            NEW.confirmation_status := 'pending';
            NEW.confirmation_deadline_at :=
                COALESCE(
                    NEW.confirmation_deadline_at,
                    NEW.submitted_at + INTERVAL '3 days'
                );
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
       OR NEW.resolution_summary IS DISTINCT FROM OLD.resolution_summary
       OR NEW.work_completed_at IS DISTINCT FROM OLD.work_completed_at
       OR NEW.actual_cost_summary IS DISTINCT FROM OLD.actual_cost_summary
       OR NEW.evidence_override_reason IS DISTINCT FROM OLD.evidence_override_reason
       OR NEW.confirmation_deadline_at IS DISTINCT FROM OLD.confirmation_deadline_at
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Submitted maintenance resolution details are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.confirmation_status <> 'pending'
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal resolution confirmation is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status
       AND NOT (
            OLD.confirmation_status = 'pending'
            AND NEW.confirmation_status IN (
                'confirmed',
                'disputed',
                'no_response'
            )
       ) THEN
        RAISE EXCEPTION
            'Invalid resolution confirmation transition.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_resolution_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_resolutions
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_resolution_integrity();


CREATE OR REPLACE FUNCTION synchronize_maintenance_resolution_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor BIGINT;
    v_reason TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE maintenance_requests
        SET
            status = 'resolved',
            resolution_confirmation_status = NEW.confirmation_status,
            resolution_confirmation_deadline_at = NEW.confirmation_deadline_at,
            status_changed_by = NEW.submitted_by,
            status_changed_at = NEW.submitted_at,
            status_change_reason = NEW.resolution_summary
        WHERE id = NEW.maintenance_request_id;


        RETURN NULL;
    END IF;

    IF NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status THEN
        v_actor := COALESCE(NEW.confirmed_by, NEW.disputed_by);
        v_reason := COALESCE(
            NEW.confirmation_note,
            NEW.dispute_reason,
            'Resolution confirmation updated.'
        );

        UPDATE maintenance_requests
        SET
            resolution_confirmation_status = NEW.confirmation_status,
            resolution_confirmation_deadline_at = NEW.confirmation_deadline_at
        WHERE id = NEW.maintenance_request_id;

        IF NEW.confirmation_status = 'disputed' THEN
            UPDATE maintenance_requests
            SET
                status = 'in_progress',
                status_changed_by = NEW.disputed_by,
                status_changed_at = NEW.disputed_at,
                status_change_reason = NEW.dispute_reason
            WHERE id = NEW.maintenance_request_id
              AND status = 'resolved';

            PERFORM record_maintenance_activity(
                NEW.maintenance_request_id,
                'resolution_disputed',
                jsonb_build_object(
                    'confirmation_status', OLD.confirmation_status
                ),
                jsonb_build_object(
                    'confirmation_status', NEW.confirmation_status
                ),
                NEW.dispute_reason,
                NEW.disputed_by,
                jsonb_build_object(
                    'resolution_public_id', NEW.public_id
                )
            );

            PERFORM enqueue_maintenance_event(
                NEW.maintenance_request_id,
                'maintenance_resolution_disputed',
                format('maintenance-resolution:%s:disputed', NEW.id),
                jsonb_build_object(
                    'resolution_public_id', NEW.public_id,
                    'dispute_reason', NEW.dispute_reason
                ),
                NEW.disputed_at
            );
        ELSE
            PERFORM record_maintenance_activity(
                NEW.maintenance_request_id,
                'resolution_confirmed',
                jsonb_build_object(
                    'confirmation_status', OLD.confirmation_status
                ),
                jsonb_build_object(
                    'confirmation_status', NEW.confirmation_status
                ),
                v_reason,
                v_actor,
                jsonb_build_object(
                    'resolution_public_id', NEW.public_id
                )
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER synchronize_maintenance_resolution
AFTER INSERT OR UPDATE OF confirmation_status
ON maintenance_resolutions
FOR EACH ROW
EXECUTE FUNCTION synchronize_maintenance_resolution_trigger();


-- =========================================================
-- 11. COMMENT, ATTACHMENT AND EVENT MUTATION PROTECTION
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_comment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance comments cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT status
        INTO v_request_status
        FROM maintenance_requests
        WHERE id = NEW.maintenance_request_id;

        IF v_request_status IN ('closed', 'rejected', 'cancelled') THEN
            RAISE EXCEPTION
                'New comments cannot be added to a terminal maintenance request.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.comment_type IS DISTINCT FROM OLD.comment_type
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance comment content and identity are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.hidden_at IS NOT NULL
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Hidden maintenance comment moderation audit is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_comment_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_comments
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_comment_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_comment_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'comment_added',
            NULL,
            jsonb_build_object(
                'comment_public_id', NEW.public_id,
                'comment_type', NEW.comment_type,
                'visibility', NEW.visibility
            ),
            NULL,
            NEW.created_by,
            '{}'::JSONB
        );
    ELSIF NEW.hidden_at IS DISTINCT FROM OLD.hidden_at THEN
        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'comment_hidden',
            jsonb_build_object('hidden', FALSE),
            jsonb_build_object('hidden', TRUE),
            NEW.moderation_reason,
            NEW.hidden_by,
            jsonb_build_object(
                'comment_public_id', NEW.public_id
            )
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_comment_activity
AFTER INSERT OR UPDATE OF hidden_at ON maintenance_comments
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_comment_activity_trigger();


CREATE OR REPLACE FUNCTION enforce_maintenance_attachment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_request_id BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance attachments cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT'
       AND EXISTS (
            SELECT 1
            FROM maintenance_requests AS mr
            WHERE mr.id = NEW.maintenance_request_id
              AND mr.status IN ('closed', 'rejected', 'cancelled')
       ) THEN
        RAISE EXCEPTION
            'Attachment cannot be added to a terminal maintenance request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.comment_id IS NOT NULL THEN
        SELECT maintenance_request_id
        INTO v_parent_request_id
        FROM maintenance_comments
        WHERE id = NEW.comment_id;
    ELSIF NEW.cost_id IS NOT NULL THEN
        SELECT maintenance_request_id
        INTO v_parent_request_id
        FROM maintenance_costs
        WHERE id = NEW.cost_id;
    ELSIF NEW.visit_id IS NOT NULL THEN
        SELECT maintenance_request_id
        INTO v_parent_request_id
        FROM maintenance_visits
        WHERE id = NEW.visit_id;
    ELSIF NEW.resolution_id IS NOT NULL THEN
        SELECT maintenance_request_id
        INTO v_parent_request_id
        FROM maintenance_resolutions
        WHERE id = NEW.resolution_id;
    ELSE
        v_parent_request_id := NEW.maintenance_request_id;
    END IF;

    IF v_parent_request_id IS DISTINCT FROM NEW.maintenance_request_id THEN
        RAISE EXCEPTION
            'Attachment context belongs to a different maintenance request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
           OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
           OR NEW.cost_id IS DISTINCT FROM OLD.cost_id
           OR NEW.visit_id IS DISTINCT FROM OLD.visit_id
           OR NEW.resolution_id IS DISTINCT FROM OLD.resolution_id
           OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type
           OR NEW.visibility IS DISTINCT FROM OLD.visibility
           OR NEW.original_file_name IS DISTINCT FROM OLD.original_file_name
           OR NEW.stored_file_name IS DISTINCT FROM OLD.stored_file_name
           OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
           OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
           OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
           OR NEW.file_checksum IS DISTINCT FROM OLD.file_checksum
           OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
           OR NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
            RAISE EXCEPTION
                'Attachment file identity and context are immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.revoked_at IS NOT NULL
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Revoked attachment audit is immutable.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_attachment_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_attachments
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_attachment_integrity();


CREATE OR REPLACE FUNCTION record_maintenance_attachment_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'attachment_added',
            NULL,
            jsonb_build_object(
                'attachment_public_id', NEW.public_id,
                'attachment_type', NEW.attachment_type,
                'visibility', NEW.visibility
            ),
            NEW.description,
            NEW.uploaded_by,
            '{}'::JSONB
        );
    ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'attachment_revoked',
            jsonb_build_object('revoked', FALSE),
            jsonb_build_object('revoked', TRUE),
            NEW.revocation_reason,
            NEW.revoked_by,
            jsonb_build_object(
                'attachment_public_id', NEW.public_id
            )
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_maintenance_attachment_activity
AFTER INSERT OR UPDATE OF revoked_at ON maintenance_attachments
FOR EACH ROW
EXECUTE FUNCTION record_maintenance_attachment_activity_trigger();


CREATE OR REPLACE FUNCTION enforce_maintenance_event_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance events cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.event_type IS DISTINCT FROM OLD.event_type
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Maintenance event identity and payload are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.processed_at IS NOT NULL
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Processed maintenance event is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.processing_attempts < OLD.processing_attempts THEN
        RAISE EXCEPTION
            'Maintenance event processing attempts cannot decrease.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.available_at < OLD.available_at THEN
        RAISE EXCEPTION
            'Maintenance event retry availability cannot move backwards.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_event_integrity
BEFORE UPDATE OR DELETE ON maintenance_events
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_event_integrity();


-- =========================================================
-- 12. REOPENING AND UNIT-STATUS LOCK INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_maintenance_reopen_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance reopening records cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT status
    INTO v_request_status
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id
    FOR UPDATE;

    IF TG_OP = 'INSERT' THEN
        IF v_request_status <> NEW.from_status THEN
            RAISE EXCEPTION
                'Reopening source status does not match current request status.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION
                'New reopening request must start as pending.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status <> 'pending'
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Decided reopening request is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
       OR NEW.from_status IS DISTINCT FROM OLD.from_status
       OR NEW.target_status IS DISTINCT FROM OLD.target_status
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
        RAISE EXCEPTION
            'Reopening request submission identity is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_reopen_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_reopen_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_reopen_integrity();


CREATE OR REPLACE FUNCTION apply_maintenance_unit_status(
    p_request_id BIGINT,
    p_actor_id BIGINT,
    p_reason TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
    v_unit units%ROWTYPE;
    v_restoration_status VARCHAR(30);
    v_lock_id BIGINT;
BEGIN
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION
            'Applying maintenance unit status requires a reason.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Maintenance request does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_request.request_scope <> 'unit'
       OR v_request.unit_id IS NULL
       OR v_request.impact_level <> 'uninhabitable' THEN
        RAISE EXCEPTION
            'Only an uninhabitable unit request can apply maintenance unit status.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT id
    INTO v_lock_id
    FROM maintenance_unit_status_locks
    WHERE maintenance_request_id = p_request_id
      AND is_active = TRUE
    FOR UPDATE;

    IF FOUND THEN
        RETURN v_lock_id;
    END IF;

    SELECT *
    INTO v_unit
    FROM units
    WHERE id = v_request.unit_id
    FOR UPDATE;

    IF NOT FOUND OR v_unit.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Maintenance unit is missing or deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT restoration_status
    INTO v_restoration_status
    FROM maintenance_unit_status_locks
    WHERE unit_id = v_unit.id
      AND is_active = TRUE
    ORDER BY applied_at, id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        v_restoration_status := v_unit.operational_status;
    END IF;

    PERFORM set_config(
        'app.maintenance_unit_lock_operation',
        'apply',
        TRUE
    );

    INSERT INTO maintenance_unit_status_locks (
        public_id,
        maintenance_request_id,
        unit_id,
        restoration_status,
        is_active,
        applied_by,
        applied_at
    )
    VALUES (
        maintenance_make_public_id(
            'maintenance_unit_lock_',
            20
        ),
        p_request_id,
        v_unit.id,
        v_restoration_status,
        TRUE,
        p_actor_id,
        CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_lock_id;

    PERFORM set_config(
        'app.maintenance_unit_lock_operation',
        '',
        TRUE
    );

    UPDATE units
    SET
        operational_status = 'maintenance',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_unit.id;

    PERFORM record_maintenance_activity(
        p_request_id,
        'unit_status_applied',
        jsonb_build_object(
            'operational_status', v_unit.operational_status
        ),
        jsonb_build_object(
            'operational_status', 'maintenance'
        ),
        p_reason,
        p_actor_id,
        jsonb_build_object(
            'unit_public_id', v_unit.public_id,
            'restoration_status', v_restoration_status
        )
    );

    RETURN v_lock_id;
END;
$$;


CREATE OR REPLACE FUNCTION release_maintenance_unit_status(
    p_request_id BIGINT,
    p_actor_id BIGINT,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_lock maintenance_unit_status_locks%ROWTYPE;
    v_remaining_lock_count BIGINT;
    v_unit units%ROWTYPE;
BEGIN
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION
            'Releasing maintenance unit status requires a reason.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_lock
    FROM maintenance_unit_status_locks
    WHERE maintenance_request_id = p_request_id
      AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT *
    INTO v_unit
    FROM units
    WHERE id = v_lock.unit_id
    FOR UPDATE;

    PERFORM set_config(
        'app.maintenance_unit_lock_operation',
        'release',
        TRUE
    );

    UPDATE maintenance_unit_status_locks
    SET
        is_active = FALSE,
        released_by = p_actor_id,
        released_at = CURRENT_TIMESTAMP,
        release_reason = p_reason
    WHERE id = v_lock.id;

    PERFORM set_config(
        'app.maintenance_unit_lock_operation',
        '',
        TRUE
    );

    SELECT COUNT(*)
    INTO v_remaining_lock_count
    FROM maintenance_unit_status_locks
    WHERE unit_id = v_lock.unit_id
      AND is_active = TRUE;

    IF v_remaining_lock_count = 0 THEN
        UPDATE units
        SET
            operational_status = v_lock.restoration_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_lock.unit_id;
    END IF;

    PERFORM record_maintenance_activity(
        p_request_id,
        'unit_status_released',
        jsonb_build_object(
            'operational_status', 'maintenance'
        ),
        jsonb_build_object(
            'operational_status',
            CASE
                WHEN v_remaining_lock_count = 0
                    THEN v_lock.restoration_status
                ELSE 'maintenance'
            END
        ),
        p_reason,
        p_actor_id,
        jsonb_build_object(
            'unit_public_id', v_unit.public_id,
            'remaining_active_locks', v_remaining_lock_count
        )
    );
END;
$$;


CREATE OR REPLACE FUNCTION enforce_maintenance_unit_lock_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request maintenance_requests%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Maintenance unit-status locks cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT'
       AND current_setting(
            'app.maintenance_unit_lock_operation',
            TRUE
       ) IS DISTINCT FROM 'apply' THEN
        RAISE EXCEPTION
            'Maintenance unit-status lock must be created through apply_maintenance_unit_status().'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE'
       AND current_setting(
            'app.maintenance_unit_lock_operation',
            TRUE
       ) IS DISTINCT FROM 'release' THEN
        RAISE EXCEPTION
            'Maintenance unit-status lock must be released through release_maintenance_unit_status().'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_request
    FROM maintenance_requests
    WHERE id = NEW.maintenance_request_id;

    IF NOT FOUND
       OR v_request.request_scope <> 'unit'
       OR v_request.unit_id <> NEW.unit_id
       OR v_request.impact_level <> 'uninhabitable' THEN
        RAISE EXCEPTION
            'Maintenance unit-status lock does not match its request.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
           OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
           OR NEW.restoration_status IS DISTINCT FROM OLD.restoration_status
           OR NEW.applied_by IS DISTINCT FROM OLD.applied_by
           OR NEW.applied_at IS DISTINCT FROM OLD.applied_at THEN
            RAISE EXCEPTION
                'Maintenance unit-status lock identity is immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.is_active = FALSE
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Released maintenance unit-status lock is immutable.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER enforce_maintenance_unit_lock_integrity
BEFORE INSERT OR UPDATE OR DELETE ON maintenance_unit_status_locks
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_unit_lock_integrity();


-- =========================================================
-- 13. PREVENTIVE PLAN AND OCCURRENCE INTEGRITY
-- =========================================================

CREATE OR REPLACE FUNCTION calculate_preventive_maintenance_next_due(
    p_plan_id BIGINT,
    p_from TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_plan preventive_maintenance_plans%ROWTYPE;
BEGIN
    SELECT *
    INTO v_plan
    FROM preventive_maintenance_plans
    WHERE id = p_plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Preventive maintenance plan does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN CASE v_plan.frequency
        WHEN 'one_time' THEN NULL
        WHEN 'weekly' THEN
            p_from + make_interval(weeks => v_plan.interval_value)
        WHEN 'monthly' THEN
            p_from + make_interval(months => v_plan.interval_value)
        WHEN 'quarterly' THEN
            p_from + make_interval(months => 3 * v_plan.interval_value)
        WHEN 'semi_annual' THEN
            p_from + make_interval(months => 6 * v_plan.interval_value)
        WHEN 'annual' THEN
            p_from + make_interval(years => v_plan.interval_value)
        WHEN 'custom' THEN
            p_from + make_interval(
                days => (
                    v_plan.custom_interval_days
                    * v_plan.interval_value
                )
            )
    END;
END;
$$;


CREATE OR REPLACE FUNCTION enforce_preventive_maintenance_plan_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Preventive maintenance plans cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status = 'active' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM owners AS o
            WHERE o.id = NEW.owner_id
              AND o.deleted_at IS NULL
              AND o.status = 'active'
        ) THEN
            RAISE EXCEPTION
                'Active preventive plan requires an active owner.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM properties AS p
            JOIN property_owners AS po
                ON po.property_id = p.id
               AND po.owner_id = NEW.owner_id
               AND po.effective_to IS NULL
            WHERE p.id = NEW.property_id
              AND p.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION
                'Active preventive plan property is not current for the owner.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.request_scope = 'unit'
           AND NOT EXISTS (
                SELECT 1
                FROM units AS u
                WHERE u.id = NEW.unit_id
                  AND u.property_id = NEW.property_id
                  AND u.deleted_at IS NULL
           ) THEN
            RAISE EXCEPTION
                'Active preventive plan unit must be current and belong to its property.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
           OR NEW.property_id IS DISTINCT FROM OLD.property_id
           OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
           OR NEW.request_scope IS DISTINCT FROM OLD.request_scope
           OR NEW.created_by IS DISTINCT FROM OLD.created_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION
                'Preventive maintenance plan identity and scope are immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.status IN ('completed', 'cancelled')
           AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'Terminal preventive maintenance plan is immutable.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (
                (OLD.status = 'active'
                    AND NEW.status IN (
                        'paused',
                        'completed',
                        'cancelled'
                    ))
                OR
                (OLD.status = 'paused'
                    AND NEW.status IN ('active', 'cancelled'))
           ) THEN
            RAISE EXCEPTION
                'Invalid preventive maintenance plan lifecycle transition.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_preventive_maintenance_plan_integrity
BEFORE INSERT OR UPDATE OR DELETE ON preventive_maintenance_plans
FOR EACH ROW
EXECUTE FUNCTION enforce_preventive_maintenance_plan_integrity();


CREATE OR REPLACE FUNCTION enforce_preventive_occurrence_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan preventive_maintenance_plans%ROWTYPE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Preventive maintenance occurrences cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_plan
    FROM preventive_maintenance_plans
    WHERE id = NEW.preventive_plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Preventive occurrence references a plan that does not exist.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION
                'New preventive occurrence must start as pending.'
                USING ERRCODE = 'P0001';
        END IF;

        IF v_plan.status <> 'active' THEN
            RAISE EXCEPTION
                'Occurrence can only be created for an active preventive plan.'
                USING ERRCODE = 'P0001';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.preventive_plan_id IS DISTINCT FROM OLD.preventive_plan_id
       OR NEW.due_at IS DISTINCT FROM OLD.due_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Preventive occurrence identity and due date are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF OLD.status <> 'pending'
       AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION
            'Terminal preventive occurrence is immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
            OLD.status = 'pending'
            AND NEW.status IN (
                'generated',
                'skipped',
                'failed',
                'cancelled'
            )
       ) THEN
        RAISE EXCEPTION
            'Invalid preventive occurrence lifecycle transition.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status = 'generated'
       AND v_plan.status <> 'active' THEN
        RAISE EXCEPTION
            'Generated occurrence requires an active preventive plan.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status = 'generated'
       AND NOT EXISTS (
            SELECT 1
            FROM maintenance_requests AS mr
            WHERE mr.id = NEW.maintenance_request_id
              AND mr.preventive_plan_id = NEW.preventive_plan_id
              AND mr.request_source = 'preventive_schedule'
       ) THEN
        RAISE EXCEPTION
            'Generated occurrence must reference its plan-generated maintenance request.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER b_enforce_preventive_occurrence_integrity
BEFORE INSERT OR UPDATE OR DELETE ON preventive_maintenance_occurrences
FOR EACH ROW
EXECUTE FUNCTION enforce_preventive_occurrence_integrity();


CREATE OR REPLACE FUNCTION record_preventive_occurrence_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'generated'
       AND NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE preventive_maintenance_plans
        SET
            last_generated_at = NEW.generated_at,
            next_due_at = CASE
                WHEN frequency = 'one_time' THEN next_due_at
                ELSE calculate_preventive_maintenance_next_due(
                    id,
                    NEW.due_at
                )
            END,
            status = CASE
                WHEN frequency = 'one_time' THEN 'completed'
                ELSE status
            END
        WHERE id = NEW.preventive_plan_id;

        PERFORM record_maintenance_activity(
            NEW.maintenance_request_id,
            'preventive_request_created',
            NULL,
            jsonb_build_object(
                'occurrence_public_id', NEW.public_id,
                'preventive_plan_id', NEW.preventive_plan_id,
                'due_at', NEW.due_at
            ),
            NULL,
            NULL,
            '{}'::JSONB
        );

        PERFORM enqueue_maintenance_event(
            NEW.maintenance_request_id,
            'preventive_request_created',
            format('preventive-occurrence:%s:generated', NEW.id),
            jsonb_build_object(
                'occurrence_public_id', NEW.public_id,
                'preventive_plan_id', NEW.preventive_plan_id,
                'due_at', NEW.due_at
            ),
            NEW.generated_at
        );
    END IF;

    RETURN NULL;
END;
$$;


CREATE TRIGGER record_preventive_occurrence_activity
AFTER UPDATE OF status ON preventive_maintenance_occurrences
FOR EACH ROW
EXECUTE FUNCTION record_preventive_occurrence_activity_trigger();


-- =========================================================
-- 14. IMMUTABLE HISTORY AND GENERIC HARD-DELETE PROTECTION
-- =========================================================

CREATE TRIGGER enforce_maintenance_status_history_append_only
BEFORE UPDATE OR DELETE ON maintenance_status_history
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_append_only();

CREATE TRIGGER enforce_maintenance_visit_history_append_only
BEFORE UPDATE OR DELETE ON maintenance_visit_history
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_append_only();

CREATE TRIGGER enforce_maintenance_activity_history_append_only
BEFORE UPDATE OR DELETE ON maintenance_activity_history
FOR EACH ROW
EXECUTE FUNCTION enforce_maintenance_append_only();


CREATE TRIGGER prevent_maintenance_reopen_delete
BEFORE DELETE ON maintenance_reopen_requests
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_unit_lock_delete
BEFORE DELETE ON maintenance_unit_status_locks
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_cost_approval_delete
BEFORE DELETE ON maintenance_cost_approvals
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_responsibility_delete
BEFORE DELETE ON maintenance_responsibilities
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_allocation_delete
BEFORE DELETE ON maintenance_responsibility_allocations
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_resolution_delete
BEFORE DELETE ON maintenance_resolutions
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_comment_delete
BEFORE DELETE ON maintenance_comments
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_attachment_delete
BEFORE DELETE ON maintenance_attachments
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();

CREATE TRIGGER prevent_maintenance_event_delete
BEFORE DELETE ON maintenance_events
FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_hard_delete();


-- =========================================================
-- 15. DEFERRED CROSS-TABLE VALIDATION
-- =========================================================

CREATE OR REPLACE FUNCTION validate_maintenance_request_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM validate_maintenance_request_integrity(
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END
    );

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER constraint_maintenance_requests_integrity
AFTER INSERT OR UPDATE ON maintenance_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_maintenance_request_row_trigger();


CREATE OR REPLACE FUNCTION validate_related_maintenance_request_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'maintenance_assignments' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSIF TG_TABLE_NAME = 'maintenance_visits' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSIF TG_TABLE_NAME = 'maintenance_costs' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSIF TG_TABLE_NAME = 'maintenance_responsibilities' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSIF TG_TABLE_NAME = 'maintenance_resolutions' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSIF TG_TABLE_NAME = 'maintenance_attachments' THEN
        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSE
        RAISE EXCEPTION
            'Unsupported related maintenance validation table: %.',
            TG_TABLE_NAME
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM validate_maintenance_request_integrity(v_request_id);

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER constraint_maintenance_assignments_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_visits_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_visits
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_costs_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_costs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_responsibility_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_responsibilities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_resolutions_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_resolutions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_attachments_request
AFTER INSERT OR UPDATE OR DELETE ON maintenance_attachments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_related_maintenance_request_trigger();


CREATE OR REPLACE FUNCTION validate_maintenance_cost_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cost_id BIGINT;
    v_request_id BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'maintenance_costs' THEN
        v_cost_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END;

        v_request_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
            ELSE NEW.maintenance_request_id
        END;
    ELSE
        v_cost_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.maintenance_cost_id
            ELSE NEW.maintenance_cost_id
        END;

        SELECT maintenance_request_id
        INTO v_request_id
        FROM maintenance_costs
        WHERE id = v_cost_id;
    END IF;

    PERFORM validate_maintenance_cost_integrity(v_cost_id);
    PERFORM validate_maintenance_request_integrity(v_request_id);

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER constraint_maintenance_cost_integrity
AFTER INSERT OR UPDATE ON maintenance_costs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_maintenance_cost_row_trigger();

CREATE CONSTRAINT TRIGGER constraint_maintenance_cost_approval_integrity
AFTER INSERT OR UPDATE OR DELETE ON maintenance_cost_approvals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_maintenance_cost_row_trigger();


CREATE OR REPLACE FUNCTION validate_maintenance_allocation_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    SELECT mr.maintenance_request_id
    INTO v_request_id
    FROM maintenance_responsibilities AS mr
    WHERE mr.id = CASE
        WHEN TG_OP = 'DELETE' THEN OLD.maintenance_responsibility_id
        ELSE NEW.maintenance_responsibility_id
    END;

    PERFORM validate_maintenance_responsibility_integrity(
        v_request_id,
        FALSE
    );

    PERFORM validate_maintenance_request_integrity(v_request_id);

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER constraint_maintenance_allocations_integrity
AFTER INSERT OR UPDATE OR DELETE
ON maintenance_responsibility_allocations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_maintenance_allocation_row_trigger();


CREATE OR REPLACE FUNCTION validate_preventive_occurrence_row_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_id BIGINT;
BEGIN
    v_request_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.maintenance_request_id
        ELSE NEW.maintenance_request_id
    END;

    IF v_request_id IS NOT NULL THEN
        PERFORM validate_maintenance_request_integrity(v_request_id);
    END IF;

    RETURN NULL;
END;
$$;


CREATE CONSTRAINT TRIGGER constraint_preventive_occurrence_request
AFTER INSERT OR UPDATE OR DELETE ON preventive_maintenance_occurrences
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_preventive_occurrence_row_trigger();


-- =========================================================
-- 16. VALIDATE EXISTING DATA
-- =========================================================

DO $$
DECLARE
    v_request_id BIGINT;
    v_request_status VARCHAR(30);
    v_cost_id BIGINT;
BEGIN
    FOR v_cost_id IN
        SELECT id
        FROM maintenance_costs
    LOOP
        PERFORM validate_maintenance_cost_integrity(v_cost_id);
    END LOOP;

    FOR v_request_id, v_request_status IN
        SELECT id, status
        FROM maintenance_requests
    LOOP
        PERFORM validate_maintenance_responsibility_integrity(
            v_request_id,
            v_request_status = 'closed'
        );

        PERFORM validate_maintenance_request_integrity(v_request_id);
    END LOOP;
END;
$$;


-- =========================================================
-- 17. DOCUMENTATION
-- =========================================================

COMMENT ON FUNCTION validate_maintenance_request_integrity(BIGINT) IS
'Validates owner/property/unit/tenant/lease relationships, cost totals, responsibility summary, resolution evidence and closure readiness.';

COMMENT ON FUNCTION validate_maintenance_cost_integrity(BIGINT) IS
'Validates assignment linkage, approved amount, approval ceiling and additional approval for cost overruns.';

COMMENT ON FUNCTION validate_maintenance_responsibility_integrity(BIGINT, BOOLEAN) IS
'Validates responsibility tenant linkage and complete amount/percentage allocations when request closure requires them.';

COMMENT ON FUNCTION apply_maintenance_unit_status(BIGINT, BIGINT, TEXT) IS
'Applies maintenance status to an uninhabitable unit with row locking and preserves its restoration status.';

COMMENT ON FUNCTION release_maintenance_unit_status(BIGINT, BIGINT, TEXT) IS
'Releases one request unit-status lock and restores the unit only after the final active maintenance lock is released.';

COMMENT ON FUNCTION calculate_preventive_maintenance_next_due(BIGINT, TIMESTAMPTZ) IS
'Calculates the next due timestamp from a preventive plan frequency and interval.';

COMMENT ON FUNCTION refresh_maintenance_sla_flags(BIGINT) IS
'Recalculates review, work-start and resolution overdue flags for one maintenance request.';


SET CONSTRAINTS ALL IMMEDIATE;

COMMIT;