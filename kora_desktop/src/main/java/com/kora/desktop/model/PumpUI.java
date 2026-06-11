package com.kora.desktop.model;

import com.kora.desktop.device.TagEngine;

import javafx.animation.Animation;
import javafx.animation.Interpolator;
import javafx.animation.RotateTransition;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Line;
import javafx.util.Duration;

public class PumpUI extends VBox {
    private Circle casing;
    private StackPane rotor;
    private RotateTransition rotation;
    private boolean isRunning = false;
    private String tag;

    public PumpUI(String labelText, String tag) {
        this.tag = tag;
        this.setSpacing(10);
        this.setAlignment(Pos.CENTER);
        this.getStyleClass().add("pump-container");

        StackPane pumpPane = new StackPane();
        
        casing = new Circle(40);
        casing.setFill(Color.web("#2b2b2b"));
        casing.setStroke(Color.web("#555555"));
        casing.setStrokeWidth(4);

        rotor = new StackPane();
        Line blade1 = new Line(0, -30, 0, 30);
        Line blade2 = new Line(-30, 0, 30, 0);
        blade1.setStroke(Color.web("#aaaaaa"));
        blade1.setStrokeWidth(6);
        blade2.setStroke(Color.web("#aaaaaa"));
        blade2.setStrokeWidth(6);
        rotor.getChildren().addAll(blade1, blade2);

        pumpPane.getChildren().addAll(casing, rotor);

        rotation = new RotateTransition(Duration.millis(500), rotor);
        rotation.setByAngle(360);
        rotation.setCycleCount(Animation.INDEFINITE);
        rotation.setInterpolator(Interpolator.LINEAR);
        
        setStatus(false); // Init stopped
        
        Label label = new Label(labelText);
        label.setStyle("-fx-text-fill: #00d4ff; -fx-font-weight: bold;");

        this.getChildren().addAll(pumpPane, label);
    }

    public void bind(TagEngine engine) {
        engine.getBooleanProperty(tag).addListener((obs, oldV, newV) -> {
            setStatus(newV);
        });
        setStatus(engine.getBooleanTag(tag));
    }

    public void setStatus(boolean on) {
        if (on && !isRunning) {
            casing.setStroke(Color.web("#00ff9d")); // Neon Green
            rotation.play();
            isRunning = true;
        } else if (!on && isRunning) {
            casing.setStroke(Color.web("#ff3333")); // Red
            rotation.stop();
            isRunning = false;
        }
    }
}
