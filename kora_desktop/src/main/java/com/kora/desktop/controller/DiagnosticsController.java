package com.kora.desktop.controller;

import com.kora.desktop.device.TagEngine;
import com.kora.desktop.service.AlarmManager;
import com.kora.desktop.service.DataService;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.util.Duration;

import java.net.URL;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ResourceBundle;

public class DiagnosticsController implements Initializable {

    // ── MQTT fields ──
    @FXML private Label mqttStatusLabel;
    @FXML private Label mqttMsgCountLabel;
    @FXML private Label mqttReconnectLabel;

    // ── Tag Engine fields ──
    @FXML private Label doubleTagCountLabel;
    @FXML private Label booleanTagCountLabel;
    @FXML private Label stringTagCountLabel;
    @FXML private Label totalTagCountLabel;

    // ── JVM fields ──
    @FXML private Label jvmUsedLabel;
    @FXML private Label jvmMaxLabel;
    @FXML private Label jvmPercentLabel;
    @FXML private ProgressBar jvmProgressBar;

    // ── Uptime fields ──
    @FXML private Label uptimeValueLabel;
    @FXML private Label uptimeSinceLabel;

    // ── Alarm system fields ──
    @FXML private Label activeAlarmsLabel;
    @FXML private Label ackedAlarmsLabel;
    @FXML private Label totalAlarmsLabel;

    // ── Engine info fields ──
    @FXML private Label javaVersionLabel;
    @FXML private Label javafxVersionLabel;
    @FXML private Label processorCountLabel;

    // ── Header ──
    @FXML private Label lastUpdateLabel;

    private DataService dataService;
    private Timeline updateTimeline;
    private Instant appStartTime;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        appStartTime = Instant.now();
        updateSinceLabel();
        populateStaticInfo();
        startPolling();
    }

    public void setDataService(DataService dataService) {
        this.dataService = dataService;
    }

    private void populateStaticInfo() {
        // Java version
        String javaVer = System.getProperty("java.version");
        if (javaVersionLabel != null) javaVersionLabel.setText(javaVer != null ? javaVer : "Unknown");

        // JavaFX version
        String javafxVer = System.getProperty("javafx.version");
        if (javafxVersionLabel != null) javafxVersionLabel.setText(javafxVer != null ? javafxVer : "21");

        // Available processors
        int processors = Runtime.getRuntime().availableProcessors();
        if (processorCountLabel != null) processorCountLabel.setText(String.valueOf(processors));
    }

    private void updateSinceLabel() {
        if (uptimeSinceLabel != null) {
            LocalDateTime since = LocalDateTime.ofInstant(appStartTime, ZoneId.systemDefault());
            uptimeSinceLabel.setText("Since: " + since.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }
    }

    private void startPolling() {
        updateTimeline = new Timeline(new KeyFrame(Duration.seconds(2), e -> updateDiagnostics()));
        updateTimeline.setCycleCount(Timeline.INDEFINITE);
        updateTimeline.play();
        // Immediate first update
        Platform.runLater(this::updateDiagnostics);
    }

    private void updateDiagnostics() {
        updateMQTTStatus();
        updateTagEngineStats();
        updateJVMMemory();
        updateUptime();
        updateAlarmStats();
        if (lastUpdateLabel != null) {
            lastUpdateLabel.setText("Last update: " +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")));
        }
    }

    private void updateMQTTStatus() {
        if (dataService != null) {
            boolean connected = dataService.isConnected();
            if (mqttStatusLabel != null) {
                mqttStatusLabel.setText(connected ? "CONNECTED" : "DISCONNECTED");
                mqttStatusLabel.setStyle(connected
                    ? "-fx-background-color: #00ff9d; -fx-text-fill: #071426; -fx-font-weight: bold; -fx-padding: 4px 12px; -fx-background-radius: 12;"
                    : "-fx-background-color: #ff4444; -fx-text-fill: white; -fx-font-weight: bold; -fx-padding: 4px 12px; -fx-background-radius: 12;");
            }
            if (mqttMsgCountLabel != null) {
                mqttMsgCountLabel.setText(String.valueOf(dataService.getMessageCount()));
            }
            if (mqttReconnectLabel != null) {
                mqttReconnectLabel.setText(String.valueOf(dataService.getReconnectCount()));
            }
        } else {
            if (mqttStatusLabel != null) {
                mqttStatusLabel.setText("NO SERVICE");
                mqttStatusLabel.setStyle("-fx-background-color: #ff9d00; -fx-text-fill: #071426; -fx-font-weight: bold; -fx-padding: 4px 12px; -fx-background-radius: 12;");
            }
        }
    }

    private void updateTagEngineStats() {
        TagEngine engine = TagEngine.getInstance();
        int dCount = engine.getDoubleTagCount();
        int bCount = engine.getBooleanTagCount();
        int sCount = engine.getStringTagCount();

        if (doubleTagCountLabel != null) doubleTagCountLabel.setText(String.valueOf(dCount));
        if (booleanTagCountLabel != null) booleanTagCountLabel.setText(String.valueOf(bCount));
        if (stringTagCountLabel != null) stringTagCountLabel.setText(String.valueOf(sCount));
        if (totalTagCountLabel != null) totalTagCountLabel.setText(String.valueOf(dCount + bCount + sCount));
    }

    private void updateJVMMemory() {
        Runtime runtime = Runtime.getRuntime();
        long maxMem = runtime.maxMemory();
        long totalMem = runtime.totalMemory();
        long freeMem = runtime.freeMemory();
        long usedMem = totalMem - freeMem;

        long usedMB = usedMem / (1024 * 1024);
        long maxMB = maxMem / (1024 * 1024);
        double percent = maxMem > 0 ? (double) usedMem / maxMem * 100 : 0;

        if (jvmUsedLabel != null) jvmUsedLabel.setText(usedMB + " MB");
        if (jvmMaxLabel != null) jvmMaxLabel.setText(maxMB + " MB");
        if (jvmProgressBar != null) jvmProgressBar.setProgress(percent / 100.0);
        if (jvmPercentLabel != null) jvmPercentLabel.setText(String.format("%.1f%% used", percent));
    }

    private void updateUptime() {
        if (appStartTime != null && uptimeValueLabel != null) {
            long seconds = java.time.Duration.between(appStartTime, Instant.now()).getSeconds();
            long h = seconds / 3600;
            long m = (seconds % 3600) / 60;
            long s = seconds % 60;
            uptimeValueLabel.setText(String.format("%02d:%02d:%02d", h, m, s));
        }
    }

    private void updateAlarmStats() {
        AlarmManager am = AlarmManager.getInstance();
        List<AlarmManager.Alarm> all = am.getAllAlarms();
        long active = all.stream().filter(a -> a.state == AlarmManager.State.ACTIVE).count();
        long acked = all.stream().filter(a -> a.state == AlarmManager.State.ACKNOWLEDGED).count();

        if (activeAlarmsLabel != null) activeAlarmsLabel.setText(String.valueOf(active));
        if (ackedAlarmsLabel != null) ackedAlarmsLabel.setText(String.valueOf(acked));
        if (totalAlarmsLabel != null) totalAlarmsLabel.setText(String.valueOf(all.size()));
    }

    public void cleanup() {
        if (updateTimeline != null) updateTimeline.stop();
    }
}
