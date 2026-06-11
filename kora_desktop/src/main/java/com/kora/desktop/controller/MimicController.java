package com.kora.desktop.controller;

import com.kora.desktop.device.TagEngine;
import com.kora.desktop.model.*;
import com.kora.desktop.service.AlarmManager;
import com.kora.desktop.service.KoraAlert;

import javafx.animation.Animation;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.shape.Line;
import javafx.scene.shape.StrokeLineCap;
import javafx.util.Duration;

import java.net.URL;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ResourceBundle;

public class MimicController implements Initializable {

    @FXML private BorderPane rootPane;
    @FXML private ScrollPane scrollPane;
    @FXML private ToggleButton flowModeToggle;
    @FXML private ToggleButton electricalModeToggle;
    @FXML private Button resetZoomBtn;
    @FXML private Label waterBalanceLabel;
    @FXML private Label lastUpdateLabel;

    // Equipment components
    private TankUI tankA;
    private TankUI tankB;
    private PumpUI pump1;
    private PumpUI pump2;
    private ValveUI inletValve;
    private ValveUI outletValve;
    private GaugeUI pressureGauge;
    private GaugeUI tempGauge;
    private GaugeUI flowGauge;

    // Flow pipes
    private PipeUI pipeInletToTankA;
    private PipeUI pipeTankAToPump1;
    private PipeUI pipePump1ToTankB;
    private PipeUI pipeTankBToOutlet;
    private PipeUI pipeTankAToPump2;
    private PipeUI pipePump2Merge;

    // Status labels for equipment detail
    private Label tankAValueLabel;
    private Label tankBValueLabel;
    private Label pump1StatusLabel;
    private Label pump2StatusLabel;
    private Label inletStatusLabel;
    private Label outletStatusLabel;

    private Timeline updateTimeline;
    private final TagEngine engine = TagEngine.getInstance();

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupModeToggles();
        resetZoomBtn.setOnAction(e -> buildMimicLayout());
        buildMimicLayout();
        startUpdates();
    }

    private void setupModeToggles() {
        ToggleGroup group = new ToggleGroup();
        flowModeToggle.setToggleGroup(group);
        electricalModeToggle.setToggleGroup(group);
        flowModeToggle.setSelected(true);
    }

    private void buildMimicLayout() {
        // Main canvas
        Pane canvas = new Pane();
        canvas.setPrefSize(1100, 600);
        canvas.setStyle("-fx-background-color: #0a1525; -fx-background-radius: 8;");

        // === Create Equipment ===
        inletValve = new ValveUI("Inlet Valve", "valve_inlet");
        tankA = new TankUI("Tank A", "tank_a_level");
        pump1 = new PumpUI("Pump 1", "pump_1_running");
        pump2 = new PumpUI("Pump 2", "pump_2_running");
        tankB = new TankUI("Tank B", "tank_b_level");
        outletValve = new ValveUI("Outlet Valve", "valve_outlet");

        // Gauges
        pressureGauge = new GaugeUI("Pressure", 0, 10, "bar");
        tempGauge = new GaugeUI("Temp", 0, 100, "°C");
        flowGauge = new GaugeUI("Flow", 0, 500, "L/min");

        pressureGauge.setPrefSize(120, 120);
        tempGauge.setPrefSize(120, 120);
        flowGauge.setPrefSize(120, 120);

        // === Position Equipment ===
        layoutComponent(inletValve, 30, 220);
        layoutComponent(tankA, 180, 160);
        layoutComponent(pump1, 390, 140);
        layoutComponent(pump2, 390, 340);
        layoutComponent(tankB, 600, 160);
        layoutComponent(outletValve, 800, 220);

        // Gauges positioned at top
        canvas.getChildren().addAll(pressureGauge, tempGauge, flowGauge);
        pressureGauge.setLayoutX(30);
        pressureGauge.setLayoutY(10);
        tempGauge.setLayoutX(160);
        tempGauge.setLayoutY(10);
        flowGauge.setLayoutX(290);
        flowGauge.setLayoutY(10);

        // === Create Pipes ===
        pipeInletToTankA = new PipeUI(100, true);
        pipeTankAToPump1 = new PipeUI(120, true);
        pipePump1ToTankB = new PipeUI(120, true);
        pipeTankBToOutlet = new PipeUI(120, true);
        pipeTankAToPump2 = new PipeUI(100, false); // vertical down from Tank A
        pipePump2Merge = new PipeUI(120, true);

        canvas.getChildren().addAll(
                pipeInletToTankA, pipeTankAToPump1, pipePump1ToTankB,
                pipeTankBToOutlet, pipeTankAToPump2, pipePump2Merge
        );

        // Position pipes to connect equipment
        pipeInletToTankA.setLayoutX(100);
        pipeInletToTankA.setLayoutY(246);

        pipeTankAToPump1.setLayoutX(290);
        pipeTankAToPump1.setLayoutY(246);

        pipePump1ToTankB.setLayoutX(490);
        pipePump1ToTankB.setLayoutY(200);

        pipeTankBToOutlet.setLayoutX(710);
        pipeTankBToOutlet.setLayoutY(246);

        pipeTankAToPump2.setLayoutX(240);
        pipeTankAToPump2.setLayoutY(290);

        pipePump2Merge.setLayoutX(490);
        pipePump2Merge.setLayoutY(395);

        // === Add all equipment to canvas ===
        canvas.getChildren().addAll(inletValve, tankA, pump1, pump2, tankB, outletValve);

        // === Equipment Detail Labels (below canvas) ===
        GridPane detailGrid = buildDetailPanel();

        // === Section Title ===
        Label processTitle = new Label("WATER TREATMENT PROCESS DIAGRAM");
        processTitle.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 14px; -fx-font-weight: bold; -fx-letter-spacing: 2px;");

        // === Flow Legend ===
        HBox legend = buildLegend();

        // === Assemble Layout ===
        VBox mainLayout = new VBox(15);
        mainLayout.setPadding(new Insets(15));
        mainLayout.setStyle("-fx-background-color: transparent;");

        VBox processCard = new VBox(10);
        processCard.setPadding(new Insets(15));
        processCard.getStyleClass().add("card");
        processCard.getChildren().addAll(processTitle, canvas, legend);

        mainLayout.getChildren().addAll(processCard, detailGrid);

        scrollPane.setContent(mainLayout);

        // Bind to TagEngine
        bindEquipment();

        // Add click handlers for detail popups
        addClickHandlers();
    }

    private void layoutComponent(Region component, double x, double y) {
        component.setLayoutX(x);
        component.setLayoutY(y);
    }

    private GridPane buildDetailPanel() {
        GridPane grid = new GridPane();
        grid.setHgap(15);
        grid.setVgap(10);
        grid.setPadding(new Insets(15));
        grid.getStyleClass().add("card");

        // Header
        Label header = new Label("EQUIPMENT STATUS");
        header.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 14px; -fx-font-weight: bold;");
        grid.add(header, 0, 0, 6, 1);

        // Tank A
        tankAValueLabel = new Label("-- %");
        tankAValueLabel.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Tank A", tankAValueLabel), 0, 1);

        // Tank B
        tankBValueLabel = new Label("-- %");
        tankBValueLabel.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Tank B", tankBValueLabel), 1, 1);

        // Pump 1
        pump1StatusLabel = new Label("STOPPED");
        pump1StatusLabel.setStyle("-fx-text-fill: #ff3333; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Pump 1", pump1StatusLabel), 2, 1);

        // Pump 2
        pump2StatusLabel = new Label("STOPPED");
        pump2StatusLabel.setStyle("-fx-text-fill: #ff3333; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Pump 2", pump2StatusLabel), 3, 1);

        // Inlet Valve
        inletStatusLabel = new Label("CLOSED");
        inletStatusLabel.setStyle("-fx-text-fill: #ff3333; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Inlet Valve", inletStatusLabel), 4, 1);

        // Outlet Valve
        outletStatusLabel = new Label("CLOSED");
        outletStatusLabel.setStyle("-fx-text-fill: #ff3333; -fx-font-size: 13px; -fx-font-weight: bold;");
        grid.add(equipRow("Outlet Valve", outletStatusLabel), 5, 1);

        for (int i = 0; i < 6; i++) {
            ColumnConstraints cc = new ColumnConstraints();
            cc.setHgrow(Priority.ALWAYS);
            cc.setPercentWidth(100.0 / 6);
            grid.getColumnConstraints().add(cc);
        }

        return grid;
    }

    private VBox equipRow(String name, Label valueLabel) {
        Label nameLabel = new Label(name);
        nameLabel.setStyle("-fx-text-fill: #5a7a9a; -fx-font-size: 11px; -fx-font-weight: 600;");
        VBox box = new VBox(4, nameLabel, valueLabel);
        box.setPadding(new Insets(5));
        box.setStyle("-fx-background-color: #0d2038; -fx-background-radius: 6; -fx-border-color: #1a3a5c; -fx-border-radius: 6;");
        return box;
    }

    private HBox buildLegend() {
        HBox legend = new HBox(20);
        legend.setAlignment(Pos.CENTER_LEFT);
        legend.setPadding(new Insets(5, 0, 0, 0));

        legend.getChildren().addAll(
            legendItem("#00ff9d", "Normal / Running"),
            legendItem("#ff3333", "Alarm / Stopped"),
            legendItem("#00aaff", "Flow Active"),
            legendItem("#333333", "No Flow / Offline")
        );
        return legend;
    }

    private HBox legendItem(String color, String text) {
        Region dot = new Region();
        dot.setPrefSize(12, 12);
        dot.setStyle("-fx-background-color: " + color + "; -fx-background-radius: 6;");
        Label label = new Label(text);
        label.setStyle("-fx-text-fill: #b8c5d6; -fx-font-size: 11px;");
        HBox box = new HBox(6, dot, label);
        box.setAlignment(Pos.CENTER_LEFT);
        return box;
    }

    private void bindEquipment() {
        tankA.bind(engine);
        tankB.bind(engine);
        pump1.bind(engine);
        pump2.bind(engine);
        inletValve.bind(engine);
        outletValve.bind(engine);

        // Bind gauges
        engine.getDoubleProperty("pressure").addListener((obs, o, n) -> pressureGauge.setLevel(n.doubleValue()));
        engine.getDoubleProperty("temperature").addListener((obs, o, n) -> tempGauge.setLevel(n.doubleValue()));
        engine.getDoubleProperty("flow_rate").addListener((obs, o, n) -> flowGauge.setLevel(n.doubleValue()));
        pressureGauge.setLevel(engine.getDoubleTag("pressure"));
        tempGauge.setLevel(engine.getDoubleTag("temperature"));
        flowGauge.setLevel(engine.getDoubleTag("flow_rate"));

        // Bind detail labels
        engine.getDoubleProperty("tank_a_level").addListener((obs, o, n) -> {
            tankAValueLabel.setText(String.format("%.1f %%", n.doubleValue()));
        });
        engine.getDoubleProperty("tank_b_level").addListener((obs, o, n) -> {
            tankBValueLabel.setText(String.format("%.1f %%", n.doubleValue()));
        });
        engine.getBooleanProperty("pump_1_running").addListener((obs, o, n) -> {
            pump1StatusLabel.setText(n ? "RUNNING" : "STOPPED");
            pump1StatusLabel.setStyle("-fx-text-fill: " + (n ? "#00ff9d" : "#ff3333") + "; -fx-font-size: 13px; -fx-font-weight: bold;");
        });
        engine.getBooleanProperty("pump_2_running").addListener((obs, o, n) -> {
            pump2StatusLabel.setText(n ? "RUNNING" : "STOPPED");
            pump2StatusLabel.setStyle("-fx-text-fill: " + (n ? "#00ff9d" : "#ff3333") + "; -fx-font-size: 13px; -fx-font-weight: bold;");
        });
        engine.getBooleanProperty("valve_inlet").addListener((obs, o, n) -> {
            inletStatusLabel.setText(n ? "OPEN" : "CLOSED");
            inletStatusLabel.setStyle("-fx-text-fill: " + (n ? "#00ff9d" : "#ff3333") + "; -fx-font-size: 13px; -fx-font-weight: bold;");
        });
        engine.getBooleanProperty("valve_outlet").addListener((obs, o, n) -> {
            outletStatusLabel.setText(n ? "OPEN" : "CLOSED");
            outletStatusLabel.setStyle("-fx-text-fill: " + (n ? "#00ff9d" : "#ff3333") + "; -fx-font-size: 13px; -fx-font-weight: bold;");
        });

        // Initialize label values
        tankAValueLabel.setText(String.format("%.1f %%", engine.getDoubleTag("tank_a_level")));
        tankBValueLabel.setText(String.format("%.1f %%", engine.getDoubleTag("tank_b_level")));
        updateStatusLabel(pump1StatusLabel, engine.getBooleanTag("pump_1_running"), "RUNNING", "STOPPED");
        updateStatusLabel(pump2StatusLabel, engine.getBooleanTag("pump_2_running"), "RUNNING", "STOPPED");
        updateStatusLabel(inletStatusLabel, engine.getBooleanTag("valve_inlet"), "OPEN", "CLOSED");
        updateStatusLabel(outletStatusLabel, engine.getBooleanTag("valve_outlet"), "OPEN", "CLOSED");
    }

    private void updateStatusLabel(Label label, boolean state, String onText, String offText) {
        label.setText(state ? onText : offText);
        label.setStyle("-fx-text-fill: " + (state ? "#00ff9d" : "#ff3333") + "; -fx-font-size: 13px; -fx-font-weight: bold;");
    }

    private void addClickHandlers() {
        tankA.setOnMouseClicked(e -> showEquipmentDetail("Tank A", "tank_a_level", "%"));
        tankB.setOnMouseClicked(e -> showEquipmentDetail("Tank B", "tank_b_level", "%"));
        pump1.setOnMouseClicked(e -> showEquipmentDetailBool("Pump 1", "pump_1_running"));
        pump2.setOnMouseClicked(e -> showEquipmentDetailBool("Pump 2", "pump_2_running"));
        inletValve.setOnMouseClicked(e -> showEquipmentDetailBool("Inlet Valve", "valve_inlet"));
        outletValve.setOnMouseClicked(e -> showEquipmentDetailBool("Outlet Valve", "valve_outlet"));
    }

    private void showEquipmentDetail(String name, String tag, String unit) {
        double value = engine.getDoubleTag(tag);
        KoraAlert.info(name + " Details",
                String.format("Current Value: %.1f %s\nTag: %s", value, unit, tag));
    }

    private void showEquipmentDetailBool(String name, String tag) {
        boolean value = engine.getBooleanTag(tag);
        KoraAlert.info(name + " Details",
                String.format("Status: %s\nTag: %s", value ? "ON / OPEN" : "OFF / CLOSED", tag));
    }

    private void startUpdates() {
        updateTimeline = new Timeline(new KeyFrame(Duration.seconds(2), event -> {
            Platform.runLater(() -> {
                updateFlowAnimations();
                updateWaterBalance();
                lastUpdateLabel.setText("Last update: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")));
            });
        }));
        updateTimeline.setCycleCount(Animation.INDEFINITE);
        updateTimeline.play();
    }

    private void updateFlowAnimations() {
        boolean inletOpen = engine.getBooleanTag("valve_inlet");
        boolean pump1On = engine.getBooleanTag("pump_1_running");
        boolean pump2On = engine.getBooleanTag("pump_2_running");
        boolean outletOpen = engine.getBooleanTag("valve_outlet");

        pipeInletToTankA.setFlowing(inletOpen);
        pipeTankAToPump1.setFlowing(pump1On);
        pipePump1ToTankB.setFlowing(pump1On);
        pipeTankBToOutlet.setFlowing(outletOpen);
        pipeTankAToPump2.setFlowing(pump2On);
        pipePump2Merge.setFlowing(pump2On);
    }

    private void updateWaterBalance() {
        double flowRate = engine.getDoubleTag("flow_rate");
        boolean inletOpen = engine.getBooleanTag("valve_inlet");
        boolean outletOpen = engine.getBooleanTag("valve_outlet");
        double inFlow = inletOpen ? flowRate : 0;
        double outFlow = outletOpen ? flowRate * 0.85 : 0; // Simulated outflow
        double delta = inFlow - outFlow;
        waterBalanceLabel.setText(String.format("In: %.1f L/min | Out: %.1f L/min | Δ: %.1f", inFlow, outFlow, delta));
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
