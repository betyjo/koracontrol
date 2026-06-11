package com.kora.desktop.controller;

import com.kora.desktop.device.TagEngine;
import com.kora.desktop.service.AuditService;
import com.kora.desktop.service.AuthService;
import com.kora.desktop.service.DataService;
import com.kora.desktop.service.KoraAlert;

import javafx.animation.Animation;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.*;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

import java.net.URL;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ResourceBundle;

public class ControlPanelController implements Initializable {

    @FXML private BorderPane rootPane;
    @FXML private Label modeIndicator;
    @FXML private Label userLabel;

    // Mode
    @FXML private ToggleButton manualModeBtn;
    @FXML private ToggleButton autoModeBtn;

    // Equipment feedback
    @FXML private Label pump1Feedback;
    @FXML private Label pump2Feedback;
    @FXML private Label inletFeedback;
    @FXML private Label outletFeedback;

    // Equipment buttons
    @FXML private Button pump1StartBtn, pump1StopBtn;
    @FXML private Button pump2StartBtn, pump2StopBtn;
    @FXML private Button inletOpenBtn, inletCloseBtn;
    @FXML private Button outletOpenBtn, outletCloseBtn;
    @FXML private Button emergencyStopBtn;

    // Setpoints
    @FXML private Slider flowSlider, pressureSlider, tempSlider, levelSlider;
    @FXML private TextField flowValueField, pressureValueField, tempValueField, levelValueField;
    @FXML private Button flowSetBtn, pressureSetBtn, tempSetBtn, levelSetBtn;
    @FXML private Label flowCurrentLabel, pressureCurrentLabel, tempCurrentLabel, levelCurrentLabel;

    // Command log
    @FXML private VBox commandLogBox;

    private boolean isManualMode = true;
    private Timeline updateTimeline;
    private final TagEngine engine = TagEngine.getInstance();
    private final DataService dataService = new DataService();
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");
    private int commandCount = 0;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupModeSelector();
        setupEquipmentControls();
        setupSetpoints();
        setupEmergencyStop();
        updateCurrentUser();
        bindFeedback();
        startLiveUpdates();
    }

    private void updateCurrentUser() {
        String username = AuthService.getInstance().getUsername();
        userLabel.setText(username != null ? username : "Operator");
    }

    private void setupModeSelector() {
        ToggleGroup group = new ToggleGroup();
        manualModeBtn.setToggleGroup(group);
        autoModeBtn.setToggleGroup(group);
        manualModeBtn.setSelected(true);

        manualModeBtn.setOnAction(e -> {
            isManualMode = true;
            modeIndicator.setText("MANUAL MODE");
            modeIndicator.setStyle("-fx-text-fill: #ff9d00; -fx-font-weight: bold; -fx-font-size: 14px;");
            setManualControlsEnabled(true);
        });
        autoModeBtn.setOnAction(e -> {
            isManualMode = false;
            modeIndicator.setText("AUTO MODE");
            modeIndicator.setStyle("-fx-text-fill: #00ff9d; -fx-font-weight: bold; -fx-font-size: 14px;");
            setManualControlsEnabled(false);
        });
    }

    private void setManualControlsEnabled(boolean enabled) {
        pump1StartBtn.setDisable(!enabled);
        pump1StopBtn.setDisable(!enabled);
        pump2StartBtn.setDisable(!enabled);
        pump2StopBtn.setDisable(!enabled);
        inletOpenBtn.setDisable(!enabled);
        inletCloseBtn.setDisable(!enabled);
        outletOpenBtn.setDisable(!enabled);
        outletCloseBtn.setDisable(!enabled);
        // Setpoint buttons always enabled in both modes
    }

    private void setupEquipmentControls() {
        pump1StartBtn.setOnAction(e -> executeCommand("control", "pump_1_running", "Start Pump 1", "OFF", "ON", () -> {
            engine.setTag("pump_1_running", true);
            dataService.sendTogglePump(true);
        }));
        pump1StopBtn.setOnAction(e -> executeCommand("control", "pump_1_running", "Stop Pump 1", "ON", "OFF", () -> {
            engine.setTag("pump_1_running", false);
            dataService.sendTogglePump(false);
        }));
        pump2StartBtn.setOnAction(e -> executeCommand("control", "pump_2_running", "Start Pump 2", "OFF", "ON", () -> {
            engine.setTag("pump_2_running", true);
        }));
        pump2StopBtn.setOnAction(e -> executeCommand("control", "pump_2_running", "Stop Pump 2", "ON", "OFF", () -> {
            engine.setTag("pump_2_running", false);
        }));
        inletOpenBtn.setOnAction(e -> executeCommand("control", "valve_inlet", "Open Inlet Valve", "CLOSED", "OPEN", () -> {
            engine.setTag("valve_inlet", true);
            dataService.sendToggleValve(true);
        }));
        inletCloseBtn.setOnAction(e -> executeCommand("control", "valve_inlet", "Close Inlet Valve", "OPEN", "CLOSED", () -> {
            engine.setTag("valve_inlet", false);
            dataService.sendToggleValve(false);
        }));
        outletOpenBtn.setOnAction(e -> executeCommand("control", "valve_outlet", "Open Outlet Valve", "CLOSED", "OPEN", () -> {
            engine.setTag("valve_outlet", true);
        }));
        outletCloseBtn.setOnAction(e -> executeCommand("control", "valve_outlet", "Close Outlet Valve", "OPEN", "CLOSED", () -> {
            engine.setTag("valve_outlet", false);
        }));
    }

    private void executeCommand(String actionType, String target, String description, String oldVal, String newVal, Runnable action) {
        if (!isManualMode) {
            showAlert("Mode Error", "Switch to Manual mode to execute commands.");
            return;
        }

        // Confirmation for critical commands
        if (description.toLowerCase().contains("emergency") || description.toLowerCase().contains("stop")) {
            if (KoraAlert.confirmWarning("Confirm Action", description + "\n\nAre you sure you want to execute this command?")
                    .orElse(ButtonType.CANCEL) != ButtonType.OK) {
                return;
            }
        }

        action.run();

        // Audit logging
        AuditService.getInstance().logAction(actionType, target, description, oldVal, newVal);

        // Add to command log
        addCommandLogEntry(description, "SENT");
    }

    private void setupSetpoints() {
        // Sync sliders with text fields
        syncSliderAndField(flowSlider, flowValueField, false);
        syncSliderAndField(pressureSlider, pressureValueField, true);
        syncSliderAndField(tempSlider, tempValueField, false);
        syncSliderAndField(levelSlider, levelValueField, false);

        // Setpoint buttons
        flowSetBtn.setOnAction(e -> {
            double val = flowSlider.getValue();
            if (val < 0 || val > 500) { showAlert("Invalid Range", "Flow rate must be 0-500 L/min"); return; }
            executeSetpoint("flow_rate", "Flow Rate", val, "L/min");
        });
        pressureSetBtn.setOnAction(e -> {
            double val = pressureSlider.getValue();
            if (val < 0 || val > 10) { showAlert("Invalid Range", "Pressure must be 0-10 bar"); return; }
            executeSetpoint("pressure", "Pressure", val, "bar");
        });
        tempSetBtn.setOnAction(e -> {
            double val = tempSlider.getValue();
            if (val < 0 || val > 100) { showAlert("Invalid Range", "Temperature must be 0-100 °C"); return; }
            executeSetpoint("temperature", "Temperature", val, "°C");
        });
        levelSetBtn.setOnAction(e -> {
            double val = levelSlider.getValue();
            if (val < 0 || val > 100) { showAlert("Invalid Range", "Tank level must be 0-100%"); return; }
            executeSetpoint("tank_a_level", "Tank A Level", val, "%");
        });
    }

    private void syncSliderAndField(Slider slider, TextField field, boolean isDecimal) {
        slider.valueProperty().addListener((obs, o, n) -> {
            if (isDecimal) {
                field.setText(String.format("%.1f", n.doubleValue()));
            } else {
                field.setText(String.valueOf(n.intValue()));
            }
        });
        field.setOnAction(e -> {
            try {
                double val = Double.parseDouble(field.getText());
                slider.setValue(val);
            } catch (NumberFormatException ex) {
                // ignore
            }
        });
    }

    private void executeSetpoint(String tag, String name, double value, String unit) {
        double oldValue = engine.getDoubleTag(tag);
        double changePercent = Math.abs(value - oldValue) / Math.max(oldValue, 0.001) * 100;

        // Confirm if change > 10%
        if (changePercent > 10) {
            String msg = String.format("Change %s to %.1f %s?\n\nThis is a %.1f%% change from current value (%.1f %s).",
                    name, value, unit, changePercent, oldValue, unit);
            if (KoraAlert.confirmWarning("Confirm Setpoint Change", msg)
                    .orElse(ButtonType.CANCEL) != ButtonType.OK) {
                return;
            }
        }

        engine.setTag(tag, value);
        dataService.sendSetTag(tag, value);

        AuditService.getInstance().logAction("setpoint", tag,
                String.format("Set %s to %.1f %s", name, value, unit),
                String.format("%.1f", oldValue), String.format("%.1f", value));

        addCommandLogEntry(String.format("Set %s → %.1f %s", name, value, unit), "SENT");
    }

    private void setupEmergencyStop() {
        emergencyStopBtn.setOnAction(e -> {
            if (KoraAlert.confirmEmergency("EMERGENCY STOP",
                    "EMERGENCY STOP — All Equipment\n\nThis will immediately stop all pumps and close all valves. Proceed?")
                    .orElse(ButtonType.CANCEL) == ButtonType.OK) {
                engine.setTag("pump_1_running", false);
                engine.setTag("pump_2_running", false);
                engine.setTag("valve_inlet", false);
                engine.setTag("valve_outlet", false);
                dataService.sendEmergencyStop();

                AuditService.getInstance().logAction("control", "all", "EMERGENCY STOP executed", "RUNNING", "STOPPED");
                addCommandLogEntry("EMERGENCY STOP - All equipment stopped", "EXECUTED");
            }
        });
    }

    private void bindFeedback() {
        engine.getBooleanProperty("pump_1_running").addListener((obs, o, n) -> updateFeedback(pump1Feedback, n, "RUNNING", "STOPPED"));
        engine.getBooleanProperty("pump_2_running").addListener((obs, o, n) -> updateFeedback(pump2Feedback, n, "RUNNING", "STOPPED"));
        engine.getBooleanProperty("valve_inlet").addListener((obs, o, n) -> updateFeedback(inletFeedback, n, "OPEN", "CLOSED"));
        engine.getBooleanProperty("valve_outlet").addListener((obs, o, n) -> updateFeedback(outletFeedback, n, "OPEN", "CLOSED"));

        // Initialize
        updateFeedback(pump1Feedback, engine.getBooleanTag("pump_1_running"), "RUNNING", "STOPPED");
        updateFeedback(pump2Feedback, engine.getBooleanTag("pump_2_running"), "RUNNING", "STOPPED");
        updateFeedback(inletFeedback, engine.getBooleanTag("valve_inlet"), "OPEN", "CLOSED");
        updateFeedback(outletFeedback, engine.getBooleanTag("valve_outlet"), "OPEN", "CLOSED");
    }

    private void updateFeedback(Label label, boolean state, String onText, String offText) {
        label.setText(state ? onText : offText);
        label.setStyle("-fx-text-fill: " + (state ? "#00ff9d" : "#ff3333") + "; -fx-font-weight: bold;");
    }

    private void startLiveUpdates() {
        updateTimeline = new Timeline(new KeyFrame(Duration.seconds(2), e -> {
            Platform.runLater(() -> {
                flowCurrentLabel.setText(String.format("Current: %.1f L/min", engine.getDoubleTag("flow_rate")));
                pressureCurrentLabel.setText(String.format("Current: %.1f bar", engine.getDoubleTag("pressure")));
                tempCurrentLabel.setText(String.format("Current: %.1f °C", engine.getDoubleTag("temperature")));
                levelCurrentLabel.setText(String.format("Current: %.1f %%", engine.getDoubleTag("tank_a_level")));
            });
        }));
        updateTimeline.setCycleCount(Animation.INDEFINITE);
        updateTimeline.play();
    }

    private void addCommandLogEntry(String description, String status) {
        commandCount++;
        if (commandCount == 1) {
            commandLogBox.getChildren().clear();
        }

        String time = LocalTime.now().format(TIME_FMT);
        Label entry = new Label(String.format("[%s] %s — %s", time, description, status));
        entry.setStyle("-fx-text-fill: #00ff9d; -fx-font-size: 11px;");
        entry.setWrapText(true);

        commandLogBox.getChildren().addFirst(entry);

        // Keep max 20 entries
        while (commandLogBox.getChildren().size() > 20) {
            commandLogBox.getChildren().removeLast();
        }
    }

    private void showAlert(String title, String message) {
        KoraAlert.warning(title, message);
    }

    public void cleanup() {
        if (updateTimeline != null) {
            updateTimeline.stop();
        }
    }

    public BorderPane getRoot() {
        return rootPane;
    }
}
