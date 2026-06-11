package com.kora.desktop.ui.faceplate;

import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Rectangle;

/**
 * Factory for creating standardized SCADA equipment faceplate components.
 * Each faceplate is a 120x80px (or wider) card showing equipment state.
 */
public final class FaceplateFactory {

    private static final String CARD_STYLE =
            "-fx-background-color: #0d2038; -fx-background-radius: 8; " +
            "-fx-border-color: #00ff9d; -fx-border-radius: 8; -fx-border-width: 2; " +
            "-fx-padding: 10; -fx-cursor: hand;";

    private FaceplateFactory() {}

    // ───────────────────────────── Pump ─────────────────────────────

    /**
     * Creates a pump faceplate showing running/stopped/fault state.
     *
     * @param name       display name (e.g. "Pump 1")
     * @param runningProp BooleanProperty bound to TagEngine pump tag
     * @return root VBox of the faceplate
     */
    public static VBox createPumpFaceplate(String name, BooleanProperty runningProp) {
        VBox card = new VBox(6);
        card.setStyle(CARD_STYLE);
        card.setPrefSize(150, 85);
        card.setPadding(new Insets(10));

        HBox header = new HBox(6);
        header.setAlignment(Pos.CENTER_LEFT);
        Label nameLabel = new Label(name);
        nameLabel.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 12px; -fx-font-weight: bold;");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Circle indicator = new Circle(5);
        indicator.setFill(javafx.scene.paint.Color.GRAY);

        header.getChildren().addAll(nameLabel, spacer, indicator);

        Label stateLabel = new Label("UNKNOWN");
        stateLabel.setStyle("-fx-text-fill: #b8c5d6; -fx-font-size: 14px; -fx-font-weight: bold;");

        Label hoursLabel = new Label("Run hours: --");
        hoursLabel.setStyle("-fx-text-fill: #5a7a9a; -fx-font-size: 10px;");

        card.getChildren().addAll(header, stateLabel, hoursLabel);

        // Bind running state
        if (runningProp != null) {
            runningProp.addListener((obs, o, n) -> updatePumpState(n.booleanValue(), indicator, stateLabel));
            updatePumpState(runningProp.get(), indicator, stateLabel);
        }

        return card;
    }

    private static void updatePumpState(boolean running, Circle indicator, Label stateLabel) {
        if (running) {
            indicator.setFill(javafx.scene.paint.Color.web("#00ff9d"));
            stateLabel.setText("RUNNING");
            stateLabel.setStyle("-fx-text-fill: #00ff9d; -fx-font-size: 14px; -fx-font-weight: bold;");
        } else {
            indicator.setFill(javafx.scene.paint.Color.web("#ff4444"));
            stateLabel.setText("STOPPED");
            stateLabel.setStyle("-fx-text-fill: #ff4444; -fx-font-size: 14px; -fx-font-weight: bold;");
        }
    }

    // ───────────────────────────── Valve ─────────────────────────────

    /**
     * Creates a valve faceplate showing open/closed state.
     *
     * @param name     display name (e.g. "Inlet Valve")
     * @param openProp BooleanProperty bound to TagEngine valve tag
     * @return root VBox of the faceplate
     */
    public static VBox createValveFaceplate(String name, BooleanProperty openProp) {
        VBox card = new VBox(6);
        card.setStyle(CARD_STYLE);
        card.setPrefSize(150, 85);
        card.setPadding(new Insets(10));

        HBox header = new HBox(6);
        header.setAlignment(Pos.CENTER_LEFT);
        Label nameLabel = new Label(name);
        nameLabel.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 12px; -fx-font-weight: bold;");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Circle indicator = new Circle(5);
        indicator.setFill(javafx.scene.paint.Color.GRAY);

        header.getChildren().addAll(nameLabel, spacer, indicator);

        Label stateLabel = new Label("UNKNOWN");
        stateLabel.setStyle("-fx-text-fill: #b8c5d6; -fx-font-size: 14px; -fx-font-weight: bold;");

        Label typeLabel = new Label("Gate Valve");
        typeLabel.setStyle("-fx-text-fill: #5a7a9a; -fx-font-size: 10px;");

        card.getChildren().addAll(header, stateLabel, typeLabel);

        if (openProp != null) {
            openProp.addListener((obs, o, n) -> updateValveState(n.booleanValue(), indicator, stateLabel));
            updateValveState(openProp.get(), indicator, stateLabel);
        }

        return card;
    }

    private static void updateValveState(boolean open, Circle indicator, Label stateLabel) {
        if (open) {
            indicator.setFill(javafx.scene.paint.Color.web("#00ff9d"));
            stateLabel.setText("OPEN");
            stateLabel.setStyle("-fx-text-fill: #00ff9d; -fx-font-size: 14px; -fx-font-weight: bold;");
        } else {
            indicator.setFill(javafx.scene.paint.Color.web("#ff4444"));
            stateLabel.setText("CLOSED");
            stateLabel.setStyle("-fx-text-fill: #ff4444; -fx-font-size: 14px; -fx-font-weight: bold;");
        }
    }

    // ───────────────────────────── Tank ─────────────────────────────

    /**
     * Creates a tank faceplate with a visual fill bar and level alarm markers.
     *
     * @param name      display name (e.g. "Tank A")
     * @param levelProp DoubleProperty bound to TagEngine level tag (0-100%)
     * @param capacity  tank capacity string (e.g. "5000L")
     * @return root VBox of the faceplate
     */
    public static VBox createTankFaceplate(String name, DoubleProperty levelProp, String capacity) {
        VBox card = new VBox(6);
        card.setStyle(CARD_STYLE);
        card.setPrefSize(160, 110);
        card.setPadding(new Insets(10));

        Label nameLabel = new Label(name);
        nameLabel.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 12px; -fx-font-weight: bold;");

        Label levelLabel = new Label("0.0%");
        levelLabel.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 18px; -fx-font-weight: bold;");

        // Fill bar
        VBox fillContainer = new VBox();
        fillContainer.setStyle("-fx-background-color: #1a2f4a; -fx-background-radius: 4; -fx-pref-height: 30;");
        fillContainer.setPrefHeight(30);

        Rectangle fillBar = new Rectangle(0, 30);
        fillBar.setFill(javafx.scene.paint.Color.web("#00ff9d"));
        fillBar.setArcWidth(4);
        fillBar.setArcHeight(4);

        fillContainer.getChildren().add(fillBar);

        HBox info = new HBox(8);
        info.setAlignment(Pos.CENTER_LEFT);
        Label capLabel = new Label(capacity);
        capLabel.setStyle("-fx-text-fill: #5a7a9a; -fx-font-size: 10px;");

        Label alarmLabel = new Label("");
        alarmLabel.setStyle("-fx-text-fill: #ff4444; -fx-font-size: 10px;");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        info.getChildren().addAll(capLabel, spacer, alarmLabel);

        card.getChildren().addAll(nameLabel, levelLabel, fillContainer, info);

        if (levelProp != null) {
            levelProp.addListener((obs, o, n) -> updateTankLevel(n.doubleValue(), fillBar, levelLabel, alarmLabel, fillContainer));
            updateTankLevel(levelProp.get(), fillBar, levelLabel, alarmLabel, fillContainer);
        }

        return card;
    }

    private static void updateTankLevel(double level, Rectangle fillBar, Label levelLabel,
                                         Label alarmLabel, VBox container) {
        levelLabel.setText(String.format("%.1f%%", level));
        double width = Math.max(0, Math.min(container.getWidth() > 0 ? container.getWidth() : 140, (level / 100.0) * 140));
        fillBar.setWidth(width);

        if (level >= 90) {
            fillBar.setFill(javafx.scene.paint.Color.web("#ff4444"));
            alarmLabel.setText("HIGH");
        } else if (level >= 75) {
            fillBar.setFill(javafx.scene.paint.Color.web("#ff9d00"));
            alarmLabel.setText("");
        } else if (level <= 15) {
            fillBar.setFill(javafx.scene.paint.Color.web("#ff4444"));
            alarmLabel.setText("LOW");
        } else {
            fillBar.setFill(javafx.scene.paint.Color.web("#00ff9d"));
            alarmLabel.setText("");
        }
    }

    // ───────────────────────────── Sensor ─────────────────────────────

    /**
     * Creates a sensor faceplate showing value, unit, and quality.
     *
     * @param name      display name (e.g. "Flow Rate")
     * @param valueProp DoubleProperty bound to TagEngine sensor tag
     * @param unit      engineering unit (e.g. "L/min", "bar", "°C")
     * @param range     display range string (e.g. "0-200 L/min")
     * @return root VBox of the faceplate
     */
    public static VBox createSensorFaceplate(String name, DoubleProperty valueProp, String unit, String range) {
        VBox card = new VBox(6);
        card.setStyle(CARD_STYLE);
        card.setPrefSize(150, 85);
        card.setPadding(new Insets(10));

        HBox header = new HBox(6);
        header.setAlignment(Pos.CENTER_LEFT);
        Label nameLabel = new Label(name);
        nameLabel.setStyle("-fx-text-fill: #00d4ff; -fx-font-size: 12px; -fx-font-weight: bold;");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Circle qualityDot = new Circle(4);
        qualityDot.setFill(javafx.scene.paint.Color.web("#00ff9d"));
        header.getChildren().addAll(nameLabel, spacer, qualityDot);

        HBox valueRow = new HBox(4);
        valueRow.setAlignment(Pos.CENTER_LEFT);
        Label valueLabel = new Label("0.0");
        valueLabel.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 18px; -fx-font-weight: bold;");
        Label unitLabel = new Label(unit);
        unitLabel.setStyle("-fx-text-fill: #b8c5d6; -fx-font-size: 12px;");
        valueRow.getChildren().addAll(valueLabel, unitLabel);

        Label rangeLabel = new Label(range);
        rangeLabel.setStyle("-fx-text-fill: #5a7a9a; -fx-font-size: 10px;");

        card.getChildren().addAll(header, valueRow, rangeLabel);

        if (valueProp != null) {
            valueProp.addListener((obs, o, n) -> valueLabel.setText(String.format("%.1f", n.doubleValue())));
            valueLabel.setText(String.format("%.1f", valueProp.get()));
        }

        return card;
    }
}
