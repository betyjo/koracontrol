package com.kora.desktop;

import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import java.net.URL;

public class App extends Application {

    @Override
    public void start(Stage stage) {
        VBox root = new VBox(20);
        root.setId("rootContainer");
        root.setStyle("-fx-padding: 30;");

        DashboardController controller = new DashboardController();
        // Since we are not using FXML loader for this simple setup, we'll manually
        // trigger init or adapt
        // In a real app, you'd load FXML here.

        Button stopBtn = new Button("EMERGENCY STOP");
        stopBtn.setStyle("-fx-background-color: #ff0000; -fx-text-fill: white; -fx-font-weight: bold;");
        stopBtn.setOnAction(e -> controller.handleEmergencyStop());

        Scene scene = new Scene(root, 400, 600);
        URL styleUrl = getClass().getResource("/style.css");
        if (styleUrl != null) {
            scene.getStylesheets().add(styleUrl.toExternalForm());
        }

        stage.setTitle("Kora SCADA HMI");
        stage.setScene(scene);
        stage.show();

        // Inject the root into controller and initialize
        controller.setRootContainer(root);
        controller.initDashboard();

        root.getChildren().add(stopBtn);
    }

    public static void main(String[] args) {
        launch();
    }
}
