package com.kora.desktop.controller;

import com.github.sarxos.webcam.Webcam;
import javafx.animation.AnimationTimer;
import javafx.application.Platform;
import javafx.embed.swing.SwingFXUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.ImageView;
import javafx.scene.image.WritableImage;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.shape.Ellipse;
import javafx.scene.shape.Rectangle;
import javafx.scene.shape.Shape;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.stage.StageStyle;

import java.awt.image.BufferedImage;
import java.util.function.Consumer;

public class FaceIdCameraPopup {

    private final Stage dialogStage;
    private Webcam webcam;
    private AnimationTimer frameTimer;
    private BufferedImage capturedFrame;
    private boolean capturing = false;
    private int warmUpCount = 0;
    private static final int WARM_UP_FRAMES = 12;

    public FaceIdCameraPopup(Stage owner, Consumer<byte[]> onCaptured, Runnable onCancelled) {
        dialogStage = new Stage();
        dialogStage.initOwner(owner);
        dialogStage.initModality(Modality.APPLICATION_MODAL);
        dialogStage.initStyle(StageStyle.UNDECORATED);
        dialogStage.setTitle("Face ID");

        ImageView cameraView = new ImageView();
        cameraView.setFitWidth(480);
        cameraView.setFitHeight(360);
        cameraView.setPreserveRatio(true);
        cameraView.setSmooth(true);

        Label statusLabel = new Label("Starting camera...");
        statusLabel.setTextFill(Color.web("#00d4ff"));
        statusLabel.setFont(Font.font("System", FontWeight.NORMAL, 14));

        Button captureBtn = new Button("CAPTURE");
        captureBtn.setStyle(
                "-fx-background-color: linear-gradient(to bottom, #00ff9d, #00cc7d);" +
                "-fx-text-fill: #071426; -fx-font-weight: bold; -fx-font-size: 14px;" +
                "-fx-background-radius: 25; -fx-padding: 12 40;" +
                "-fx-cursor: hand;"
        );
        captureBtn.setDisable(true);

        Button cancelBtn = new Button("CANCEL");
        cancelBtn.setStyle(
                "-fx-background-color: transparent; -fx-text-fill: #ff4444;" +
                "-fx-font-weight: bold; -fx-font-size: 13px; -fx-border-color: #ff4444;" +
                "-fx-border-radius: 25; -fx-background-radius: 25; -fx-padding: 10 35;" +
                "-fx-cursor: hand;"
        );

        captureBtn.setOnAction(e -> {
            capturing = true;
            statusLabel.setText("Processing...");
            captureBtn.setDisable(true);
        });

        cancelBtn.setOnAction(e -> {
            cleanup();
            dialogStage.close();
            if (onCancelled != null) onCancelled.run();
        });

        dialogStage.setOnCloseRequest(e -> {
            cleanup();
            if (onCancelled != null) onCancelled.run();
        });

        VBox layout = new VBox(15);
        layout.setAlignment(Pos.CENTER);
        layout.setPadding(new Insets(20));
        layout.setStyle(
                "-fx-background-color: #0a1628; -fx-border-color: #00ff9d;" +
                "-fx-border-width: 2; -fx-border-radius: 16; -fx-background-radius: 16;"
        );

        Label titleLabel = new Label("FACE ID");
        titleLabel.setTextFill(Color.web("#00ff9d"));
        titleLabel.setFont(Font.font("System", FontWeight.BOLD, 20));

        StackPane cameraPane = new StackPane();
        cameraPane.setStyle(
                "-fx-background-color: #000; -fx-background-radius: 12;" +
                "-fx-border-color: #1a3a5c; -fx-border-radius: 12; -fx-border-width: 1;"
        );

        Rectangle clip = new Rectangle(480, 360);
        clip.setArcWidth(24);
        clip.setArcHeight(24);
        cameraPane.setClip(clip);

        cameraPane.getChildren().add(cameraView);

        HBox buttonRow = new HBox(15, cancelBtn, captureBtn);
        buttonRow.setAlignment(Pos.CENTER);

        layout.getChildren().addAll(titleLabel, cameraPane, statusLabel, buttonRow);

        Scene scene = new Scene(layout);
        scene.setFill(Color.TRANSPARENT);
        dialogStage.setScene(scene);

        startCamera(cameraView, statusLabel, captureBtn, onCaptured);
    }

    private void startCamera(ImageView cameraView, Label statusLabel, Button captureBtn,
                              Consumer<byte[]> onCaptured) {
        new Thread(() -> {
            try {
                webcam = Webcam.getDefault();
                if (webcam == null) {
                    Platform.runLater(() -> {
                        statusLabel.setText("No webcam detected");
                        statusLabel.setTextFill(Color.web("#ff4444"));
                    });
                    return;
                }

                webcam.setViewSize(new java.awt.Dimension(640, 480));
                webcam.open();
                warmUpCount = 0;

                Platform.runLater(() -> {
                    statusLabel.setText("Position your face in the oval");
                    statusLabel.setTextFill(Color.web("#00d4ff"));

                    frameTimer = new AnimationTimer() {
                        @Override
                        public void handle(long now) {
                            if (webcam == null || !webcam.isOpen()) return;

                            BufferedImage frame = webcam.getImage();
                            if (frame == null) return;

                            warmUpCount++;
                            if (warmUpCount < WARM_UP_FRAMES) {
                                statusLabel.setText("Warming up camera...");
                                return;
                            }

                            if (captureBtn.isDisable() && warmUpCount >= WARM_UP_FRAMES) {
                                captureBtn.setDisable(false);
                                statusLabel.setText("Position your face in the oval");
                                statusLabel.setTextFill(Color.web("#00d4ff"));
                            }

                            if (capturing) {
                                capturedFrame = frame;
                                cleanup();
                                dialogStage.close();

                                byte[] imageBytes = encodeToJpeg(capturedFrame);
                                if (onCaptured != null && imageBytes != null) {
                                    onCaptured.accept(imageBytes);
                                }
                                return;
                            }

                            WritableImage fxImage = SwingFXUtils.toFXImage(frame, null);
                            cameraView.setImage(fxImage);
                        }
                    };
                    frameTimer.start();
                });

            } catch (Exception ex) {
                ex.printStackTrace();
                Platform.runLater(() -> {
                    statusLabel.setText("Camera error: " + ex.getMessage());
                    statusLabel.setTextFill(Color.web("#ff4444"));
                });
            }
        }).start();
    }

    private byte[] encodeToJpeg(BufferedImage image) {
        try {
            int maxSize = 640;
            int width = image.getWidth();
            int height = image.getHeight();
            double scale = Math.min(1.0, (double) maxSize / Math.max(width, height));
            int targetW = Math.max(1, (int) Math.round(width * scale));
            int targetH = Math.max(1, (int) Math.round(height * scale));

            BufferedImage rgb = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = rgb.createGraphics();
            g.setRenderingHint(
                    java.awt.RenderingHints.KEY_INTERPOLATION,
                    java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(image, 0, 0, targetW, targetH, null);
            g.dispose();

            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageWriter writer = javax.imageio.ImageIO.getImageWritersByFormatName("jpg").next();
            try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                writer.setOutput(ios);
                javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                if (param.canWriteCompressed()) {
                    param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                    param.setCompressionQuality(0.85f);
                }
                writer.write(null, new javax.imageio.IIOImage(rgb, null, null), param);
            } finally {
                writer.dispose();
            }
            return baos.toByteArray();
        } catch (Exception ex) {
            ex.printStackTrace();
            return null;
        }
    }

    private void cleanup() {
        if (frameTimer != null) {
            frameTimer.stop();
            frameTimer = null;
        }
        if (webcam != null) {
            try {
                webcam.close();
            } catch (Exception ignored) {}
            webcam = null;
        }
    }

    public void show() {
        dialogStage.show();
    }

    public void showAndWait() {
        dialogStage.showAndWait();
    }
}
