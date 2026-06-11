package com.kora.desktop.controller;

import com.kora.desktop.service.AuthService;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.fxml.Initializable;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.PasswordField;
import javafx.scene.control.TextField;
import javafx.scene.image.ImageView;
import javafx.stage.Stage;

import java.io.IOException;
import java.net.URL;
import java.util.ResourceBundle;

public class LoginController implements Initializable {

    @FXML
    private TextField usernameField;

    @FXML
    private PasswordField passwordField;

    @FXML
    private Label errorLabel;

    @FXML
    private Button loginButton;

    @FXML
    private Button faceLoginButton;

    @FXML
    private ImageView logoImageView;

    private Stage stage;
    private Runnable onLoginSuccess;
    private Parent root;

    public LoginController(Stage stage, Runnable onLoginSuccess) {
        this.stage = stage;
        this.onLoginSuccess = onLoginSuccess;
        loadFXML();
    }

    private void loadFXML() {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource("/ui/login.fxml"));
            loader.setController(this);
            root = loader.load();
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to load login FXML", e);
        }
    }

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupButtonHandlers();
    }

    private void setupButtonHandlers() {
        loginButton.setOnAction(e -> handleLogin());
        faceLoginButton.setOnAction(e -> handleFaceLogin());
    }

    private void handleLogin() {
        errorLabel.setVisible(false);
        loginButton.setText("AUTHENTICATING...");
        loginButton.setDisable(true);

        String username = usernameField.getText();
        String password = passwordField.getText();

        // Run networking code on background thread
        new Thread(() -> {
            AuthService.LoginResult result = AuthService.getInstance().login(username, password);
            javafx.application.Platform.runLater(() -> {
                if (result == AuthService.LoginResult.SUCCESS) {
                    if (onLoginSuccess != null) {
                        onLoginSuccess.run();
                    }
                } else {
                    if (result == AuthService.LoginResult.ACCESS_DENIED) {
                        errorLabel.setText("Access Denied. The Desktop HMI is restricted to SCADA Operators.\nAdmins must use the Web Admin Panel.");
                    } else if (result == AuthService.LoginResult.INVALID_CREDENTIALS) {
                        errorLabel.setText("Invalid username or password.");
                    } else if (result == AuthService.LoginResult.SERVER_ERROR) {
                        errorLabel.setText(AuthService.getInstance().getLastErrorMessage());
                    } else {
                        errorLabel.setText(
                                AuthService.getInstance().getLastErrorMessage().isBlank()
                                        ? "Connection error. Could not reach server."
                                        : AuthService.getInstance().getLastErrorMessage()
                        );
                    }
                    errorLabel.setVisible(true);
                    loginButton.setText("LOGIN");
                    loginButton.setDisable(false);
                }
            });
        }).start();
    }

    private void handleFaceLogin() {
        errorLabel.setVisible(false);
        faceLoginButton.setText("OPENING CAMERA...");
        faceLoginButton.setDisable(true);
        loginButton.setDisable(true);

        // Show camera preview popup — capture happens asynchronously
        FaceIdCameraPopup cameraPopup = new FaceIdCameraPopup(
                stage,
                imageBytes -> processFaceCapture(imageBytes),
                () -> javafx.application.Platform.runLater(() -> {
                    faceLoginButton.setText("FACE ID LOGIN");
                    faceLoginButton.setDisable(false);
                    loginButton.setDisable(false);
                })
        );
        cameraPopup.show();
    }

    private void processFaceCapture(byte[] imageBytes) {
        javafx.application.Platform.runLater(() ->
                faceLoginButton.setText("AUTHENTICATING... (may take up to 1 min)"));

        new Thread(() -> {
            AuthService.LoginResult result = AuthService.getInstance().biometricLogin(imageBytes);
            AuthService auth = AuthService.getInstance();

            javafx.application.Platform.runLater(() -> {
                if (result == AuthService.LoginResult.SUCCESS) {
                    if (onLoginSuccess != null) onLoginSuccess.run();
                } else {
                    if (result == AuthService.LoginResult.ACCESS_DENIED) {
                        errorLabel.setText(
                                auth.getLastErrorMessage().isBlank()
                                        ? "Access denied. Only operators may use Face ID on the desktop HMI."
                                        : auth.getLastErrorMessage()
                        );
                    } else if (result == AuthService.LoginResult.INVALID_CREDENTIALS) {
                        errorLabel.setText(
                                auth.getLastErrorMessage().isBlank()
                                        ? "Face not recognized. Center your face and try again."
                                        : auth.getLastErrorMessage()
                        );
                    } else if (result == AuthService.LoginResult.SERVER_ERROR) {
                        errorLabel.setText(auth.getLastErrorMessage());
                    } else {
                        errorLabel.setText(
                                auth.getLastErrorMessage().isBlank()
                                        ? "Connection error during Face ID."
                                        : auth.getLastErrorMessage()
                        );
                    }
                    errorLabel.setVisible(true);
                    faceLoginButton.setText("FACE ID LOGIN");
                    faceLoginButton.setDisable(false);
                    loginButton.setDisable(false);
                }
            });
        }).start();
    }

    public Parent getRoot() {
        return root;
    }
}
