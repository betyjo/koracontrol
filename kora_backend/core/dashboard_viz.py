"""Dashboard visualization helpers (levels, gauges, thresholds)."""


def normalized_ratio(value, scale_min, scale_max):
    if value is None or scale_max <= scale_min:
        return None
    r = (float(value) - float(scale_min)) / (float(scale_max) - float(scale_min))
    return max(0.0, min(1.0, r))


def status_level_for_value(value, alarm_high, alarm_low, warning_high, warning_low):
    """
    Alarm > Warning > Normal.
    Unset thresholds are ignored.
    """
    if value is None:
        return "normal"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "normal"

    if alarm_high is not None and v >= float(alarm_high):
        return "alarm"
    if alarm_low is not None and v <= float(alarm_low):
        return "alarm"
    if warning_high is not None and v >= float(warning_high):
        return "warning"
    if warning_low is not None and v <= float(warning_low):
        return "warning"
    return "normal"


def gauge_needle_degrees(fill_ratio):
    """Map 0–1 ratio to SVG needle rotation (-135 to +135), 0 pointing left-ish."""
    if fill_ratio is None:
        return -135
    angle = -135 + fill_ratio * 270
    return max(-135, min(135, angle))
