from django.utils import timezone

from .models import AlarmEvent, AlarmRule, TagLog


OPEN_STATES = ["active", "acknowledged", "shelved"]


def evaluate_alarm_for_log(tag_log: TagLog) -> None:
    """
    Evaluate all enabled alarm rules for an incoming tag log and update
    alarm lifecycle state in near real-time.

    Trip uses strict thresholds. Clear uses deadband (hysteresis) so noise
    around a threshold does not chatter between active and returned.
    """
    rules = AlarmRule.objects.filter(tag_id=tag_log.tag_id, is_enabled=True)
    for rule in rules:
        _evaluate_rule(rule, tag_log)


def _evaluate_rule(rule: AlarmRule, tag_log: TagLog) -> None:
    now = timezone.now()
    db = float(rule.deadband or 0.0)

    event = (
        AlarmEvent.objects.filter(rule=rule, state__in=OPEN_STATES)
        .order_by("-triggered_at")
        .first()
    )

    if event and event.state == "shelved" and event.shelved_until and event.shelved_until <= now:
        event.state = "acknowledged" if event.acknowledged_at else "active"
        event.shelved_until = None
        event.save(update_fields=["state", "shelved_until"])

    value = float(tag_log.value)

    if event:
        _evaluate_with_open_event(rule, tag_log, event, value, db, now)
        return

    level = _classify_strict(rule, value)
    if level is None:
        return

    message = _build_message(rule, level, value)
    AlarmEvent.objects.create(
        rule=rule,
        tag_log=tag_log,
        level=level,
        state="active",
        triggered_value=value,
        message=message,
    )


def _evaluate_with_open_event(
    rule: AlarmRule,
    tag_log: TagLog,
    event: AlarmEvent,
    value: float,
    deadband: float,
    now,
) -> None:
    """Update or close an existing open event using hysteresis on clear."""
    strict = _classify_strict(rule, value)

    if event.level == "alarm":
        if strict == "alarm":
            _refresh_open_event(event, tag_log, value, "alarm")
            return
        if strict == "warning":
            side = _infer_side(rule, event.triggered_value, "alarm")
            if side and _still_latched_alarm(rule, value, deadband, side):
                _refresh_open_event(event, tag_log, value, "alarm")
                return
            _refresh_open_event(event, tag_log, value, "warning")
            return

        side = _infer_side(rule, event.triggered_value, "alarm")
        if side and _still_latched_alarm(rule, value, deadband, side):
            _refresh_open_event(event, tag_log, value, "alarm")
            return

        _close_event_returned(event, tag_log, value, now)
        _maybe_open_after_return(rule, tag_log, value)
        return

    # event.level == 'warning'
    if strict == "alarm":
        _refresh_open_event(event, tag_log, value, "alarm")
        return

    if strict == "warning":
        _refresh_open_event(event, tag_log, value, "warning")
        return

    side = _infer_side(rule, event.triggered_value, "warning")
    if side and _still_latched_warning(rule, value, deadband, side):
        _refresh_open_event(event, tag_log, value, "warning")
        return

    _close_event_returned(event, tag_log, value, now)
    _maybe_open_after_return(rule, tag_log, value)


def _maybe_open_after_return(rule: AlarmRule, tag_log: TagLog, value: float) -> None:
    """If process immediately violates strict thresholds after close, open a new event."""
    level = _classify_strict(rule, value)
    if level is None:
        return
    message = _build_message(rule, level, value)
    AlarmEvent.objects.create(
        rule=rule,
        tag_log=tag_log,
        level=level,
        state="active",
        triggered_value=value,
        message=message,
    )


def _refresh_open_event(event: AlarmEvent, tag_log: TagLog, value: float, level: str) -> None:
    message = _build_message(event.rule, level, value)
    event.level = level
    event.triggered_value = value
    event.message = message
    event.tag_log = tag_log
    event.save(update_fields=["level", "triggered_value", "message", "tag_log"])


def _close_event_returned(event: AlarmEvent, tag_log: TagLog, value: float, now) -> None:
    event.state = "returned"
    event.returned_to_normal_at = now
    event.tag_log = tag_log
    event.save(update_fields=["state", "returned_to_normal_at", "tag_log"])


def _build_message(rule: AlarmRule, level: str, value: float) -> str:
    return f"{rule.tag.name} {level} threshold crossed at {value}"


def _classify_strict(rule: AlarmRule, value: float) -> str | None:
    """Trip / classify using nominal thresholds (no hysteresis)."""
    if rule.alarm_high is not None and value >= rule.alarm_high:
        return "alarm"
    if rule.alarm_low is not None and value <= rule.alarm_low:
        return "alarm"
    if rule.warning_high is not None and value >= rule.warning_high:
        return "warning"
    if rule.warning_low is not None and value <= rule.warning_low:
        return "warning"
    return None


def _infer_side(rule: AlarmRule, triggered_value: float, kind: str) -> str | None:
    """Infer 'high' or 'low' boundary for latch logic using trip-time value."""
    if kind == "alarm":
        hi, lo = rule.alarm_high, rule.alarm_low
    else:
        hi, lo = rule.warning_high, rule.warning_low

    has_hi = hi is not None
    has_lo = lo is not None

    if has_hi and triggered_value >= hi:
        return "high"
    if has_lo and triggered_value <= lo:
        return "low"
    if has_hi and not has_lo:
        return "high"
    if has_lo and not has_hi:
        return "low"
    if has_hi and has_lo:
        dh = abs(triggered_value - hi)
        dl = abs(triggered_value - lo)
        return "high" if dh <= dl else "low"
    return None


def _still_latched_alarm(rule: AlarmRule, value: float, deadband: float, side: str) -> bool:
    """True whilevalue stays inside the latched alarm band past the clear line."""
    if side == "high" and rule.alarm_high is not None:
        clear_below = rule.alarm_high - deadband
        return value >= clear_below
    if side == "low" and rule.alarm_low is not None:
        clear_above = rule.alarm_low + deadband
        return value <= clear_above
    return False


def _still_latched_warning(rule: AlarmRule, value: float, deadband: float, side: str) -> bool:
    if side == "high" and rule.warning_high is not None:
        clear_below = rule.warning_high - deadband
        return value >= clear_below
    if side == "low" and rule.warning_low is not None:
        clear_above = rule.warning_low + deadband
        return value <= clear_above
    return False
