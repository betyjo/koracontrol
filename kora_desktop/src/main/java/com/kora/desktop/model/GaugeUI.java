package com.kora.desktop.model;

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;
import javafx.scene.shape.ArcType;
import javafx.scene.shape.StrokeLineCap;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;
import javafx.geometry.VPos;

public class GaugeUI extends Region {
    private Canvas canvas;
    private final DoubleProperty valueProperty = new SimpleDoubleProperty(0);
    
    private String label;
    private double minVal;
    private double maxVal;
    private String units;

    public GaugeUI(String label, double minVal, double maxVal, String units) {
        this.label = label;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.units = units;

        canvas = new Canvas();
        getChildren().add(canvas);
        
        valueProperty.addListener((obs, oldV, newV) -> draw());

        widthProperty().addListener((obs, oldV, newV) -> {
            canvas.setWidth(newV.doubleValue());
            draw();
        });
        heightProperty().addListener((obs, oldV, newV) -> {
            canvas.setHeight(newV.doubleValue());
            draw();
        });
    }

    public void setLevel(double value) {
        this.valueProperty.set(Math.max(minVal, Math.min(maxVal, value)));
    }

    private void draw() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        double w = getWidth();
        double h = getHeight();
        
        if (w == 0 || h == 0) return;

        gc.clearRect(0, 0, w, h);

        double labelH = 22;
        double size = Math.min(w, h - labelH) - 10;
        double cx = w / 2;
        double cy = (h - labelH) / 2;
        double x = cx - size / 2;
        double y = cy - size / 2;

        double startAngle = 225;
        double extent = -270;

        // Draw background arc
        gc.setStroke(Color.web("#0f3460"));
        gc.setLineWidth(8);
        gc.setLineCap(StrokeLineCap.ROUND);
        gc.strokeArc(x, y, size, size, startAngle, extent, ArcType.OPEN);

        // Calculate value fraction
        double frac = (valueProperty.get() - minVal) / Math.max(maxVal - minVal, 1e-9);
        frac = Math.max(0, Math.min(1, frac));
        double valueSpan = frac * extent;

        // Draw value arc
        gc.setStroke(getArcColor(frac));
        gc.strokeArc(x, y, size, size, startAngle, valueSpan, ArcType.OPEN);

        // Needle
        double needleRad = Math.toRadians(startAngle + valueSpan);
        double needleLen = size * 0.38;
        double nx = cx + needleLen * Math.cos(needleRad);
        double ny = cy - needleLen * Math.sin(needleRad);
        
        gc.setStroke(Color.WHITE);
        gc.setLineWidth(2);
        gc.strokeLine(cx, cy, nx, ny);

        // Center dot
        gc.setFill(Color.web("#00d4ff"));
        gc.fillOval(cx - 3, cy - 3, 6, 6);

        // Value text
        gc.setFill(Color.web("#e0e0e0"));
        gc.setFont(Font.font("Segoe UI", FontWeight.BOLD, 12));
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setTextBaseline(VPos.CENTER);
        gc.fillText(String.format("%.1f", valueProperty.get()), cx, cy + size * 0.15);

        // Units text
        gc.setFill(Color.web("#888888"));
        gc.setFont(Font.font("Segoe UI", FontWeight.NORMAL, 10));
        gc.fillText(units, cx, cy + size * 0.15 + 15);

        // Min/Max ticks
        gc.setFill(Color.web("#555555"));
        gc.setFont(Font.font("Segoe UI", FontWeight.NORMAL, 9));
        double tickR = size * 0.52;
        
        double radMin = Math.toRadians(startAngle);
        gc.fillText(String.valueOf((int)minVal), cx + tickR * Math.cos(radMin), cy - tickR * Math.sin(radMin));
        
        double radMax = Math.toRadians(startAngle + extent);
        gc.fillText(String.valueOf((int)maxVal), cx + tickR * Math.cos(radMax), cy - tickR * Math.sin(radMax));

        // Label
        gc.setFill(Color.web("#00d4ff"));
        gc.setFont(Font.font("Segoe UI", FontWeight.BOLD, 10));
        gc.fillText(label, cx, h - labelH / 2);
    }

    private Color getArcColor(double frac) {
        if (frac >= 0.85) return Color.web("#ff4444");
        if (frac <= 0.10) return Color.web("#ffaa00");
        return Color.web("#00d4ff");
    }
}
