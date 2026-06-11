package com.kora.desktop.controller;

import javafx.animation.Animation;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.collections.ObservableList;
import javafx.collections.FXCollections;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.chart.*;
import javafx.scene.control.*;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

import java.net.URL;
import java.util.ResourceBundle;
import java.util.concurrent.ThreadLocalRandom;

import com.kora.desktop.device.TagEngine;

public class TrendsController implements Initializable {

    @FXML
    private BorderPane rootPane;

    @FXML
    private ComboBox<String> timeRangeCombo;

    @FXML
    private ToggleButton flowToggle;

    @FXML
    private ToggleButton pressureToggle;

    @FXML
    private ToggleButton temperatureToggle;

    @FXML
    private ToggleButton levelToggle;

    @FXML
    private ToggleButton phToggle;

    @FXML
    private ToggleButton energyToggle;

    @FXML
    private CheckBox showSetpointsCheck;

    @FXML
    private CheckBox liveUpdateCheck;

    @FXML
    private Button exportButton;

    @FXML
    private Label setpointDeviationLabel;

    @FXML
    private Label mainChartTitle;

    @FXML
    private Label currentValueLabel;

    @FXML
    private Label averageValueLabel;

    @FXML
    private Label peakValueLabel;

    @FXML
    private LineChart<Number, Number> mainTrendChart;

    @FXML
    private NumberAxis mainXAxis;

    @FXML
    private NumberAxis mainYAxis;

    @FXML
    private BarChart<String, Number> comparisonChart;

    @FXML
    private PieChart distributionChart;

    @FXML
    private LineChart<Number, Number> historicalChart;

    @FXML
    private CheckBox showTodayCheck;

    @FXML
    private CheckBox showYesterdayCheck;

    @FXML
    private CheckBox showWeekCheck;

    private Timeline updateTimeline;
    private Timeline historicalUpdateTimeline;

    // Chart data series
    private XYChart.Series<Number, Number> mainSeries;
    private XYChart.Series<Number, Number> todaySeries;
    private XYChart.Series<Number, Number> yesterdaySeries;
    private XYChart.Series<Number, Number> weekSeries;

    // Time tracking
    private int timeCounter = 0;
    private static final int MAX_DATA_POINTS = 60;
    private static final int HISTORICAL_DATA_POINTS = 24; // 24 hours

    // Setpoint data
    private double setpointTarget = Double.NaN;
    private double setpointHighAlarm = Double.NaN;
    private double setpointLowAlarm = Double.NaN;
    private boolean showSetpoints = false;

    // Setpoint overlay series
    private XYChart.Series<Number, Number> targetLine;
    private XYChart.Series<Number, Number> highAlarmLine;
    private XYChart.Series<Number, Number> lowAlarmLine;

    // Current selected parameter
    private String selectedParameter = "flow_rate";

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupComboBox();
        setupToggles();
        setupButtons();
        initializeCharts();
        startDataUpdates();
    }

    private void setupComboBox() {
        timeRangeCombo.setItems(FXCollections.observableArrayList(
            "Last Hour", "Last 6 Hours", "Last 24 Hours", "Last Week", "Custom"
        ));
        timeRangeCombo.getSelectionModel().select("Last Hour");
        timeRangeCombo.setOnAction(e -> handleTimeRangeChange());
    }

    private void setupToggles() {
        // Set up toggle group
        ToggleGroup toggleGroup = new ToggleGroup();
        flowToggle.setToggleGroup(toggleGroup);
        pressureToggle.setToggleGroup(toggleGroup);
        temperatureToggle.setToggleGroup(toggleGroup);
        levelToggle.setToggleGroup(toggleGroup);
        phToggle.setToggleGroup(toggleGroup);
        energyToggle.setToggleGroup(toggleGroup);

        // Select flow rate by default
        flowToggle.setSelected(true);

        // Add listeners
        flowToggle.setOnAction(e -> switchParameter("flow_rate", "Flow Rate", "L/min"));
        pressureToggle.setOnAction(e -> switchParameter("pressure", "Pressure", "bar"));
        temperatureToggle.setOnAction(e -> switchParameter("temperature", "Temperature", "°C"));
        levelToggle.setOnAction(e -> switchParameter("tank_a_level", "Tank Level", "%"));
        phToggle.setOnAction(e -> switchParameter("ph_level", "pH Level", ""));
        energyToggle.setOnAction(e -> switchParameter("energy", "Energy", "kW/h"));
    }

    private void setupButtons() {
        liveUpdateCheck.selectedProperty().addListener((obs, old, newVal) -> {
            if (newVal) {
                startDataUpdates();
            } else {
                stopDataUpdates();
            }
        });

        showSetpointsCheck.selectedProperty().addListener((obs, old, newVal) -> {
            showSetpoints = newVal;
            updateSetpointOverlay();
        });

        exportButton.setOnAction(e -> exportData());
    }

    private void initializeCharts() {
        // Initialize main trend chart
        mainSeries = new XYChart.Series<>();
        mainSeries.setName("Current");
        mainTrendChart.getData().add(mainSeries);
        mainTrendChart.setAnimated(false);
        mainXAxis.setLowerBound(0);
        mainXAxis.setUpperBound(MAX_DATA_POINTS);
        mainYAxis.setAutoRanging(true);

        // Initialize setpoint overlay series (invisible by default)
        targetLine = new XYChart.Series<>();
        targetLine.setName("Target");
        highAlarmLine = new XYChart.Series<>();
        highAlarmLine.setName("High Alarm");
        lowAlarmLine = new XYChart.Series<>();
        lowAlarmLine.setName("Low Alarm");

        loadSetpointsForParameter(selectedParameter);

        // Initialize comparison chart
        comparisonChart.setAnimated(false);
        comparisonChart.setLegendVisible(false);

        // Initialize distribution chart
        distributionChart.setAnimated(false);
        distributionChart.setLegendVisible(true);
        distributionChart.setPrefSize(300, 300);

        // Initialize historical chart
        todaySeries = new XYChart.Series<>();
        todaySeries.setName("Today");
        historicalChart.getData().add(todaySeries);

        yesterdaySeries = new XYChart.Series<>();
        yesterdaySeries.setName("Yesterday");
        historicalChart.getData().add(yesterdaySeries);

        weekSeries = new XYChart.Series<>();
        weekSeries.setName("Last Week");
        historicalChart.getData().add(weekSeries);

        historicalChart.setAnimated(false);
        historicalChart.getXAxis().setLabel("Time (hours)");
        historicalChart.getYAxis().setLabel(selectedParameter);

        // Initialize with some data
        for (int i = 0; i < 20; i++) {
            addMainChartData();
        }

        initializeHistoricalCharts();
        updateComparisonChart();
        updateDistributionChart();
    }

    private void initializeHistoricalCharts() {
        // Simulate historical data
        for (int i = 0; i < HISTORICAL_DATA_POINTS; i++) {
            double todayValue = simulateValue(240, 250);
            double yesterdayValue = simulateValue(235, 245);
            double weekValue = simulateValue(230, 240);

            todaySeries.getData().add(new XYChart.Data<>(i, todayValue));
            yesterdaySeries.getData().add(new XYChart.Data<>(i, yesterdayValue));
            weekSeries.getData().add(new XYChart.Data<>(i, weekValue));
        }

        // Visibility based on checkboxes
        yesterdaySeries.getNode().setVisible(showYesterdayCheck.isSelected());
        weekSeries.getNode().setVisible(showWeekCheck.isSelected());

        // Add listeners to checkboxes
        showYesterdayCheck.selectedProperty().addListener((obs, old, newVal) -> {
            yesterdaySeries.getNode().setVisible(newVal);
        });
        showWeekCheck.selectedProperty().addListener((obs, old, newVal) -> {
            weekSeries.getNode().setVisible(newVal);
        });
    }

    private void startDataUpdates() {
        if (updateTimeline != null) {
            updateTimeline.stop();
        }

        updateTimeline = new Timeline(
            new KeyFrame(Duration.seconds(1), event -> {
                addMainChartData();
                updateMainChart();
                updateStatistics();
            })
        );
        updateTimeline.setCycleCount(Animation.INDEFINITE);
        updateTimeline.play();
    }

    private void stopDataUpdates() {
        if (updateTimeline != null) {
            updateTimeline.stop();
        }
    }

    private void addMainChartData() {
        timeCounter++;
        TagEngine engine = TagEngine.getInstance();
        double value = engine.getDoubleTag(selectedParameter);

        mainSeries.getData().add(new XYChart.Data<>(timeCounter, value));

        if (mainSeries.getData().size() > MAX_DATA_POINTS) {
            mainSeries.getData().remove(0);
            mainXAxis.setLowerBound(timeCounter - MAX_DATA_POINTS + 1);
            mainXAxis.setUpperBound(timeCounter);
        }

        // Refresh setpoint overlay lines to match new X range
        if (showSetpoints) {
            updateSetpointOverlay();
        }
updateDistributionChart();
    }

    private void updateMainChart() {
        Platform.runLater(() -> {
            mainTrendChart.requestLayout();
        });
    }

    private void updateStatistics() {
        Platform.runLater(() -> {
            if (mainSeries.getData().isEmpty()) return;

            double sum = 0;
            double max = Double.MIN_VALUE;
            double current = 0;

            for (XYChart.Data<Number, Number> data : mainSeries.getData()) {
                double value = data.getYValue().doubleValue();
                sum += value;
                if (value > max) max = value;
                current = value;
            }

            double average = sum / mainSeries.getData().size();

            String unit = getUnitForParameter(selectedParameter);
            currentValueLabel.setText(String.format("%.1f %s", current, unit));
            averageValueLabel.setText(String.format("%.1f %s", average, unit));
            peakValueLabel.setText(String.format("%.1f %s", max, unit));

            // Update setpoint deviation
            if (showSetpoints) {
                updateSetpointDeviation();
            }
        });
    }

    private void updateComparisonChart() {
        Platform.runLater(() -> {
            comparisonChart.getData().clear();

            String[] parameters = {"flow_rate", "pressure", "temperature", "tank_a_level"};
            String[] labels = {"Flow", "Pressure", "Temp", "Level"};

            for (int i = 0; i < parameters.length; i++) {
                XYChart.Series<String, Number> series = new XYChart.Series<>();
                series.setName(labels[i]);

                // Current value
                double currentValue = TagEngine.getInstance().getDoubleTag(parameters[i]);

                // Target value (90% of max)
                double targetValue = currentValue * 0.9;

                series.getData().add(new XYChart.Data<>("Current", currentValue));
                series.getData().add(new XYChart.Data<>("Target", targetValue));

                comparisonChart.getData().add(series);
            }
        });
    }

    private void updateDistributionChart() {
        Platform.runLater(() -> {
            distributionChart.getData().clear();
            // Build histogram from recent mainSeries values
            ObservableList<XYChart.Data<Number, Number>> dataList = mainSeries.getData();
            if (dataList.isEmpty()) {
                return;
            }
            // Determine min and max values
            double min = Double.MAX_VALUE;
            double max = Double.MIN_VALUE;
            for (XYChart.Data<Number, Number> d : dataList) {
                double v = d.getYValue().doubleValue();
                if (v < min) min = v;
                if (v > max) max = v;
            }
            int bins = 5;
            double range = max - min;
            double binSize = range / bins;
            if (binSize == 0) {
                binSize = 1;
            }
            double[] counts = new double[bins];
            for (XYChart.Data<Number, Number> d : dataList) {
                double v = d.getYValue().doubleValue();
                int idx = (int) ((v - min) / binSize);
                if (idx >= bins) idx = bins - 1;
                counts[idx]++;
            }
            for (int i = 0; i < bins; i++) {
                double lower = min + i * binSize;
                double upper = lower + binSize;
                String label = String.format("%.1f‑%.1f", lower, upper);
                PieChart.Data slice = new PieChart.Data(label, counts[i]);
                distributionChart.getData().add(slice);
            }
        });
    }

    private void switchParameter(String parameter, String displayName, String unit) {
        selectedParameter = parameter;
        mainChartTitle.setText(displayName + " Trends");
        
        // Reset main chart
        mainSeries.getData().clear();
        timeCounter = 0;
        mainXAxis.setLowerBound(0);
        mainXAxis.setUpperBound(MAX_DATA_POINTS);

        // Remove old setpoint lines
        mainTrendChart.getData().removeAll(targetLine, highAlarmLine, lowAlarmLine);
        targetLine.getData().clear();
        highAlarmLine.getData().clear();
        lowAlarmLine.getData().clear();

        // Update Y-axis label
        mainYAxis.setLabel(displayName);

        // Re-initialize with data
        for (int i = 0; i < 20; i++) {
            addMainChartData();
        }

        // Load setpoints for new parameter and re-apply overlay
        loadSetpointsForParameter(parameter);
        updateSetpointOverlay();

        // Update historical chart Y-axis
        historicalChart.getYAxis().setLabel(displayName);
    }

    private void handleTimeRangeChange() {
        String selected = timeRangeCombo.getSelectionModel().getSelectedItem();
        // This would adjust the chart time range
        System.out.println("Time range changed to: " + selected);
    }

    private void exportData() {
        // Implement data export functionality
        System.out.println("Exporting data...");
    }

    private String getUnitForParameter(String parameter) {
        switch (parameter) {
            case "flow_rate": return "L/min";
            case "pressure": return "bar";
            case "temperature": return "°C";
            case "tank_a_level": return "%";
            case "ph_level": return "";
            case "energy": return "kW/h";
            default: return "";
        }
    }

    private double simulateValue(double min, double max) {
        return ThreadLocalRandom.current().nextDouble(min, max);
    }

    // --- Setpoint Overlay Methods ---

    private void loadSetpointsForParameter(String parameter) {
        // Default setpoints per parameter (in production, load from backend API)
        switch (parameter) {
            case "flow_rate":
                setpointTarget = 250; setpointHighAlarm = 300; setpointLowAlarm = 180;
                break;
            case "pressure":
                setpointTarget = 4.0; setpointHighAlarm = 5.5; setpointLowAlarm = 2.5;
                break;
            case "temperature":
                setpointTarget = 65; setpointHighAlarm = 80; setpointLowAlarm = 50;
                break;
            case "tank_a_level":
                setpointTarget = 75; setpointHighAlarm = 95; setpointLowAlarm = 20;
                break;
            case "ph_level":
                setpointTarget = 7.0; setpointHighAlarm = 8.0; setpointLowAlarm = 6.5;
                break;
            case "energy":
                setpointTarget = 50; setpointHighAlarm = 80; setpointLowAlarm = 20;
                break;
            default:
                setpointTarget = Double.NaN; setpointHighAlarm = Double.NaN; setpointLowAlarm = Double.NaN;
        }
    }

    private void updateSetpointOverlay() {
        // Remove existing setpoint series
        mainTrendChart.getData().removeAll(targetLine, highAlarmLine, lowAlarmLine);
        targetLine.getData().clear();
        highAlarmLine.getData().clear();
        lowAlarmLine.getData().clear();

        if (!showSetpoints || Double.isNaN(setpointTarget)) {
            if (setpointDeviationLabel != null) {
                setpointDeviationLabel.setText("Δ Setpoint: --");
            }
            return;
        }

        // Build horizontal lines across the visible X range
        double xMin = mainXAxis.getLowerBound();
        double xMax = mainXAxis.getUpperBound();

        targetLine.getData().add(new XYChart.Data<>(xMin, setpointTarget));
        targetLine.getData().add(new XYChart.Data<>(xMax, setpointTarget));

        if (!Double.isNaN(setpointHighAlarm)) {
            highAlarmLine.getData().add(new XYChart.Data<>(xMin, setpointHighAlarm));
            highAlarmLine.getData().add(new XYChart.Data<>(xMax, setpointHighAlarm));
        }
        if (!Double.isNaN(setpointLowAlarm)) {
            lowAlarmLine.getData().add(new XYChart.Data<>(xMin, setpointLowAlarm));
            lowAlarmLine.getData().add(new XYChart.Data<>(xMax, setpointLowAlarm));
        }

        mainTrendChart.getData().add(targetLine);
        if (!highAlarmLine.getData().isEmpty()) mainTrendChart.getData().add(highAlarmLine);
        if (!lowAlarmLine.getData().isEmpty()) mainTrendChart.getData().add(lowAlarmLine);

        // Style the lines via node lookup after layout
        Platform.runLater(() -> {
            styleSetpointLine(targetLine, "#00ff9d", 2);
            styleSetpointLine(highAlarmLine, "#ff4444", 2);
            styleSetpointLine(lowAlarmLine, "#ff9d00", 2);
        });

        // Update deviation label
        updateSetpointDeviation();
    }

    private void styleSetpointLine(XYChart.Series<Number, Number> series, String color, double width) {
        if (series.getNode() != null) {
            series.getNode().setStyle("-fx-stroke: " + color + "; -fx-stroke-width: " + width + "; -fx-stroke-dash-array: 8 4;");
        }
    }

    private void updateSetpointDeviation() {
        if (setpointDeviationLabel == null || Double.isNaN(setpointTarget)) return;
        if (mainSeries.getData().isEmpty()) return;

        double current = mainSeries.getData().get(mainSeries.getData().size() - 1).getYValue().doubleValue();
        double delta = current - setpointTarget;
        String sign = delta >= 0 ? "+" : "";
        String unit = getUnitForParameter(selectedParameter);
        setpointDeviationLabel.setText(String.format("Δ Setpoint: %s%.1f %s", sign, delta, unit));

        if (Math.abs(delta) > (setpointTarget * 0.1)) {
            setpointDeviationLabel.setStyle("-fx-text-fill: #ff9d00; -fx-font-size: 12px; -fx-font-weight: bold;");
        } else {
            setpointDeviationLabel.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 12px;");
        }
    }

    public void cleanup() {
        stopDataUpdates();
    }

    public BorderPane getRoot() {
        return rootPane;
    }
}
