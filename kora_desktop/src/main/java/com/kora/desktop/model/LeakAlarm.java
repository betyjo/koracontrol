package com.kora.desktop.model;

import java.time.LocalDateTime;

public class LeakAlarm {
    private final String id;
    private final LocalDateTime timestamp;
    private final LeakSeverity severity;
    private final String message;
    private boolean acknowledged;

    public LeakAlarm(String id, LocalDateTime timestamp, LeakSeverity severity, String message) {
        this.id = id;
        this.timestamp = timestamp;
        this.severity = severity;
        this.message = message;
        this.acknowledged = false;
    }

    public String getId() { return id; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public LeakSeverity getSeverity() { return severity; }
    public String getMessage() { return message; }
    public boolean isAcknowledged() { return acknowledged; }
    public void setAcknowledged(boolean acknowledged) { this.acknowledged = acknowledged; }
}
