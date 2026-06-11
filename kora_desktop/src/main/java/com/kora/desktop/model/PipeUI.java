package com.kora.desktop.model;

import javafx.animation.Animation;
import javafx.animation.Interpolator;
import javafx.animation.Transition;
import javafx.scene.layout.Region;
import javafx.scene.paint.Color;
import javafx.scene.shape.Line;
import javafx.scene.shape.StrokeLineCap;
import javafx.util.Duration;

public class PipeUI extends Region {

    private Line basePipe;
    private Line waterFlow;
    private FlowAnimation animation;
    private boolean isHorizontal;

    public PipeUI(double length, boolean horizontal) {
        this.isHorizontal = horizontal;
        
        basePipe = new Line();
        basePipe.setStroke(Color.web("#333333"));
        basePipe.setStrokeWidth(12);
        basePipe.setStrokeLineCap(StrokeLineCap.BUTT);

        waterFlow = new Line();
        waterFlow.setStroke(Color.web("#00aaff"));
        waterFlow.setStrokeWidth(6);
        waterFlow.getStrokeDashArray().addAll(10d, 10d);
        waterFlow.setStrokeLineCap(StrokeLineCap.BUTT);
        waterFlow.setVisible(false); // Hidden when no flow

        if (horizontal) {
            basePipe.setStartX(0);
            basePipe.setStartY(6);
            basePipe.setEndX(length);
            basePipe.setEndY(6);
            
            waterFlow.setStartX(0);
            waterFlow.setStartY(6);
            waterFlow.setEndX(length);
            waterFlow.setEndY(6);
            
            this.setPrefSize(length, 12);
        } else {
            basePipe.setStartX(6);
            basePipe.setStartY(0);
            basePipe.setEndX(6);
            basePipe.setEndY(length);
            
            waterFlow.setStartX(6);
            waterFlow.setStartY(0);
            waterFlow.setEndX(6);
            waterFlow.setEndY(length);
            
            this.setPrefSize(12, length);
        }

        this.getChildren().addAll(basePipe, waterFlow);

        animation = new FlowAnimation(waterFlow);
        animation.setCycleCount(Animation.INDEFINITE);
    }

    public void setFlowing(boolean flowing) {
        if (flowing) {
            waterFlow.setVisible(true);
            animation.play();
        } else {
            waterFlow.setVisible(false);
            animation.stop();
        }
    }

    private static class FlowAnimation extends Transition {
        private Line target;

        public FlowAnimation(Line target) {
            this.target = target;
            setCycleDuration(Duration.millis(500));
            setInterpolator(Interpolator.LINEAR);
        }

        @Override
        protected void interpolate(double frac) {
            // Animate dash offset from 0 to 20 (sum of dash array elements)
            target.setStrokeDashOffset(-20 * frac);
        }
    }
}
