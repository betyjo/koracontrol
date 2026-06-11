package com.kora.desktop.service;

import com.kora.desktop.model.LeakAlarm;
import com.kora.desktop.model.LeakSeverity;
import com.kora.desktop.device.TagEngine;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Simple mock leak detection service.
 * In a real project this would load a pre‑trained IsolationForest model via DJL.
 * For simulation we use basic threshold logic on the provided sensor map.
 */
public class LeakDetectionService {
    private static final double FLOW_RATE_LOW_THRESHOLD = 2.0; // m³/s
    private static final double PRESSURE_DROP_THRESHOLD = 5.0; // bar

    private final TagEngine tagEngine = TagEngine.getInstance();

    /**
     * Detect a leak based on simulated sensor values.
     * @param sensorData map of tag name -> value (e.g., "flow_rate", "pressure")
     * @return LeakSeverity indicating the severity of a potential leak.
     */
    public LeakSeverity detectLeak(Map<String, Double> sensorData) {
        double flow = sensorData.getOrDefault("flow_rate", 0.0);
        double pressure = sensorData.getOrDefault("pressure", 0.0);
        // Simple heuristic: low flow and sudden pressure drop indicate a leak.
        if (flow < FLOW_RATE_LOW_THRESHOLD && pressure < PRESSURE_DROP_THRESHOLD) {
            return LeakSeverity.HIGH;
        } else if (flow < FLOW_RATE_LOW_THRESHOLD * 2) {
            return LeakSeverity.MEDIUM;
        } else {
            return LeakSeverity.LOW;
        }
    }

    /**
     * Retrieve the latest sensor data from TagEngine.
     */
    private Map<String, Double> fetchSensorData() {
        // Example tags – adjust to actual tag names in the simulation.
        return Map.of(
            "flow_rate", tagEngine.getDoubleTag("flow_rate"),
            "pressure", tagEngine.getDoubleTag("pressure")
        );
    }

    /**
     * Convenience method to create a LeakAlarm from current sensor data.
     * @return LeakAlarm instance or null if no data available.
     */
    public LeakAlarm detectLeak() {
        Map<String, Double> sensorData = fetchSensorData();
        if (sensorData == null || sensorData.isEmpty()) {
            return null;
        }
        LeakSeverity severity = detectLeak(sensorData);
        String id = UUID.randomUUID().toString();
        String message = "Leak detection: " + severity.name() +
                " (flow=" + sensorData.getOrDefault("flow_rate", 0.0) +
                ", pressure=" + sensorData.getOrDefault("pressure", 0.0) + ")";
        return new LeakAlarm(id, LocalDateTime.now(), severity, message);
}
}
