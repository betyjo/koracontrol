package com.kora.desktop.service;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * Manages operator shift tracking, event logging, and shift report generation.
 * Shifts are auto-detected based on time of day:
 *   Morning:   06:00 - 14:00
 *   Afternoon: 14:00 - 22:00
 *   Night:     22:00 - 06:00
 */
public class ShiftManager {

    public enum ShiftType {
        MORNING("Morning", "06:00", "14:00"),
        AFTERNOON("Afternoon", "14:00", "22:00"),
        NIGHT("Night", "22:00", "06:00");

        public final String displayName;
        public final String startHour;
        public final String endHour;

        ShiftType(String displayName, String startHour, String endHour) {
            this.displayName = displayName;
            this.startHour = startHour;
            this.endHour = endHour;
        }
    }

    public static class ShiftEvent {
        public final Instant timestamp;
        public final String category;
        public final String message;

        public ShiftEvent(String category, String message) {
            this.timestamp = Instant.now();
            this.category = category;
            this.message = message;
        }

        public String getFormattedTime() {
            return LocalDateTime.ofInstant(timestamp, ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("HH:mm:ss"));
        }
    }

    private static ShiftManager instance;

    private String operatorName = "System";
    private ShiftType currentShift;
    private Instant shiftStartTime;
    private final List<ShiftEvent> events = new ArrayList<>();
    private Consumer<ShiftEvent> onEventLogged;
    private boolean shiftActive = false;

    private ShiftManager() {
        currentShift = detectCurrentShift();
    }

    public static ShiftManager getInstance() {
        if (instance == null) {
            instance = new ShiftManager();
        }
        return instance;
    }

    // ──────────────────────────── Shift Lifecycle ────────────────────────────

    /**
     * Starts a new shift for the given operator.
     */
    public void startShift(String operator) {
        this.operatorName = operator != null ? operator : "System";
        this.shiftStartTime = Instant.now();
        this.currentShift = detectCurrentShift();
        this.shiftActive = true;
        this.events.clear();
        logEvent("SHIFT", "Shift started by " + operatorName + " (" + currentShift.displayName + " shift)");
    }

    /**
     * Ends the current shift and returns the list of events.
     */
    public List<ShiftEvent> endShift() {
        if (!shiftActive) return Collections.emptyList();
        logEvent("SHIFT", "Shift ended by " + operatorName);
        shiftActive = false;
        List<ShiftEvent> copy = new ArrayList<>(events);
        return copy;
    }

    /**
     * Logs an event to the current shift.
     */
    public void logEvent(String category, String message) {
        ShiftEvent event = new ShiftEvent(category, message);
        events.add(event);
        if (onEventLogged != null) {
            onEventLogged.accept(event);
        }
    }

    // ──────────────────────────── Accessors ────────────────────────────

    public String getOperatorName() { return operatorName; }
    public ShiftType getCurrentShift() { return currentShift; }
    public Instant getShiftStartTime() { return shiftStartTime; }
    public boolean isShiftActive() { return shiftActive; }
    public List<ShiftEvent> getEvents() { return Collections.unmodifiableList(events); }

    public void setOnEventLogged(Consumer<ShiftEvent> callback) {
        this.onEventLogged = callback;
    }

    /**
     * Returns formatted shift duration string (HH:MM:SS).
     */
    public String getShiftDuration() {
        if (shiftStartTime == null) return "00:00:00";
        long seconds = Duration.between(shiftStartTime, Instant.now()).getSeconds();
        long h = seconds / 3600;
        long m = (seconds % 3600) / 60;
        long s = seconds % 60;
        return String.format("%02d:%02d:%02d", h, m, s);
    }

    /**
     * Returns the number of events in each category.
     */
    public long getEventCount(String category) {
        return events.stream().filter(e -> e.category.equalsIgnoreCase(category)).count();
    }

    // ──────────────────────────── Shift Detection ────────────────────────────

    /**
     * Auto-detects the current shift based on the time of day.
     */
    public static ShiftType detectCurrentShift() {
        int hour = LocalDateTime.now().getHour();
        if (hour >= 6 && hour < 14) return ShiftType.MORNING;
        if (hour >= 14 && hour < 22) return ShiftType.AFTERNOON;
        return ShiftType.NIGHT;
    }

    // ──────────────────────────── Export ────────────────────────────

    /**
     * Exports the current shift report to a text file.
     *
     * @param directory target directory
     * @return the created File, or null on failure
     */
    public File exportShiftReport(File directory) {
        if (events.isEmpty()) return null;

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "shift_report_" + currentShift.displayName.toLowerCase() + "_" + timestamp + ".txt";
        File file = new File(directory, filename);

        try (BufferedWriter writer = new BufferedWriter(new FileWriter(file))) {
            writer.write("╔══════════════════════════════════════════════╗\n");
            writer.write("║        KORA SCADA - SHIFT REPORT             ║\n");
            writer.write("╚══════════════════════════════════════════════╝\n\n");

            writer.write("Shift:      " + currentShift.displayName + "\n");
            writer.write("Operator:   " + operatorName + "\n");
            writer.write("Started:    " + formatInstant(shiftStartTime) + "\n");
            writer.write("Duration:   " + getShiftDuration() + "\n");
            writer.write("Status:     " + (shiftActive ? "ACTIVE" : "ENDED") + "\n");
            writer.write("Total Events: " + events.size() + "\n\n");

            writer.write("──────────────────────────────────────────────────\n");
            writer.write("EVENT LOG\n");
            writer.write("──────────────────────────────────────────────────\n\n");

            for (ShiftEvent event : events) {
                writer.write(String.format("[%s] [%-8s] %s%n",
                        event.getFormattedTime(), event.category, event.message));
            }

            writer.write("\n──────────────────────────────────────────────────\n");
            writer.write("SUMMARY\n");
            writer.write("──────────────────────────────────────────────────\n");
            writer.write("Alarms:    " + getEventCount("ALARM") + "\n");
            writer.write("Commands:  " + getEventCount("COMMAND") + "\n");
            writer.write("Mode Changes: " + getEventCount("MODE") + "\n");
            writer.write("System:    " + getEventCount("SYSTEM") + "\n");
            writer.write("\n--- End of Report ---\n");

            return file;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }

    private String formatInstant(Instant instant) {
        if (instant == null) return "--";
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
