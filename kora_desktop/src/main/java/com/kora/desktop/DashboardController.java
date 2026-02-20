package com.kora.desktop;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import javafx.animation.Animation;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.fxml.FXML;
import javafx.scene.control.Alert;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

public class DashboardController {
    private VBox rootContainer;
    private TankUI boilerTank;
    private Label tempLabel;
    private DataService dataService = new DataService();

    public void setRootContainer(VBox rootContainer) {
        this.rootContainer = rootContainer;
    }

    public void initDashboard() {
        // Programmatically add UI components for this demo
        boilerTank = new TankUI();
        tempLabel = new Label("0.0 L");
        tempLabel.getStyleClass().add("status-label");

        VBox card = new VBox(10, new Label("Boiler Status"), boilerTank, tempLabel);
        card.getStyleClass().add("dashboard-card");

        rootContainer.getChildren().add(card);

        // Start the 200ms background poller
        Timeline poller = new Timeline(new KeyFrame(Duration.millis(200), event -> {
            updateDashboard();
        }));
        poller.setCycleCount(Animation.INDEFINITE);
        poller.play();
    }

    private void updateDashboard() {
        try {
            String json = dataService.getLatestTags();
            JsonArray logs = JsonParser.parseString(json).getAsJsonArray();

            // Find the latest boiler level tag (Assuming Tag ID 1 is boiler level)
            if (logs.size() > 0) {
                JsonObject latest = logs.get(0).getAsJsonObject();
                double currentLevel = latest.get("value").getAsDouble();
                boilerTank.setLevel(currentLevel);
                tempLabel.setText(String.format("%.2f L", currentLevel));
            }
        } catch (Exception e) {
            System.out.println("Update failed: " + e.getMessage());
        }
    }

    @FXML
    public void handleEmergencyStop() {
        try {
            dataService.sendCommand(1, 0.0); // Assuming Tag ID 1 is the Pump/Boiler control
            Alert alert = new Alert(Alert.AlertType.INFORMATION);
            alert.setTitle("Control System");
            alert.setHeaderText(null);
            alert.setContentText("Emergency Stop Sent!");
            alert.showAndWait();
        } catch (Exception e) {
            Alert alert = new Alert(Alert.AlertType.ERROR);
            alert.setTitle("Control Error");
            alert.setContentText("Control Failed: " + e.getMessage());
            alert.showAndWait();
        }
    }
}
