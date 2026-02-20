package com.kora.desktop;

import javafx.animation.KeyFrame;
import javafx.animation.KeyValue;
import javafx.animation.Timeline;
import javafx.geometry.Pos;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import javafx.util.Duration;

public class TankUI extends StackPane {
    private Rectangle water = new Rectangle();
    private double maxCapacity = 200.0;

    public TankUI() {
        this.setPrefSize(100, 200);
        this.getStyleClass().add("tank-container");

        water.setWidth(100);
        water.setFill(Color.DODGERBLUE);
        
        // Align water to the bottom of the tank
        StackPane.setAlignment(water, Pos.BOTTOM_CENTER);
        this.getChildren().add(water);
    }

    public void setLevel(double value) {
        // Smooth animation for the water level
        double targetHeight = (value / maxCapacity) * 200;
        Timeline timeline = new Timeline(
            new KeyFrame(Duration.millis(200), new KeyValue(water.heightProperty(), targetHeight))
        );
        timeline.play();
    }
}
