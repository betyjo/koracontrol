package com.kora.desktop.model;

import com.kora.desktop.device.TagEngine;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;
import javafx.scene.shape.Polygon;

public class ValveUI extends VBox {

    private boolean isOpen = false;
    private Polygon bowtie;
    private Circle centerCircle;
    private String tag;

    public ValveUI(String labelText, String tag) {
        this.tag = tag;
        this.setSpacing(10);
        this.setAlignment(Pos.CENTER);
        this.getStyleClass().add("valve-container");

        // Valve body
        bowtie = new Polygon();
        bowtie.getPoints().addAll(
            0.0, 20.0,  // top left
            20.0, 0.0,  // top right  
            40.0, 20.0, // bottom right
            20.0, 40.0  // bottom left
        );
        bowtie.setFill(Color.web("#00ff9d")); // Start open color
        bowtie.setStroke(Color.web("#00d4ff"));
        bowtie.setStrokeWidth(2);

        // Center circle
        centerCircle = new Circle(20);
        centerCircle.setFill(Color.web("#1a1a1a"));
        centerCircle.setStroke(Color.web("#555555"));
        centerCircle.setStrokeWidth(2);

        StackPane valvePane = new StackPane();
        valvePane.getChildren().addAll(bowtie, centerCircle);

        Label label = new Label(labelText);
        label.setStyle("-fx-text-fill: #00d4ff; -fx-font-weight: bold;");

        this.getChildren().addAll(valvePane, label);
    }

    public void bind(TagEngine engine) {
        engine.getBooleanProperty(tag).addListener((obs, oldV, newV) -> {
            setOpen(newV);
        });
        setOpen(engine.getBooleanTag(tag));
    }

    public void setOpen(boolean open) {
        if (open != isOpen) {
            isOpen = open;
            if (open) {
                bowtie.setFill(Color.web("#00ff9d")); // Open color
            } else {
                bowtie.setFill(Color.web("#ff3333")); // Closed color
            }
        }
    }
}
