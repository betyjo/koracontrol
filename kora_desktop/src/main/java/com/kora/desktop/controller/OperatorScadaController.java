package com.kora.desktop.controller;


import com.kora.desktop.model.LeakAlarm;
import com.kora.desktop.model.LeakSeverity;
import com.kora.desktop.service.LeakDetectionService;
import javafx.animation.AnimationTimer;
import javafx.fxml.FXML;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.ListView;
import javafx.scene.paint.Color;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;


/**
 * Controller for the new Operator SCADA tab.
 * It displays a simple process diagram (using Canvas) and a list of leak alarms.
 * A lightweight AnimationTimer polls the TagEngine every frame (≈60Hz) and runs the
 * LeakDetectionService. If a leak is detected, it is added to the observable list
 * and rendered on the Canvas as a colored circle.
 */
public class OperatorScadaController {
    @FXML private Canvas canvas;
    @FXML private ListView<String> alarmListView;


    private final LeakDetectionService leakService = new LeakDetectionService();
    private final ObservableList<String> alarmItems = FXCollections.observableArrayList();

    private AnimationTimer timer;

    @FXML
    public void initialize() {
        // draw a neutral background on the canvas
        drawInitialCanvas();
        alarmListView.setItems(alarmItems);
        startMonitoring();
    }

    /**
     * Draw a simple background on the canvas so the tab is not visually empty.
     */
    private void drawInitialCanvas() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.setFill(Color.DARKGRAY);
        gc.fillRect(0, 0, canvas.getWidth(), canvas.getHeight());
    }

    private void startMonitoring() {
        timer = new AnimationTimer() {
            @Override
            public void handle(long now) {
                // Detect leak using service (fetches sensor data internally)
                LeakAlarm alarm = leakService.detectLeak();
                if (alarm != null) {
                    // Add to UI list
                    alarmItems.add(formatAlarm(alarm));
                    // Draw marker on canvas
                    drawLeakMarker(alarm.getSeverity());
                }
            }
        };
        timer.start();
    }

    private String formatAlarm(LeakAlarm alarm) {
        return String.format("[%s] %s (severity: %s)", alarm.getTimestamp(), alarm.getMessage(), alarm.getSeverity());
    }

    private void drawLeakMarker(LeakSeverity severity) {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        // Simple representation: draw a circle at a fixed location with color based on severity
        Color color;
        switch (severity) {
            case HIGH:   color = Color.RED; break;
            case MEDIUM: color = Color.ORANGE; break;
            default:     color = Color.YELLOW; break;
        }
        // Example position – you can adjust as needed
        double x = 400; // midpoint of diagram
        double y = 300;
        double radius = 12;
        gc.setFill(color);
        gc.fillOval(x - radius, y - radius, radius * 2, radius * 2);
    }

    // Optional: provide a method to stop the timer when the tab is hidden
    public void stopMonitoring() {
        if (timer != null) {
            timer.stop();
        }
    }
}
