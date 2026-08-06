BEGIN;

-- =========================================================
-- NOTIFICATION RECIPIENT DECISIONS
-- Immutable audit of every recipient considered while a
-- source event is converted into user notifications.
--
-- A decision is either:
-- - created: an in-app notification exists for the recipient;
-- - suppressed: preferences intentionally prevented creation.
-- =========================================================

CREATE TABLE notification_recipient_decisions (
    id BIGSERIAL PRIMARY KEY,

    public_id VARCHAR(100) NOT NULL,

    notification_event_id BIGINT NOT NULL,
    recipient_user_id BIGINT NOT NULL,
    notification_id BIGINT,

    decision VARCHAR(20) NOT NULL,
    decision_reason VARCHAR(50) NOT NULL,

    candidate_roles TEXT[]
        NOT NULL
        DEFAULT ARRAY[]::TEXT[],

    notification_category VARCHAR(40) NOT NULL,
    notification_priority VARCHAR(20) NOT NULL,

    scheduled_available_at TIMESTAMPTZ,

    preference_snapshot JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_recipient_decisions_public_id
        UNIQUE (public_id),

    CONSTRAINT uq_notification_recipient_event_user
        UNIQUE (
            notification_event_id,
            recipient_user_id
        ),

    CONSTRAINT uq_notification_recipient_notification
        UNIQUE (notification_id),

    CONSTRAINT chk_notification_recipient_decision_public_id
        CHECK (
            public_id ~
            '^notification_recipient_decision_[A-Za-z0-9_-]+$'
        ),

    CONSTRAINT chk_notification_recipient_decision_value
        CHECK (
            decision IN (
                'created',
                'suppressed'
            )
        ),

    CONSTRAINT chk_notification_recipient_decision_reason
        CHECK (
            decision_reason IN (
                'created',
                'notifications_disabled',
                'in_app_disabled',
                'category_disabled',
                'below_minimum_priority',
                'digest_disabled'
            )
        ),

    CONSTRAINT chk_notification_recipient_roles
        CHECK (
            cardinality(candidate_roles) > 0
        ),

    CONSTRAINT chk_notification_recipient_category
        CHECK (
            notification_category IN (
                'maintenance',
                'preventive_maintenance'
            )
        ),

    CONSTRAINT chk_notification_recipient_priority
        CHECK (
            notification_priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    CONSTRAINT chk_notification_recipient_preference_snapshot
        CHECK (
            jsonb_typeof(preference_snapshot) = 'object'
        ),

    CONSTRAINT chk_notification_recipient_decision_state
        CHECK (
            (
                decision = 'created'
                AND decision_reason = 'created'
                AND notification_id IS NOT NULL
                AND scheduled_available_at IS NOT NULL
            )
            OR
            (
                decision = 'suppressed'
                AND decision_reason <> 'created'
                AND notification_id IS NULL
                AND scheduled_available_at IS NULL
            )
        ),

    CONSTRAINT fk_notification_recipient_decision_event
        FOREIGN KEY (notification_event_id)
        REFERENCES notification_event_deduplication(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_recipient_decision_user
        FOREIGN KEY (recipient_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_recipient_decision_notification
        FOREIGN KEY (notification_id)
        REFERENCES notifications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_notification_recipient_decisions_user
ON notification_recipient_decisions (
    recipient_user_id,
    created_at DESC,
    id DESC
);

CREATE INDEX idx_notification_recipient_decisions_event
ON notification_recipient_decisions (
    notification_event_id,
    decision,
    created_at DESC
);

CREATE INDEX idx_notification_recipient_decisions_suppressed
ON notification_recipient_decisions (
    decision_reason,
    created_at DESC
)
WHERE decision = 'suppressed';


-- =========================================================
-- PRIORITY RANK HELPER
-- Keeps minimum-priority evaluation consistent between
-- workers and future notification sources.
-- =========================================================

CREATE OR REPLACE FUNCTION notification_priority_rank(
    p_priority VARCHAR
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT CASE p_priority
        WHEN 'low' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'high' THEN 3
        WHEN 'urgent' THEN 4
        ELSE 0
    END;
$$;


-- =========================================================
-- DELIVERY AVAILABILITY HELPER
-- Applies digest scheduling and quiet hours in the user's
-- PostgreSQL timezone without requiring a JavaScript timezone
-- dependency.
-- =========================================================

CREATE OR REPLACE FUNCTION calculate_notification_available_at(
    p_reference_at TIMESTAMPTZ,
    p_digest_frequency VARCHAR,
    p_quiet_hours_enabled BOOLEAN,
    p_quiet_hours_start TIME,
    p_quiet_hours_end TIME,
    p_timezone VARCHAR
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_timezone VARCHAR := COALESCE(
        NULLIF(btrim(p_timezone), ''),
        'UTC'
    );
    v_local_reference TIMESTAMP;
    v_local_candidate TIMESTAMP;
    v_candidate TIMESTAMPTZ;
    v_candidate_local_time TIME;
    v_candidate_local_date DATE;
    v_inside_quiet_hours BOOLEAN := FALSE;
BEGIN
    IF p_reference_at IS NULL THEN
        RAISE EXCEPTION
            'Notification reference timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_digest_frequency NOT IN (
        'immediate',
        'daily',
        'weekly',
        'disabled'
    ) THEN
        RAISE EXCEPTION
            'Unsupported notification digest frequency: %.',
            p_digest_frequency
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_timezone_names
        WHERE name = v_timezone
    ) THEN
        RAISE EXCEPTION
            'Notification timezone is not recognized by PostgreSQL: %.',
            v_timezone
            USING ERRCODE = '22023';
    END IF;

    IF p_digest_frequency = 'disabled' THEN
        RETURN NULL;
    END IF;

    v_local_reference :=
        p_reference_at AT TIME ZONE v_timezone;

    IF p_digest_frequency = 'immediate' THEN
        v_candidate := p_reference_at;
    ELSIF p_digest_frequency = 'daily' THEN
        v_local_candidate :=
            date_trunc('day', v_local_reference)
            + INTERVAL '9 hours';

        IF v_local_candidate <= v_local_reference THEN
            v_local_candidate :=
                v_local_candidate + INTERVAL '1 day';
        END IF;

        v_candidate :=
            v_local_candidate AT TIME ZONE v_timezone;
    ELSE
        v_local_candidate :=
            date_trunc('week', v_local_reference)
            + INTERVAL '9 hours';

        IF v_local_candidate <= v_local_reference THEN
            v_local_candidate :=
                v_local_candidate + INTERVAL '7 days';
        END IF;

        v_candidate :=
            v_local_candidate AT TIME ZONE v_timezone;
    END IF;

    IF COALESCE(p_quiet_hours_enabled, FALSE) = FALSE THEN
        RETURN GREATEST(v_candidate, p_reference_at);
    END IF;

    IF p_quiet_hours_start IS NULL
       OR p_quiet_hours_end IS NULL
       OR p_quiet_hours_start = p_quiet_hours_end THEN
        RAISE EXCEPTION
            'Enabled notification quiet hours require different start and end times.'
            USING ERRCODE = '22023';
    END IF;

    v_local_candidate :=
        v_candidate AT TIME ZONE v_timezone;
    v_candidate_local_time :=
        v_local_candidate::TIME;
    v_candidate_local_date :=
        v_local_candidate::DATE;

    IF p_quiet_hours_start < p_quiet_hours_end THEN
        v_inside_quiet_hours :=
            v_candidate_local_time >= p_quiet_hours_start
            AND
            v_candidate_local_time < p_quiet_hours_end;

        IF v_inside_quiet_hours THEN
            v_local_candidate :=
                v_candidate_local_date
                + p_quiet_hours_end;
        END IF;
    ELSE
        v_inside_quiet_hours :=
            v_candidate_local_time >= p_quiet_hours_start
            OR
            v_candidate_local_time < p_quiet_hours_end;

        IF v_inside_quiet_hours THEN
            IF v_candidate_local_time >= p_quiet_hours_start THEN
                v_local_candidate :=
                    (v_candidate_local_date + 1)
                    + p_quiet_hours_end;
            ELSE
                v_local_candidate :=
                    v_candidate_local_date
                    + p_quiet_hours_end;
            END IF;
        END IF;
    END IF;

    IF v_inside_quiet_hours THEN
        v_candidate :=
            v_local_candidate AT TIME ZONE v_timezone;
    END IF;

    RETURN GREATEST(v_candidate, p_reference_at);
END;
$$;


-- =========================================================
-- IMMUTABLE DECISION AUDIT
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_notification_recipient_decision_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Notification recipient decisions cannot be hard deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'Notification recipient decisions are immutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_notification_recipient_decision_integrity
BEFORE UPDATE OR DELETE
ON notification_recipient_decisions
FOR EACH ROW
EXECUTE FUNCTION enforce_notification_recipient_decision_integrity();


-- =========================================================
-- DOCUMENTATION
-- =========================================================

COMMENT ON TABLE notification_recipient_decisions IS
'Immutable per-recipient audit showing whether a registered source event created an in-app notification or was suppressed by user preferences.';

COMMENT ON COLUMN notification_recipient_decisions.candidate_roles IS
'All recipient-resolution paths that selected the user, such as admin, owner_user, tenant_user, assigned_technician or reporter.';

COMMENT ON FUNCTION calculate_notification_available_at(
    TIMESTAMPTZ,
    VARCHAR,
    BOOLEAN,
    TIME,
    TIME,
    VARCHAR
) IS
'Calculates notification availability after digest and quiet-hours rules in the recipient timezone.';

COMMIT;
