package com.kora.desktop.controller;

import com.kora.desktop.device.TagEngine;
import com.kora.desktop.service.AlarmManager;
import com.kora.desktop.service.AuditService;
import com.kora.desktop.service.DataService;
import com.google.gson.JsonObject;
import javafx.animation.*;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.chart.LineChart;
import javafx.scene.chart.NumberAxis;
import javafx.scene.chart.XYChart;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.shape.*;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;
import javafx.stage.Stage;
import javafx.stage.StageStyle;
import javafx.util.Duration;

import java.net.URL;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ResourceBundle;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

public class DashboardController implements Initializable {

    // ── FXML: KPI values ──
    @FXML private BorderPane rootPane;
    @FXML private Label flowRateValue, pressureValue, temperatureValue, tankLevelValue, phValue, alarmsValue;
    @FXML private Label flowRateStatus, pressureStatus, temperatureStatus, tankLevelStatus, phStatus, alarmsDetail;
    @FXML private Label mqttStatusLabel, liveStatusLabel;

    // ── FXML: AI panel ──
    @FXML private Label aiStatusLabel, aiConfidenceValue, aiInsightMessage, aiRecentAnalysis, aiStatusDot;

    // ── FXML: Equipment ──
    @FXML private Label pump1Status, pump2Status, valveStatus, valveOutletStatus, sensorsStatus;
    @FXML private Button togglePumpBtn, toggleValveBtn;

    // ── FXML: Quick stats ──
    @FXML private Label uptimeValue, dataPointsValue, mqttMsgCount;

    // ── FXML: Charts ──
    @FXML private LineChart<Number, Number> flowChart, pressureChart, temperatureChart;
    @FXML private NumberAxis flowXAxis, flowYAxis, pressureXAxis, pressureYAxis, temperatureXAxis, temperatureYAxis;

    // ── FXML: Process diagram ──
    @FXML private StackPane processDiagramPane;

    // ── Services ──
    private DataService dataService;
    private Timeline updateTimeline, chartTimeline, uptimeTimeline;

    // ── Chart series ──
    private XYChart.Series<Number, Number> flowSeries, pressureSeries, temperatureSeries;

    private int timeCounter = 0;
    private static final int MAX_DATA_POINTS = 60;

    // ── Metrics ──
    private long startTime;
    private int mqttMessageCount = 0;
    private int dataPointCount = 0;

    // ── Process diagram live labels ──
    private Label diagTankALevel, diagTankBLevel, diagFlowRate, diagPressure;
    private Label diagPump1State, diagPump2State, diagValveInState, diagValveOutState;
    private Rectangle tankAFill, tankBFill;
    private Rectangle pipe1Flow, pipe2Flow, pipe3Flow;

    // ── Toast ──
    private static final long AI_ALERT_COOLDOWN_MS = 15_000;
    private final AtomicLong lastAIAlertTime = new AtomicLong(0);
    private Stage toastStage;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        startTime = System.currentTimeMillis();
        initializeCharts();
        buildProcessDiagram();
        startDataUpdates();
        startChartUpdates();
        startUptimeTimer();

        dataService = new DataService();
        dataService.setDataCallback(json -> {
            mqttMessageCount++;
            dataPointCount += json.keySet().size();
        });
        dataService.startMqttClient();
        dataService.setAIAlertCallback(this::handleAIAlert);

        // Subscribe to alarm changes
        AlarmManager.getInstance().setOnAlarmsChanged(alarms -> Platform.runLater(this::updateAlarmDisplay));
    }

    // ═══════════════════════════════════════════════════════════════
    //  PROCESS DIAGRAM (built programmatically with live data)
    // ═══════════════════════════════════════════════════════════════

    private void buildProcessDiagram() {
        Pane canvas = new Pane();
        canvas.setPrefSize(900, 380);

        // ── Inlet pipe (left side) ──
        drawPipe(canvas, 30, 190, 100, 190, "#00d4ff");
        drawPipe(canvas, 130, 190, 130, 120, "#00d4ff");
        drawLabel(canvas, 10, 170, "INLET", "#5a7a9a", 10);

        // ── Inlet Valve ──
        drawValve(canvas, 115, 100, "V-IN");
        diagValveInState = drawLabel(canvas, 105, 80, "CLOSED", "#ff4444", 10);
        drawPipe(canvas, 130, 100, 130, 60, "#00d4ff");
        drawPipe(canvas, 130, 60, 200, 60, "#00d4ff");

        // ── Tank A ──
        drawTank(canvas, 200, 40, 80, 160, "TANK A");
        tankAFill = drawTankFill(canvas, 202, 42, 76, 156, 0);
        diagTankALevel = drawLabel(canvas, 215, 105, "0%", "#ffffff", 16);
        drawPipe(canvas, 280, 120, 350, 120, "#00d4ff");

        // ── Flow sensor (between tank A and pump 1) ──
        drawSensor(canvas, 350, 108, "F");
        diagFlowRate = drawLabel(canvas, 340, 135, "0 L/min", "#00ff9d", 10);

        drawPipe(canvas, 370, 120, 440, 120, "#00d4ff");

        // ── Pump 1 ──
        drawPump(canvas, 440, 100, "P1");
        diagPump1State = drawLabel(canvas, 435, 145, "OFF", "#ff4444", 10);
        drawPipe(canvas, 480, 120, 550, 120, "#00d4ff");

        // ── Pressure sensor ──
        drawSensor(canvas, 550, 108, "Pr");
        diagPressure = drawLabel(canvas, 540, 135, "0 bar", "#00d4ff", 10);

        drawPipe(canvas, 570, 120, 640, 120, "#00d4ff");

        // ── Outlet Valve ──
        drawValve(canvas, 625, 100, "V-OUT");
        diagValveOutState = drawLabel(canvas, 615, 80, "CLOSED", "#ff4444", 10);
        drawPipe(canvas, 640, 100, 640, 60, "#00d4ff");

        // ── Outlet pipe (right) ──
        drawPipe(canvas, 640, 60, 750, 60, "#00d4ff");
        drawPipe(canvas, 750, 60, 750, 190, "#00d4ff");
        drawLabel(canvas, 740, 170, "OUTLET", "#5a7a9a", 10);

        // ── Tank B (lower parallel path)            // Updated connection to Tank B on the right side
        drawPipe(canvas, 440, 200, 440, 260, "#00d4ff");
        drawTank(canvas, 520, 260, 80, 110, "TANK B");
        tankBFill = drawTankFill(canvas, 522, 262, 76, 106, 0);
        diagTankBLevel = drawLabel(canvas, 215, 300, "0%", "#ffffff", 14);
        drawPipe(canvas, 280, 315, 350, 315, "#00d4ff");

        // ── Pump 2 ──
        drawPump(canvas, 350, 295, "P2");
        diagPump2State = drawLabel(canvas, 345, 340, "OFF", "#ff4444", 10);
        drawPipe(canvas, 390, 315, 460, 315, "#00d4ff");
        drawPipe(canvas, 460, 315, 460, 200, "#00d4ff");

        // ── Distribution label ──
        drawLabel(canvas, 700, 40, "DISTRIBUTION", "#00ff9d", 11);
        drawPipe(canvas, 750, 190, 830, 190, "#00ff9d");
        drawArrowHead(canvas, 825, 190, "#00ff9d");

        // ── Animated flow indicators ──
        pipe1Flow = drawFlowDot(canvas, 50, 188);
        pipe2Flow = drawFlowDot(canvas, 300, 118);
        pipe3Flow = drawFlowDot(canvas, 700, 58);

        processDiagramPane.getChildren().add(canvas);
    }

    private void drawTank(Pane canvas, int x, int y, int w, int h, String name) {
        Rectangle tank = new Rectangle(x, y, w, h);
        tank.setFill(Color.web("#0d2038"));
        tank.setStroke(Color.web("#1a3a5c"));
        tank.setStrokeWidth(2);
        tank.setArcWidth(6);
        tank.setArcHeight(6);
        canvas.getChildren().add(tank);
        drawLabel(canvas, x + 10, y + 5, name, "#00d4ff", 11);
    }

    private Rectangle drawTankFill(Pane canvas, int x, int y, int w, int h, double percent) {
        double fillH = h * (percent / 100.0);
        Rectangle fill = new Rectangle(x, y + (h - fillH), w, fillH);
        fill.setFill(Color.web("#00d4ff", 0.3));
        fill.setStroke(Color.TRANSPARENT);
        fill.setArcWidth(4);
        fill.setArcHeight(4);
        canvas.getChildren().add(fill);
        return fill;
    }

    private void drawPump(Pane canvas, int x, int y, String name) {
        Circle pump = new Circle(x + 20, y + 20, 18);
        pump.setFill(Color.web("#0d2038"));
        pump.setStroke(Color.web("#1a3a5c"));
        pump.setStrokeWidth(2);
        canvas.getChildren().add(pump);

        // Pump impeller symbol
        Line blade1 = new Line(x + 8, y + 8, x + 32, y + 32);
        blade1.setStroke(Color.web("#00d4ff"));
        blade1.setStrokeWidth(2);
        Line blade2 = new Line(x + 32, y + 8, x + 8, y + 32);
        blade2.setStroke(Color.web("#00d4ff"));
        blade2.setStrokeWidth(2);
        canvas.getChildren().addAll(blade1, blade2);

        drawLabel(canvas, x + 12, y + 42, name, "#b8c5d6", 10);
    }

    private void drawValve(Pane canvas, int x, int y, String name) {
        // Diamond shape for valve
        Polygon diamond = new Polygon();
        diamond.getPoints().addAll(
                (double)(x + 15), (double)(y),
                (double)(x + 30), (double)(y + 15),
                (double)(x + 15), (double)(y + 30),
                (double)(x), (double)(y + 15)
        );
        diamond.setFill(Color.web("#1a2f4a"));
        diamond.setStroke(Color.web("#ffb020"));
        diamond.setStrokeWidth(1.5);
        canvas.getChildren().add(diamond);

        drawLabel(canvas, x + 2, y + 32, name, "#ffb020", 9);
    }

    private void drawSensor(Pane canvas, int x, int y, String symbol) {
        Circle sensor = new Circle(x + 10, y + 12, 10);
        sensor.setFill(Color.web("#1a2f4a"));
        sensor.setStroke(Color.web("#00ff9d"));
        sensor.setStrokeWidth(1.5);
        canvas.getChildren().add(sensor);

        Text txt = new Text(x + 5, y + 17, symbol);
        txt.setFill(Color.web("#00ff9d"));
        txt.setFont(Font.font("Segoe UI", FontWeight.BOLD, 11));
        canvas.getChildren().add(txt);
    }

    private void drawPipe(Pane canvas, int x1, int y1, int x2, int y2, String color) {
        Line pipe = new Line(x1, y1, x2, y2);
        pipe.setStroke(Color.web(color, 0.5));
        pipe.setStrokeWidth(4);
        pipe.setStrokeLineCap(StrokeLineCap.ROUND);
        canvas.getChildren().add(pipe);
    }

    private Label drawLabel(Pane canvas, int x, int y, String text, String color, int size) {
        Label lbl = new Label(text);
        lbl.setLayoutX(x);
        lbl.setLayoutY(y);
        lbl.setTextFill(Color.web(color));
        lbl.setFont(Font.font("Segoe UI", FontWeight.BOLD, size));
        canvas.getChildren().add(lbl);
        return lbl;
    }

    private Rectangle drawFlowDot(Pane canvas, int x, int y) {
        Rectangle dot = new Rectangle(x, y, 6, 6);
        dot.setFill(Color.web("#00ff9d"));
        dot.setArcWidth(3);
        dot.setArcHeight(3);
        dot.setOpacity(0);
        canvas.getChildren().add(dot);
        return dot;
    }

    private void drawArrowHead(Pane canvas, int x, int y, String color) {
        Polygon arrow = new Polygon();
        arrow.getPoints().addAll(
                (double)(x), (double)(y - 6),
                (double)(x + 12), (double)(y),
                (double)(x), (double)(y + 6)
        );
        arrow.setFill(Color.web(color));
        canvas.getChildren().add(arrow);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CHARTS
    // ═══════════════════════════════════════════════════════════════

    private void initializeCharts() {
        if (flowXAxis == null && flowChart != null) {
            flowXAxis = (NumberAxis) flowChart.getXAxis();
            flowYAxis = (NumberAxis) flowChart.getYAxis();
        }
        if (pressureXAxis == null && pressureChart != null) {
            pressureXAxis = (NumberAxis) pressureChart.getXAxis();
            pressureYAxis = (NumberAxis) pressureChart.getYAxis();
        }
        if (temperatureXAxis == null && temperatureChart != null) {
            temperatureXAxis = (NumberAxis) temperatureChart.getXAxis();
            temperatureYAxis = (NumberAxis) temperatureChart.getYAxis();
        }

        flowSeries = new XYChart.Series<>();
        flowSeries.setName("Flow Rate");
        flowChart.getData().add(flowSeries);
        flowChart.setAnimated(false);
        flowXAxis.setLowerBound(0);
        flowXAxis.setUpperBound(MAX_DATA_POINTS);
        flowYAxis.setLowerBound(20);
        flowYAxis.setUpperBound(80);

        pressureSeries = new XYChart.Series<>();
        pressureSeries.setName("Pressure");
        pressureChart.getData().add(pressureSeries);
        pressureChart.setAnimated(false);
        pressureXAxis.setLowerBound(0);
        pressureXAxis.setUpperBound(MAX_DATA_POINTS);
        pressureYAxis.setLowerBound(0);
        pressureYAxis.setUpperBound(8);

        temperatureSeries = new XYChart.Series<>();
        temperatureSeries.setName("Temperature");
        temperatureChart.getData().add(temperatureSeries);
        temperatureChart.setAnimated(false);
        temperatureXAxis.setLowerBound(0);
        temperatureXAxis.setUpperBound(MAX_DATA_POINTS);
        temperatureYAxis.setLowerBound(40);
        temperatureYAxis.setUpperBound(110);
    }

    // ═══════════════════════════════════════════════════════════════
    //  TIMERS
    // ═══════════════════════════════════════════════════════════════

    private void startDataUpdates() {
        updateTimeline = new Timeline(
            new KeyFrame(Duration.seconds(2), event -> updateKPIValues())
        );
        updateTimeline.setCycleCount(Animation.INDEFINITE);
        updateTimeline.play();
    }

    private void startChartUpdates() {
        chartTimeline = new Timeline(
            new KeyFrame(Duration.seconds(1), event -> {
                addChartData();
                updateCharts();
            })
        );
        chartTimeline.setCycleCount(Animation.INDEFINITE);
        chartTimeline.play();
    }

    private void startUptimeTimer() {
        uptimeTimeline = new Timeline(
            new KeyFrame(Duration.seconds(1), event -> {
                long elapsed = (System.currentTimeMillis() - startTime) / 1000;
                long h = elapsed / 3600;
                long m = (elapsed % 3600) / 60;
                long s = elapsed % 60;
                if (uptimeValue != null) {
                    uptimeValue.setText(String.format("%02d:%02d:%02d", h, m, s));
                }
            })
        );
        uptimeTimeline.setCycleCount(Animation.INDEFINITE);
        uptimeTimeline.play();
    }

    // ═══════════════════════════════════════════════════════════════
    //  REAL-TIME DATA UPDATES
    // ═══════════════════════════════════════════════════════════════

    private void updateKPIValues() {
        TagEngine engine = TagEngine.getInstance();

        // Get values from TagEngine with simulation fallback
        final double flowRate = getTagOrSimulate(engine, "flow_rate", 30, 60);
        final double pressure = getTagOrSimulate(engine, "pressure", 1, 5);
        final double temperature = getTagOrSimulate(engine, "temperature", 60, 80);
        final double tankLevel = getTagOrSimulate(engine, "tank_a_level", 50, 100);
        final double tankBLevel = getTagOrSimulate(engine, "tank_b_level", 30, 80);
        final double ph = getTagOrSimulate(engine, "ph_level", 6.8, 7.8);

        final boolean pumpRunning = engine.getBooleanTag("pump_1_running");
        final boolean pump2Running = engine.getBooleanTag("pump_2_running");
        final boolean valveOpen = engine.getBooleanTag("valve_inlet");
        final boolean valveOutOpen = engine.getBooleanTag("valve_outlet");
        final boolean hasData = engine.getDoubleTag("flow_rate") > 0 || engine.getDoubleTag("tank_a_level") > 0;

        // AI status
        boolean aiAnomalyDetected = engine.getBooleanTag("ai_anomaly_detected");
        double aiConfidence = engine.getDoubleTag("ai_anomaly_confidence");
        String aiMessage = engine.getStringTag("ai_anomaly_message");

        Platform.runLater(() -> {
            // ── Update MQTT/Live status ──
            boolean mqttConnected = dataService != null;
            if (mqttStatusLabel != null) {
                mqttStatusLabel.setText(mqttConnected ? "MQTT: CONNECTED" : "MQTT: DISCONNECTED");
                mqttStatusLabel.setTextFill(mqttConnected ? Color.web("#00ff9d") : Color.web("#ff4444"));
            }
            if (liveStatusLabel != null) {
                if (hasData) {
                    liveStatusLabel.setText("LIVE");
                    liveStatusLabel.getStyleClass().setAll("status-online");
                } else {
                    liveStatusLabel.setText("STANDBY");
                    liveStatusLabel.getStyleClass().setAll("status-warning");
                }
            }

            // ── Update KPI values ──
            flowRateValue.setText(String.format("%.1f", flowRate));
            pressureValue.setText(String.format("%.1f", pressure));
            temperatureValue.setText(String.format("%.1f", temperature));
            tankLevelValue.setText(String.format("%.1f", tankLevel));
            phValue.setText(String.format("%.1f", ph));

            // ── Color coding based on thresholds ──
            applyValueColorCoding(temperatureValue, temperature, 75, 95);
            applyValueColorCoding(flowRateValue, flowRate, 25, 55);
            applyValueColorCoding(pressureValue, pressure, 4, 7);
            applyValueColorCoding(tankLevelValue, tankLevel, 85, 95);

            // ── KPI status labels ──
            if (flowRate >= 55) flowRateStatus.setText("HIGH FLOW WARNING");
            else if (flowRate >= 25) flowRateStatus.setText("Normal range");
            else flowRateStatus.setText("LOW FLOW ALERT");
            flowRateStatus.setTextFill(flowRate >= 55 ? Color.web("#ff4444") :
                flowRate >= 25 ? Color.web("#00ff9d") : Color.web("#ff9d00"));

            if (pressure >= 7) pressureStatus.setText("CRITICAL PRESSURE");
            else if (pressure >= 4) pressureStatus.setText("Elevated pressure");
            else pressureStatus.setText("Normal range: 3-5 bar");

            if (temperature >= 95) temperatureStatus.setText("CRITICAL TEMP!");
            else if (temperature >= 75) temperatureStatus.setText("Above optimal");
            else temperatureStatus.setText("Optimal: 60-75\u00b0C");

            tankLevelStatus.setText(String.format("%.0fL / 5000L", tankLevel * 50));

            if (ph >= 7.6) phStatus.setText("Above optimal range");
            else if (ph >= 7.0) phStatus.setText("Optimal: 7.0-7.5");
            else phStatus.setText("Below optimal range");

            // ── Equipment status ──
            updateEquipLabel(pump1Status, pumpRunning ? "RUNNING" : "STOPPED", pumpRunning);
            updateEquipLabel(pump2Status, pump2Running ? "RUNNING" : "STOPPED", pump2Running);
            updateEquipLabel(valveStatus, valveOpen ? "OPEN" : "CLOSED", valveOpen);
            updateEquipLabel(valveOutletStatus, valveOutOpen ? "OPEN" : "CLOSED", valveOutOpen);
            updateEquipLabel(sensorsStatus, hasData ? "ONLINE" : "NO DATA", hasData);

            // ── Update process diagram ──
            updateProcessDiagram(tankLevel, tankBLevel, flowRate, pressure, pumpRunning, pump2Running, valveOpen, valveOutOpen);

            // ── Quick stats ──
            if (dataPointsValue != null) dataPointsValue.setText(String.valueOf(dataPointCount));
            if (mqttMsgCount != null) mqttMsgCount.setText(String.valueOf(mqttMessageCount));

            // ── AI panel ──
            if (aiConfidenceValue != null) {
                aiConfidenceValue.setText(String.format("%.1f%%", aiConfidence * 100));
            }
            if (aiStatusLabel != null) {
                if (aiAnomalyDetected) {
                    aiStatusLabel.setText("ANOMALY DETECTED");
                    aiStatusLabel.setTextFill(Color.web("#ff4444"));
                    if (aiStatusDot != null) aiStatusDot.setStyle("-fx-background-color: #ff4444; -fx-background-radius: 4;");
                } else {
                    aiStatusLabel.setText("NORMAL");
                    aiStatusLabel.setTextFill(Color.web("#00ff9d"));
                    if (aiStatusDot != null) aiStatusDot.setStyle("-fx-background-color: #00ff9d; -fx-background-radius: 4;");
                }
            }
            if (aiInsightMessage != null) {
                if (aiAnomalyDetected && aiMessage != null && !aiMessage.isEmpty()) {
                    aiInsightMessage.setText(aiMessage);
                    aiInsightMessage.setTextFill(Color.web("#ff9d00"));
                } else {
                    aiInsightMessage.setText("All sensor readings within normal parameters.");
                    aiInsightMessage.setTextFill(Color.web("#b8c5d6"));
                }
            }
            if (aiRecentAnalysis != null) {
                if (hasData) {
                    aiRecentAnalysis.setText(String.format("Flow: %.1f L/min | Pressure: %.1f bar | Tank: %.0f%%",
                            flowRate, pressure, tankLevel));
                }
            }
        });

        // ── Alarm display ──
        updateAlarmDisplay();
    }

    private void updateProcessDiagram(double tankA, double tankB, double flow, double pressure,
                                       boolean pump1, boolean pump2, boolean valveIn, boolean valveOut) {
        // Update tank fill levels
        if (tankAFill != null) {
            double maxH = 156;
            double fillH = maxH * (tankA / 100.0);
            tankAFill.setY(42 + (maxH - fillH));
            tankAFill.setHeight(fillH);
            tankAFill.setFill(tankA >= 90 ? Color.web("#ff4444", 0.4) : Color.web("#00d4ff", 0.3));
        }
        if (tankBFill != null) {
            double maxH = 106;
            double fillH = maxH * (tankB / 100.0);
            tankBFill.setY(262 + (maxH - fillH));
            tankBFill.setHeight(fillH);
        }

        // Update live labels
        if (diagTankALevel != null) diagTankALevel.setText(String.format("%.0f%%", tankA));
        if (diagTankBLevel != null) diagTankBLevel.setText(String.format("%.0f%%", tankB));
        if (diagFlowRate != null) diagFlowRate.setText(String.format("%.0f L/min", flow));
        if (diagPressure != null) diagPressure.setText(String.format("%.1f bar", pressure));

        // Update equipment states on diagram
        updateDiagLabel(diagPump1State, pump1 ? "RUN" : "OFF", pump1);
        updateDiagLabel(diagPump2State, pump2 ? "RUN" : "OFF", pump2);
        updateDiagLabel(diagValveInState, valveIn ? "OPEN" : "CLOSED", valveIn);
        updateDiagLabel(diagValveOutState, valveOut ? "OPEN" : "CLOSED", valveOut);

        // Flow dot animations
        updateFlowDot(pipe1Flow, valveIn, 30, 188, 120, 0);
        updateFlowDot(pipe2Flow, pump1, 300, 118, 230, 0);
        updateFlowDot(pipe3Flow, valveOut, 660, 58, 80, 0);
    }

    private void updateDiagLabel(Label label, String text, boolean active) {
        if (label == null) return;
        label.setText(text);
        label.setTextFill(active ? Color.web("#00ff9d") : Color.web("#ff4444"));
    }

    private void updateFlowDot(Rectangle dot, boolean shouldFlow, int startX, int y, int travelX, int travelY) {
        if (dot == null) return;
        if (shouldFlow) {
            dot.setOpacity(0.9);
            // Simple pulsing animation to indicate flow
            dot.setFill(Color.web("#00ff9d"));
        } else {
            dot.setOpacity(0.2);
            dot.setFill(Color.web("#5a7a9a"));
        }
    }

    private void updateAlarmDisplay() {
        AlarmManager alarmMgr = AlarmManager.getInstance();
        int activeCount = alarmMgr.getActiveCount();
        long criticalCount = alarmMgr.getAllAlarms().stream()
                .filter(a -> a.state == AlarmManager.State.ACTIVE && a.severity == AlarmManager.Severity.CRITICAL)
                .count();
        long warningCount = activeCount - criticalCount;

        Platform.runLater(() -> {
            if (alarmsValue != null) {
                alarmsValue.setText(String.valueOf(activeCount));
                if (activeCount == 0) {
                    alarmsValue.getStyleClass().setAll("kpi-value", "good");
                } else if (criticalCount > 0) {
                    alarmsValue.getStyleClass().setAll("kpi-value", "critical");
                } else {
                    alarmsValue.getStyleClass().setAll("kpi-value", "warning");
                }
            }
            if (alarmsDetail != null) {
                if (activeCount == 0) {
                    alarmsDetail.setText("No active alarms");
                    alarmsDetail.setTextFill(Color.web("#00ff9d"));
                } else {
                    alarmsDetail.setText(String.format("%d Critical, %d Warning", criticalCount, warningCount));
                    alarmsDetail.setTextFill(criticalCount > 0 ? Color.web("#ff4444") : Color.web("#ff9d00"));
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  AI ALERTS (non-blocking toast)
    // ═══════════════════════════════════════════════════════════════

    private void handleAIAlert(JsonObject aiData) {
        Platform.runLater(() -> {
            boolean isAnomaly = aiData.has("is_anomaly") && aiData.get("is_anomaly").getAsBoolean();
            String message = aiData.has("message") ? aiData.get("message").getAsString() : "AI Alert";

            // Update AI panel
            if (aiRecentAnalysis != null && isAnomaly) {
                aiRecentAnalysis.setText("Anomaly: " + message);
                aiRecentAnalysis.setTextFill(Color.web("#ff9d00"));
            }

            if (isAnomaly) {
                long now = System.currentTimeMillis();
                if ((now - lastAIAlertTime.get()) >= AI_ALERT_COOLDOWN_MS) {
                    lastAIAlertTime.set(now);
                    showToast("AI Anomaly Detected", message);
                }
                System.out.println("AI Anomaly: " + message);
            }
        });
    }

    private void showToast(String title, String message) {
        if (toastStage != null && toastStage.isShowing()) toastStage.close();

        toastStage = new Stage();
        toastStage.initStyle(StageStyle.TRANSPARENT);
        toastStage.setAlwaysOnTop(true);
        toastStage.setResizable(false);

        HBox toast = new HBox(10);
        toast.setAlignment(Pos.CENTER_LEFT);
        toast.setPadding(new Insets(12, 18, 12, 18));
        toast.setStyle(
                "-fx-background-color: #1a1a2e;"
                + "-fx-background-radius: 10;"
                + "-fx-border-color: #ffb020;"
                + "-fx-border-radius: 10;"
                + "-fx-border-width: 1.5;"
                + "-fx-effect: dropshadow(three-pass-box, rgba(255,176,32,0.4), 14, 0, 0, 4);");

        Label icon = new Label("\u26A0");
        icon.setFont(Font.font("Segoe UI Emoji", FontWeight.BOLD, 20));
        icon.setTextFill(Color.web("#ffb020"));

        VBox textBox = new VBox(3);
        Label titleLabel = new Label(title);
        titleLabel.setFont(Font.font("Segoe UI", FontWeight.BOLD, 13));
        titleLabel.setTextFill(Color.web("#ffb020"));

        Label msgLabel = new Label(message);
        msgLabel.setFont(Font.font("Segoe UI", 11));
        msgLabel.setTextFill(Color.web("#c8d0dc"));
        msgLabel.setWrapText(true);
        msgLabel.setMaxWidth(400);

        textBox.getChildren().addAll(titleLabel, msgLabel);
        toast.getChildren().addAll(icon, textBox);

        Scene scene = new Scene(toast, Color.TRANSPARENT);
        toastStage.setScene(scene);
        toastStage.sizeToScene();

        Stage mainWindow = (Stage) rootPane.getScene().getWindow();
        double windowX = mainWindow.getX();
        double windowY = mainWindow.getY();
        double windowWidth = mainWindow.getWidth();

        toastStage.show();
        double toastWidth = toastStage.getWidth();
        toastStage.setX(windowX + (windowWidth - toastWidth) / 2);
        toastStage.setY(windowY + 60);

        toast.setOpacity(0);
        toast.setTranslateY(-15);
        TranslateTransition slideIn = new TranslateTransition(Duration.millis(300), toast);
        slideIn.setFromY(-15);
        slideIn.setToY(0);
        FadeTransition fadeIn = new FadeTransition(Duration.millis(300), toast);
        fadeIn.setFromValue(0);
        fadeIn.setToValue(1);
        new ParallelTransition(slideIn, fadeIn).play();

        mainWindow.xProperty().addListener((obs, o, n) -> {
            if (toastStage.isShowing())
                toastStage.setX(n.doubleValue() + (windowWidth - toastStage.getWidth()) / 2);
        });
        mainWindow.yProperty().addListener((obs, o, n) -> {
            if (toastStage.isShowing()) toastStage.setY(n.doubleValue() + 60);
        });

        Timeline dismissTimer = new Timeline(new KeyFrame(Duration.seconds(5), e -> {
            FadeTransition fadeOut = new FadeTransition(Duration.millis(400), toast);
            fadeOut.setFromValue(1);
            fadeOut.setToValue(0);
            fadeOut.setOnFinished(ev -> toastStage.close());
            fadeOut.play();
        }));
        dismissTimer.setCycleCount(1);
        dismissTimer.play();
    }

    // ═══════════════════════════════════════════════════════════════
    //  CHART DATA
    // ═══════════════════════════════════════════════════════════════

    private void addChartData() {
        TagEngine engine = TagEngine.getInstance();

        double flowValue = getTagOrSimulate(engine, "flow_rate", 30, 60);
        double pressureValue = getTagOrSimulate(engine, "pressure", 1, 5);
        double temperatureValue = getTagOrSimulate(engine, "temperature", 60, 80);

        timeCounter++;

        flowSeries.getData().add(new XYChart.Data<>(timeCounter, flowValue));
        pressureSeries.getData().add(new XYChart.Data<>(timeCounter, pressureValue));
        temperatureSeries.getData().add(new XYChart.Data<>(timeCounter, temperatureValue));

        if (flowSeries.getData().size() > MAX_DATA_POINTS) {
            flowSeries.getData().remove(0);
            pressureSeries.getData().remove(0);
            temperatureSeries.getData().remove(0);

            flowXAxis.setLowerBound(timeCounter - MAX_DATA_POINTS + 1);
            flowXAxis.setUpperBound(timeCounter);
            pressureXAxis.setLowerBound(timeCounter - MAX_DATA_POINTS + 1);
            pressureXAxis.setUpperBound(timeCounter);
            temperatureXAxis.setLowerBound(timeCounter - MAX_DATA_POINTS + 1);
            temperatureXAxis.setUpperBound(timeCounter);
        }
    }

    private void updateCharts() {
        Platform.runLater(() -> {
            flowChart.requestLayout();
            pressureChart.requestLayout();
            temperatureChart.requestLayout();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════

    private double getTagOrSimulate(TagEngine engine, String tag, double min, double max) {
        // Return real sensor data only; if unavailable, return 0 (no simulation)
        return engine.getDoubleTag(tag);
    }

    private void applyValueColorCoding(Label label, double value, double warningThreshold, double criticalThreshold) {
        String styleClass = "value-text";
        if (value >= criticalThreshold) styleClass += " critical";
        else if (value >= warningThreshold) styleClass += " warning";
        else styleClass += " good";
        label.getStyleClass().clear();
        label.getStyleClass().add(styleClass);
    }

    private void updateEquipLabel(Label label, String text, boolean active) {
        if (label == null) return;
        label.setText(text);
        label.getStyleClass().setAll(active ? "status-online" : "status-offline");
    }

    private double simulateValue(double min, double max) {
        return ThreadLocalRandom.current().nextDouble(min, max);
    }

    public void cleanup() {
        if (updateTimeline != null) updateTimeline.stop();
        if (chartTimeline != null) chartTimeline.stop();
        if (uptimeTimeline != null) uptimeTimeline.stop();
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONTROL ACTIONS
    // ═══════════════════════════════════════════════════════════════

    @FXML
    public void handleTogglePump(javafx.event.ActionEvent event) {
        TagEngine engine = TagEngine.getInstance();
        boolean currentState = engine.getBooleanTag("pump_1_running");
        boolean newState = !currentState;
        dataService.sendTogglePump(newState);
        AuditService.getInstance().logAction("control", "pump_1",
            "Toggle pump " + (newState ? "START" : "STOP"),
            currentState ? "ON" : "OFF", newState ? "ON" : "OFF");
    }

    @FXML
    public void handleToggleValve(javafx.event.ActionEvent event) {
        TagEngine engine = TagEngine.getInstance();
        boolean currentState = engine.getBooleanTag("valve_inlet");
        boolean newState = !currentState;
        dataService.sendToggleValve(newState);
        AuditService.getInstance().logAction("control", "valve_inlet",
            "Toggle valve " + (newState ? "OPEN" : "CLOSE"),
            currentState ? "OPEN" : "CLOSED", newState ? "OPEN" : "CLOSED");
    }

    public BorderPane getRoot() {
        return rootPane;
    }
}
