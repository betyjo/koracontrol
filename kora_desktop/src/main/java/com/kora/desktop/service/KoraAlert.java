package com.kora.desktop.service;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.layout.*;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.stage.StageStyle;

import java.util.Optional;

/**
 * Beautifully styled alert dialogs matching the Kora SCADA dark futuristic theme.
 * Replaces default JavaFX Alert dialogs for a consistent, professional look.
 */
public class KoraAlert {

    // ─── Theme Colors ─────────────────────────────────────────────
    private static final String BG_DARK      = "#0b1a2e";
    private static final String BG_CARD      = "#0f2440";
    private static final String BG_HEADER    = "#122c4f";
    private static final String BORDER       = "#1e3f66";
    private static final String TEXT_PRIMARY  = "#e8edf3";
    private static final String TEXT_SECONDARY = "#8fa3bd";
    private static final String ACCENT_GREEN  = "#00ff9d";
    private static final String ACCENT_CYAN   = "#00d4ff";

    private static final String COLOR_WARNING   = "#ffb020";
    private static final String COLOR_ERROR     = "#ff3b5c";
    private static final String COLOR_INFO      = "#00d4ff";
    private static final String COLOR_SUCCESS   = "#00ff9d";
    private static final String COLOR_EMERGENCY = "#ff0044";

    // ─── Public API ───────────────────────────────────────────────

    /** Show a warning alert (OK button). */
    public static void warning(String title, String message) {
        show(AlertType.WARNING, title, message, false);
    }

    /** Show an error alert (OK button). */
    public static void error(String title, String message) {
        show(AlertType.ERROR, title, message, false);
    }

    /** Show an info alert (OK button). */
    public static void info(String title, String message) {
        show(AlertType.INFO, title, message, false);
    }

    /** Show a success alert (OK button). */
    public static void success(String title, String message) {
        show(AlertType.SUCCESS, title, message, false);
    }

    /** Show a confirmation dialog (OK / Cancel). Returns the chosen ButtonType. */
    public static Optional<ButtonType> confirm(String title, String message) {
        return show(AlertType.INFO, title, message, true);
    }

    /** Show a warning confirmation dialog (OK / Cancel). */
    public static Optional<ButtonType> confirmWarning(String title, String message) {
        return show(AlertType.WARNING, title, message, true);
    }

    /** Show an emergency / critical confirmation dialog (OK / Cancel). */
    public static Optional<ButtonType> confirmEmergency(String title, String message) {
        return show(AlertType.EMERGENCY, title, message, true);
    }

    // ─── Internals ────────────────────────────────────────────────

    private enum AlertType { WARNING, ERROR, INFO, SUCCESS, EMERGENCY }

    private static Optional<ButtonType> show(AlertType type, String title, String message, boolean showCancel) {
        Stage dialog = new Stage();
        dialog.initModality(Modality.APPLICATION_MODAL);
        dialog.initStyle(StageStyle.UNDECORATED);
        dialog.setResizable(false);

        final ButtonType[] result = { ButtonType.CANCEL };

        // ── Root container ──
        VBox root = new VBox();
        root.setStyle("-fx-background-color: " + BG_DARK + ";"
                + "-fx-background-radius: 14;"
                + "-fx-border-color: " + accentFor(type) + ";"
                + "-fx-border-radius: 14;"
                + "-fx-border-width: 2;");
        root.setPrefWidth(440);
        root.setEffect(new javafx.scene.effect.DropShadow(30, 0, 8, javafx.scene.paint.Color.rgb(0, 0, 0, 0.7)));

        // ── Header bar ──
        HBox header = buildHeader(type, title);

        // ── Body ──
        HBox body = buildBody(type, message);

        // ── Button bar ──
        HBox buttons = buildButtons(type, showCancel, dialog, result);

        root.getChildren().addAll(header, body, buttons);

        // ── Drag support ──
        final double[] dragDelta = new double[2];
        header.setOnMousePressed(e -> {
            dragDelta[0] = dialog.getX() - e.getScreenX();
            dragDelta[1] = dialog.getY() - e.getScreenY();
        });
        header.setOnMouseDragged(e -> {
            dialog.setX(e.getScreenX() + dragDelta[0]);
            dialog.setY(e.getScreenY() + dragDelta[1]);
        });
        header.setStyle(header.getStyle() + "-fx-cursor: hand;");

        Scene scene = new Scene(root);
        scene.setFill(javafx.scene.paint.Color.TRANSPARENT);

        // Apply the app stylesheet so fonts match
        var styleUrl = KoraAlert.class.getResource("/style.css");
        if (styleUrl != null) {
            scene.getStylesheets().add(styleUrl.toExternalForm());
        }

        dialog.setScene(scene);
        dialog.sizeToScene();
        dialog.centerOnScreen();
        dialog.showAndWait();

        return Optional.of(result[0]);
    }

    // ── Header ───────────────────────────────────────────────────
    private static HBox buildHeader(AlertType type, String title) {
        String accent = accentFor(type);

        Label icon = new Label(iconFor(type));
        icon.setFont(Font.font("Segoe UI Emoji", FontWeight.BOLD, 22));
        icon.setTextFill(javafx.scene.paint.Color.web(accent));

        Label titleLabel = new Label(title.toUpperCase());
        titleLabel.setFont(Font.font("Segoe UI", FontWeight.BOLD, 15));
        titleLabel.setTextFill(javafx.scene.paint.Color.web(accent));
        titleLabel.setStyle("-fx-letter-spacing: 1.5px;");

        HBox header = new HBox(12, icon, titleLabel);
        header.setAlignment(Pos.CENTER_LEFT);
        header.setPadding(new Insets(16, 20, 14, 20));
        header.setStyle("-fx-background-color: " + BG_HEADER + ";"
                + "-fx-background-radius: 14 14 0 0;");
        return header;
    }

    // ── Body ─────────────────────────────────────────────────────
    private static HBox buildBody(AlertType type, String message) {
        // Accent stripe on the left
        Region stripe = new Region();
        stripe.setPrefWidth(4);
        stripe.setMinWidth(4);
        stripe.setMaxWidth(4);
        stripe.setStyle("-fx-background-color: " + accentFor(type) + ";");

        Label msgLabel = new Label(message);
        msgLabel.setWrapText(true);
        msgLabel.setMaxWidth(370);
        msgLabel.setFont(Font.font("Segoe UI", 14));
        msgLabel.setTextFill(javafx.scene.paint.Color.web(TEXT_PRIMARY));
        msgLabel.setLineSpacing(4);

        VBox textBox = new VBox(msgLabel);
        textBox.setPadding(new Insets(20, 20, 20, 16));
        textBox.setAlignment(Pos.CENTER_LEFT);

        HBox body = new HBox(stripe, textBox);
        body.setStyle("-fx-background-color: " + BG_CARD + ";");
        return body;
    }

    // ── Buttons ──────────────────────────────────────────────────
    private static HBox buildButtons(AlertType type, boolean showCancel, Stage dialog, ButtonType[] result) {
        Button okBtn = new Button("  OK  ");
        stylePrimaryButton(okBtn, type);
        okBtn.setOnAction(e -> {
            result[0] = ButtonType.OK;
            dialog.close();
        });

        HBox bar = new HBox(12);
        bar.setAlignment(Pos.CENTER_RIGHT);
        bar.setPadding(new Insets(12, 20, 16, 20));
        bar.setStyle("-fx-background-color: " + BG_DARK + ";"
                + "-fx-background-radius: 0 0 14 14;");

        if (showCancel) {
            Button cancelBtn = new Button("Cancel");
            styleCancelButton(cancelBtn);
            cancelBtn.setOnAction(e -> {
                result[0] = ButtonType.CANCEL;
                dialog.close();
            });
            bar.getChildren().addAll(cancelBtn, okBtn);
        } else {
            bar.getChildren().add(okBtn);
        }

        return bar;
    }

    // ── Button styling ───────────────────────────────────────────
    private static void stylePrimaryButton(Button btn, AlertType type) {
        String accent = accentFor(type);
        String hoverBg;
        switch (type) {
            case WARNING   -> hoverBg = "#cc8d1a";
            case ERROR, EMERGENCY -> hoverBg = "#cc2e49";
            default        -> hoverBg = "#00b878";
        }

        btn.setFont(Font.font("Segoe UI", FontWeight.BOLD, 13));
        btn.setTextFill(javafx.scene.paint.Color.web("#0b1a2e"));
        btn.setPadding(new Insets(9, 28, 9, 28));
        btn.setCursor(javafx.scene.Cursor.HAND);
        btn.setStyle(
                "-fx-background-color: " + accent + ";"
                + "-fx-background-radius: 8;"
                + "-fx-effect: dropshadow(three-pass-box, " + accent + "55, 10, 0, 0, 2);");
        btn.setOnMouseEntered(e -> btn.setStyle(
                "-fx-background-color: " + hoverBg + ";"
                + "-fx-background-radius: 8;"
                + "-fx-effect: dropshadow(three-pass-box, " + accent + "88, 14, 0, 0, 3);"));
        btn.setOnMouseExited(e -> btn.setStyle(
                "-fx-background-color: " + accent + ";"
                + "-fx-background-radius: 8;"
                + "-fx-effect: dropshadow(three-pass-box, " + accent + "55, 10, 0, 0, 2);"));
    }

    private static void styleCancelButton(Button btn) {
        btn.setFont(Font.font("Segoe UI", FontWeight.NORMAL, 13));
        btn.setTextFill(javafx.scene.paint.Color.web(TEXT_SECONDARY));
        btn.setPadding(new Insets(9, 24, 9, 24));
        btn.setCursor(javafx.scene.Cursor.HAND);
        btn.setStyle(
                "-fx-background-color: transparent;"
                + "-fx-border-color: " + BORDER + ";"
                + "-fx-border-radius: 8;"
                + "-fx-background-radius: 8;"
                + "-fx-border-width: 1.5;");
        btn.setOnMouseEntered(e -> btn.setStyle(
                "-fx-background-color: #1a3050;"
                + "-fx-border-color: #3a6090;"
                + "-fx-border-radius: 8;"
                + "-fx-background-radius: 8;"
                + "-fx-border-width: 1.5;"
                + "-fx-text-fill: " + TEXT_PRIMARY + ";"));
        btn.setOnMouseExited(e -> btn.setStyle(
                "-fx-background-color: transparent;"
                + "-fx-border-color: " + BORDER + ";"
                + "-fx-border-radius: 8;"
                + "-fx-background-radius: 8;"
                + "-fx-border-width: 1.5;"));
    }

    // ── Helpers ──────────────────────────────────────────────────
    private static String accentFor(AlertType type) {
        return switch (type) {
            case WARNING   -> COLOR_WARNING;
            case ERROR     -> COLOR_ERROR;
            case INFO      -> COLOR_INFO;
            case SUCCESS   -> COLOR_SUCCESS;
            case EMERGENCY -> COLOR_EMERGENCY;
        };
    }

    private static String iconFor(AlertType type) {
        return switch (type) {
            case WARNING   -> "\u26A0";  // ⚠
            case ERROR     -> "\u2716";  // ✖
            case INFO      -> "\u2139";  // ℹ
            case SUCCESS   -> "\u2714";  // ✔
            case EMERGENCY -> "\u26D4";  // ⛔
        };
    }
}
