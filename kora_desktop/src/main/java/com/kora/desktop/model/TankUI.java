package com.kora.desktop.model;

import com.kora.desktop.device.TagEngine;

import javafx.animation.KeyFrame;
import javafx.animation.KeyValue;
import javafx.animation.Timeline;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import javafx.util.Duration;

public class TankUI extends VBox {
    private Rectangle water = new Rectangle();
    private String tag;

    public TankUI(String labelText, String tag) {
        this.tag = tag;
        this.setSpacing(10);
        this.setAlignment(Pos.CENTER);
        this.getStyleClass().add("tank-container");

        // Tank body
        Rectangle tankBody = new Rectangle(100, 120);
        tankBody.setFill(Color.web("#2b2b2b"));
        tankBody.setStroke(Color.web("#555555"));
        tankBody.setStrokeWidth(3);
        tankBody.setArcWidth(10);
        tankBody.setArcHeight(10);

        // Water (inside tank)
        water.setWidth(90);
        water.setHeight(0);
        water.setFill(Color.web("#00d4ff", 0.7));
        water.setArcWidth(5);
        water.setArcHeight(5);

        StackPane tankPane = new StackPane();
        tankPane.getChildren().addAll(tankBody, water);
        StackPane.setAlignment(water, Pos.BOTTOM_CENTER);

        Label label = new Label(labelText);
        label.setStyle("-fx-text-fill: #00d4ff; -fx-font-weight: bold;");

        this.getChildren().addAll(tankPane, label);
    }

    public void bind(TagEngine engine) {
        engine.getDoubleProperty(tag).addListener((obs, oldV, newV) -> {
            setLevel(newV.doubleValue());
        });
        setLevel(engine.getDoubleTag(tag));
    }

    public void setLevel(double percentage) {
        // Animate water level change
        double targetHeight = Math.max(0, Math.min(110, percentage * 1.1)); // 110 is max water height in tank
        
        Timeline timeline = new Timeline(
            new KeyFrame(Duration.millis(500), new KeyValue(water.heightProperty(), targetHeight))
        );
        timeline.play();
    }
}
