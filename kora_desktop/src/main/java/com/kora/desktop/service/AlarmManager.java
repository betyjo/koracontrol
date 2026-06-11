package com.kora.desktop.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import com.kora.desktop.device.TagEngine;

public class AlarmManager {

    public enum Severity {
        CRITICAL, HIGH, MEDIUM, LOW
    }

    public enum State {
        ACTIVE, ACKNOWLEDGED, CLEARED
    }

    public static class Alarm {
        public String id;
        public String tag;
        public String message;
        public Severity severity;
        public State state;
        public LocalDateTime timestamp;
        public String acknowledgedBy;

        public Alarm(String tag, String message, Severity severity) {
            this.id = UUID.randomUUID().toString();
            this.tag = tag;
            this.message = message;
            this.severity = severity;
            this.state = State.ACTIVE;
            this.timestamp = LocalDateTime.now();
            this.acknowledgedBy = "—";
        }

        public String getFormattedTimestamp() {
            return timestamp.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        }
    }

    private static AlarmManager instance;
    private final List<Alarm> alarms = new ArrayList<>();
    private final List<Consumer<List<Alarm>>> listeners = new CopyOnWriteArrayList<>();

    private AlarmManager() {}

    public static AlarmManager getInstance() {
        if (instance == null) {
            instance = new AlarmManager();
        }
        return instance;
    }

    public void setOnAlarmsChanged(Consumer<List<Alarm>> callback) {
        this.listeners.add(callback);
    }

    public void addAlarmListener(Consumer<List<Alarm>> callback) {
        this.listeners.add(callback);
    }

    public void raiseAlarm(String tag, String message, Severity severity) {
        // Check if active alarm already exists for tag
        boolean exists = alarms.stream()
                .anyMatch(a -> a.tag.equals(tag) && a.state == State.ACTIVE);
        
        if (!exists) {
            Alarm alarm = new Alarm(tag, message, severity);
            alarms.add(0, alarm); // Add to top
            notifyListeners();
        }
    }

    public void clearAlarm(String tag) {
        boolean changed = false;
        for (Alarm alarm : alarms) {
            if (alarm.tag.equals(tag) && alarm.state == State.ACTIVE) {
                alarm.state = State.CLEARED;
                changed = true;
            }
        }
        if (changed) {
            notifyListeners();
        }
    }

    public void acknowledge(String id, String user) {
        boolean changed = false;
        for (Alarm alarm : alarms) {
            if (alarm.id.equals(id) && alarm.state == State.ACTIVE) {
                alarm.state = State.ACKNOWLEDGED;
                alarm.acknowledgedBy = user;
                changed = true;
            }
        }
        if (changed) {
            notifyListeners();
        }
    }

    public void acknowledgeAll(String user) {
        boolean changed = false;
        for (Alarm alarm : alarms) {
            if (alarm.state == State.ACTIVE) {
                alarm.state = State.ACKNOWLEDGED;
                alarm.acknowledgedBy = user;
                changed = true;
            }
        }
        if (changed) {
            notifyListeners();
        }
    }

    public List<Alarm> getAllAlarms() {
        return new ArrayList<>(alarms);
    }

    public int getActiveCount() {
        return (int) alarms.stream().filter(a -> a.state == State.ACTIVE).count();
    }

    private void notifyListeners() {
        List<Alarm> snapshot = getAllAlarms();
        for (Consumer<List<Alarm>> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    public void checkTagConditions() {
        TagEngine engine = TagEngine.getInstance();
        
        double tankA = engine.getDoubleTag("tank_a_level");
        if (tankA >= 90) raiseAlarm("tank_a_level", "Tank A level critically high", Severity.CRITICAL);
        else clearAlarm("tank_a_level");

        double pressure = engine.getDoubleTag("pressure");
        if (pressure >= 8.5) raiseAlarm("pressure", "Pressure above setpoint", Severity.HIGH);
        else clearAlarm("pressure");
        
        double temp = engine.getDoubleTag("temperature");
        if (temp >= 100) raiseAlarm("temperature", "Temperature critical", Severity.CRITICAL);
        else if (temp >= 85) raiseAlarm("temperature", "Temperature high warning", Severity.MEDIUM);
        else clearAlarm("temperature");
    }
}
