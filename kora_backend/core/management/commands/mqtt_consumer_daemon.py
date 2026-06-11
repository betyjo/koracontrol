"""
KORA Backend — MQTT Consumer Daemon

Subscribes to the simulation bridge MQTT topics, persists incoming sensor
values into `TagLog`, and pushes them onto the in-process SSE bus so any
connected `/realtime/stream/` client receives them.

Topics
------
- kora/sensor/data   (aggregated payload from serial_mqtt_bridge.py)
- kora/scada/tags    (per-tag values, see mqtt_service.py)
- kora/tag/<name>    (per-tag values, also published by mqtt_service.py)

Run with:
    python manage.py mqtt_consumer_daemon
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import close_old_connections

import json
import logging
import os
import signal
import time

logger = logging.getLogger(__name__)


def _is_mqtt_available() -> bool:
    try:
        import paho.mqtt.client  # noqa: F401
        return True
    except Exception:
        return False


PAHO_AVAILABLE = _is_mqtt_available()

# Map incoming MQTT tag names to canonical Tag.name in the database.
# The bridge emits e.g. "tank_a_level" — we use the same names so the
# frontend and the alarms daemon can resolve them without an extra join.
TAG_NAME_MAP = {
    "tank_a_level": "tank_a_level",
    "tank_a_pressure": "tank_a_pressure",
    "tank_a_temperature": "tank_a_temperature",
    "tank_a_ph": "tank_a_ph",
    "tank_a_turbidity": "tank_a_turbidity",
    "tank_b_level": "tank_b_level",
    "tank_b_pressure": "tank_b_pressure",
    "tank_b_temperature": "tank_b_temperature",
    "tank_b_ph": "tank_b_ph",
    "tank_b_turbidity": "tank_b_turbidity",
    "tank_c_level": "tank_c_level",
    "tank_c_pressure": "tank_c_pressure",
    "tank_c_temperature": "tank_c_temperature",
    "tank_c_ph": "tank_c_ph",
    "tank_c_turbidity": "tank_c_turbidity",
    "flow_rate": "flow_rate",
    "system_pressure": "system_pressure",
    "total_volume": "total_volume",
    "tank_level": "tank_level",
    "pump_status": "pump_status",
    "pressure": "pressure",
    "temperature": "temperature",
    "ph_level": "ph_level",
    "turbidity": "turbidity",
    "inlet_valve": "inlet_valve",
    "outlet_valve": "outlet_valve",
    "bypass_valve": "bypass_valve",
    "pid_output": "pid_output",
    "pump_vibration": "pump_vibration",
    "pump_vfd_speed": "pump_vfd_speed",
}


def _coerce_float(value):
    """Try to coerce a value into a float. Returns None if not possible."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Status strings like "ON" / "OPEN" cannot be stored as a float
        # in TagLog — those are handled separately as binary tags if needed.
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _persist_value(tag_name: str, value):
    """
    Persist a single (tag, value) pair into TagLog. Tags are auto-created
    on first sight so the daemon is zero-config for new sensors.
    """
    from core.models import Tag, TagLog

    # Lazy import to avoid Django app-loading side effects in management
    # command discovery.
    close_old_connections()

    canonical = TAG_NAME_MAP.get(tag_name, tag_name)
    numeric = _coerce_float(value)
    if numeric is None:
        # Non-numeric values (e.g. "ON", "OPEN") are skipped here. The
        # raw state is still published to the SSE bus downstream.
        return False

    tag, _ = Tag.objects.get_or_create(
        name=canonical,
        defaults={"data_type": "float", "unit": ""},
    )
    TagLog.objects.create(
        tag=tag,
        value=numeric,
        quality_code="good",
        source_timestamp=timezone.now(),
    )
    return True


def _publish_sse(channel: str, event_type: str, data: dict):
    """
    Push a single event onto the SSE bus. The bus lives in
    core.realtime_service; importing here avoids loading MQTT on Django
    startup.
    """
    try:
        from core.realtime_service import sse_bus
        sse_bus.publish(channel, data, event_type=event_type)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to publish SSE event %s: %s", event_type, exc)


def _build_cascade_state(payload: dict) -> dict:
    """Project a raw MQTT payload into the cascade shape the UI expects."""
    def _f(key, default=None):
        v = payload.get(key, default)
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    def _b(key, default=False):
        v = payload.get(key)
        if v is None:
            return default
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return v != 0
        if isinstance(v, str):
            return v.strip().upper() in {"ON", "OPEN", "TRUE", "1"}
        return default

    return {
        "tankA": {
            "level": _f("tank_a_level", 0.0) or 0.0,
            "inflow": _f("tank_a_inflow", 0.0) or 0.0,
            "outflow": _f("tank_a_outflow", 0.0) or 0.0,
            "pressure": _f("tank_a_pressure", 0.0) or 0.0,
            "temperature": _f("tank_a_temperature", 0.0) or 0.0,
        },
        "tankB": {
            "level": _f("tank_b_level", 0.0) or 0.0,
            "inflow": _f("tank_b_inflow", 0.0) or 0.0,
            "outflow": _f("tank_b_outflow", 0.0) or 0.0,
            "pressure": _f("tank_b_pressure", 0.0) or 0.0,
            "temperature": _f("tank_b_temperature", 0.0) or 0.0,
        },
        "tankC": {
            "level": _f("tank_c_level", 0.0) or 0.0,
            "inflow": _f("tank_c_inflow", 0.0) or 0.0,
            "outflow": _f("tank_c_outflow", 0.0) or 0.0,
            "pressure": _f("tank_c_pressure", 0.0) or 0.0,
            "temperature": _f("tank_c_temperature", 0.0) or 0.0,
        },
        "mainFlow": _f("flow_rate", 0.0) or 0.0,
        "pressure": _f("system_pressure", _f("pressure", 0.0)) or 0.0,
        "temperature": _f("temperature", 0.0) or 0.0,
        "totalVolume": _f("total_volume", 0.0) or 0.0,
        "pumpStatus": (
            "running" if str(payload.get("tank_a_pump", payload.get("pump_status", "OFF"))).upper() == "ON"
            else "stopped"
        ),
        "valveStatus": {
            "inlet": _b("inlet_valve", True),
            "outlet": _b("outlet_valve", True),
            "bypass": _b("bypass_valve", False),
        },
        "source": payload.get("source", "simulation"),
        "timestamp": time.time(),
    }


class Command(BaseCommand):
    help = "Consume MQTT sensor topics, persist TagLogs, and push SSE events."

    def add_arguments(self, parser):
        parser.add_argument(
            "--broker",
            default=os.environ.get("MQTT_BROKER_HOST", "localhost"),
        )
        parser.add_argument(
            "--port",
            type=int,
            default=int(os.environ.get("MQTT_BROKER_PORT", "1883")),
        )
        parser.add_argument(
            "--topic",
            action="append",
            default=["kora/sensor/data", "kora/scada/tags", "kora/tag/#"],
            help="MQTT topic(s) to subscribe to. May be passed multiple times.",
        )

    # --- paho-mqtt callbacks -------------------------------------------------

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        for topic in self.topics:
            self.stdout.write(self.style.SUCCESS(f"📡 Subscribing to {topic}"))
            client.subscribe(topic, qos=0)
        self.stdout.write(self.style.SUCCESS(f"✅ Connected to MQTT broker (code {reason_code})"))

    def _on_message(self, client, userdata, msg):
        try:
            payload_raw = msg.payload.decode("utf-8", errors="ignore")
            payload = json.loads(payload_raw)
        except json.JSONDecodeError:
            logger.debug("Non-JSON payload on %s: %r", msg.topic, msg.payload)
            return
        except Exception as exc:
            logger.warning("Failed to decode MQTT message on %s: %s", msg.topic, exc)
            return

        # Per-tag topic: kora/tag/<name> — payload is { tag_name, value, ... }
        if msg.topic.startswith("kora/tag/"):
            tag_name = payload.get("tag_name") or msg.topic.split("/", 2)[-1]
            value = payload.get("value")
            self._handle_value(tag_name, value)
            return

        # Aggregated payloads: dict of { tag_name: value, ... }
        if isinstance(payload, dict):
            for key, value in payload.items():
                if key in {"type", "timestamp", "tag_name", "quality"}:
                    continue
                self._handle_value(key, value)

            # Build + publish the cascade projection
            cascade_state = _build_cascade_state(payload)
            _publish_sse("process", "process_state", cascade_state)
            _publish_sse("tags", "tag_update", {
                "type": "tag_update",
                "payload": payload,
            })

    def _handle_value(self, tag_name: str, value):
        try:
            _persist_value(tag_name, value)
        except Exception as exc:  # pragma: no cover - DB safety
            logger.exception("Failed to persist %s=%s: %s", tag_name, value, exc)
        _publish_sse("tags", "tag_update", {
            "type": "tag_update",
            "tag_name": tag_name,
            "value": value,
        })

    # --- entrypoint ----------------------------------------------------------

    def handle(self, *args, **options):
        if not PAHO_AVAILABLE:
            self.stderr.write(self.style.ERROR(
                "paho-mqtt is not installed. Run `pip install paho-mqtt` and retry."
            ))
            return

        import paho.mqtt.client as mqtt

        self.broker = options["broker"]
        self.port = options["port"]
        self.topics = options["topic"]
        self.running = True

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = self._on_connect
        client.on_message = self._on_message

        def _shutdown(signum, frame):
            self.stdout.write(self.style.WARNING(f"\n🛑 Signal {signum} received, stopping…"))
            self.running = False
            try:
                client.disconnect()
            except Exception:
                pass

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        self.stdout.write(self.style.SUCCESS(
            f"🚀 MQTT consumer connecting to {self.broker}:{self.port} …"
        ))
        try:
            client.connect(self.broker, self.port, keepalive=60)
        except Exception as exc:
            self.stderr.write(self.style.ERROR(
                f"❌ Could not connect to MQTT broker: {exc}\n"
                f"   Is an MQTT broker running on {self.broker}:{self.port}?\n"
                f"   For a quick local broker run: docker run -p 1883:1883 eclipse-mosquitto"
            ))
            return

        client.loop_start()
        self.stdout.write(self.style.SUCCESS(
            "🟢 MQTT consumer running. Press Ctrl+C to stop."
        ))

        try:
            while self.running:
                time.sleep(1)
        finally:
            client.loop_stop()
            try:
                client.disconnect()
            except Exception:
                pass
            self.stdout.write(self.style.SUCCESS("🏁 MQTT consumer stopped."))
