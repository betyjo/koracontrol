package com.kora.desktop.main;

import com.kora.desktop.controller.LoginController;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.stage.Stage;
import java.net.URL;

public class App extends Application {

    private Stage primaryStage;
    private Scene scene;
    private MainLayout mainLayout;

    @Override
    public void start(Stage stage) {
        this.primaryStage = stage;
        stage.setTitle("Water Industry SCADA HMI");

        showLoginScreen();
        stage.show();
    }

    private void showLoginScreen() {
        try {
            LoginController loginController = new LoginController(primaryStage, this::showMainLayout);
            scene = new Scene(loginController.getRoot(), 1000, 700);
            applyStyles(scene);
            primaryStage.setScene(scene);
            primaryStage.centerOnScreen();
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Failed to load login screen: " + e.getMessage());
        }
    }

    private void showMainLayout() {
        try {
            // Cleanup previous controllers if any
            if (mainLayout != null) {
                mainLayout.cleanup();
            }

            mainLayout = new MainLayout(primaryStage, this::showLoginScreen);
            scene = new Scene(mainLayout.getRoot(), 1400, 900);
            applyStyles(scene);
            primaryStage.setScene(scene);
            primaryStage.centerOnScreen();
            
            // Ensure application exits cleanly since background threads like MQTT might be running
            primaryStage.setOnCloseRequest(e -> {
                if (mainLayout != null) {
                    mainLayout.cleanup();
                }
                System.exit(0);
            });
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Failed to load main layout: " + e.getMessage());
            // Fallback to login screen on error
            showLoginScreen();
        }
    }

    private void applyStyles(Scene scene) {
        try {
            URL styleUrl = getClass().getResource("/style.css");
            if (styleUrl != null) {
                scene.getStylesheets().clear();
                scene.getStylesheets().add(styleUrl.toExternalForm());
            }
        } catch (Exception e) {
            System.err.println("Failed to load styles: " + e.getMessage());
        }
    }

    @Override
    public void stop() throws Exception {
        // Cleanup when application is stopped
        if (mainLayout != null) {
            mainLayout.cleanup();
        }
        super.stop();
    }

    public static void main(String[] args) {
        launch();
    }
}
