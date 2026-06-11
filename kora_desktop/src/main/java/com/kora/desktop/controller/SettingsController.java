package com.kora.desktop.controller;

import com.kora.desktop.service.AuthService;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.*;

public class SettingsController {
    private VBox rootContainer;

    public void setRootContainer(VBox rootContainer) {
        this.rootContainer = rootContainer;
    }

    public void initSettings() {
        rootContainer.setStyle("-fx-background-color: #121212;");
        rootContainer.setPadding(new Insets(20));
        rootContainer.setSpacing(16);

        Label title = new Label("SYSTEM SETTINGS");
        title.setStyle("-fx-font-size: 16px; -fx-font-weight: bold; -fx-text-fill: #ffffff; -fx-letter-spacing: 3px;");
        rootContainer.getChildren().add(title);

        TabPane tabPane = new TabPane();
        tabPane.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);
        tabPane.getStyleClass().add("tab-pane");
        VBox.setVgrow(tabPane, Priority.ALWAYS);

        Tab connTab = new Tab("Connection");
        connTab.setContent(buildConnectionTab());

        Tab rolesTab = new Tab("Roles & Permissions");
        rolesTab.setContent(buildRolesTab());

        Tab dispTab = new Tab("Display");
        dispTab.setContent(buildDisplayTab());

        Tab aboutTab = new Tab("About");
        aboutTab.setContent(buildAboutTab());

        tabPane.getTabs().addAll(connTab, rolesTab, dispTab, aboutTab);
        rootContainer.getChildren().add(tabPane);
    }

    private VBox buildConnectionTab() {
        VBox box = new VBox(15);
        box.setPadding(new Insets(20));
        box.setStyle("-fx-background-color: #0d2038;");

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(15);

        Label mqttLbl = new Label("MQTT Broker:");
        mqttLbl.getStyleClass().add("label-text");
        TextField mqttField = new TextField("tcp://localhost:1883");
        mqttField.getStyleClass().add("text-field-dark");

        Label apiLbl = new Label("Auth API:");
        apiLbl.getStyleClass().add("label-text");
        TextField apiField = new TextField("http://127.0.0.1:8000/api/auth/");
        apiField.getStyleClass().add("text-field-dark");

        Button saveBtn = new Button("SAVE CONNECTION");
        saveBtn.getStyleClass().add("button-primary");

        grid.add(mqttLbl, 0, 0);
        grid.add(mqttField, 1, 0);
        grid.add(apiLbl, 0, 1);
        grid.add(apiField, 1, 1);
        grid.add(saveBtn, 1, 2);

        box.getChildren().add(grid);
        return box;
    }

    private VBox buildRolesTab() {
        VBox box = new VBox(15);
        box.setPadding(new Insets(20));
        box.setStyle("-fx-background-color: #0d2038;");

        AuthService auth = AuthService.getInstance();
        String currentRole = auth.getCurrentRole() != null ? auth.getCurrentRole().name() : "NONE";
        String username = auth.getUsername() != null ? auth.getUsername() : "Guest";

        Label userLbl = new Label("Logged in as: " + username + " (" + currentRole + ")");
        userLbl.setStyle("-fx-text-fill: #00ff9d; -fx-font-weight: bold; -fx-font-size: 14px;");

        Label matrixLbl = new Label("Permission Matrix:");
        matrixLbl.getStyleClass().add("title-text");

        TableView<PermRow> table = new TableView<>();
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_ALL_COLUMNS);
        table.getStyleClass().add("table-view");
        
        TableColumn<PermRow, String> actionCol = new TableColumn<>("Action");
        actionCol.setCellValueFactory(data -> new javafx.beans.property.SimpleStringProperty(data.getValue().action));
        
        TableColumn<PermRow, String> adminCol = new TableColumn<>("ADMIN");
        adminCol.setCellValueFactory(data -> new javafx.beans.property.SimpleStringProperty(data.getValue().admin ? "✔" : "✘"));
        
        TableColumn<PermRow, String> opCol = new TableColumn<>("OPERATOR");
        opCol.setCellValueFactory(data -> new javafx.beans.property.SimpleStringProperty(data.getValue().operator ? "✔" : "✘"));
        
        TableColumn<PermRow, String> userCol = new TableColumn<>("USER");
        userCol.setCellValueFactory(data -> new javafx.beans.property.SimpleStringProperty(data.getValue().user ? "✔" : "✘"));

        table.getColumns().addAll(actionCol, adminCol, opCol, userCol);

        table.getItems().addAll(
            new PermRow("View Dashboard", true, true, true),
            new PermRow("View Trends", true, true, true),
            new PermRow("View Alarms", true, true, false),
            new PermRow("Ack Alarms", true, true, false),
            new PermRow("Manual Override", true, false, false),
            new PermRow("Edit Settings", true, false, false)
        );

        box.getChildren().addAll(userLbl, matrixLbl, table);
        return box;
    }

    private VBox buildDisplayTab() {
        VBox box = new VBox(15);
        box.setPadding(new Insets(20));
        box.setStyle("-fx-background-color: #0d2038;");

        CheckBox darkTheme = new CheckBox("Dark Theme");
        darkTheme.setSelected(true);
        darkTheme.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 14px;");

        CheckBox highContrast = new CheckBox("High Contrast Mode");
        highContrast.setStyle("-fx-text-fill: #ffffff; -fx-font-size: 14px;");

        box.getChildren().addAll(darkTheme, highContrast);
        return box;
    }

    private VBox buildAboutTab() {
        VBox box = new VBox(15);
        box.setPadding(new Insets(20));
        box.setStyle("-fx-background-color: #0d2038;");

        Label appName = new Label("Kora Desktop SCADA");
        appName.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: #00d4ff;");

        Label version = new Label("Version: 2.0.0");
        version.getStyleClass().add("label-text");

        Label builtBy = new Label("Built by: Kora Control Water Industry Systems");
        builtBy.getStyleClass().add("label-text");

        box.getChildren().addAll(appName, version, builtBy);
        return box;
    }

    public static class PermRow {
        public String action;
        public boolean admin;
        public boolean operator;
        public boolean user;

        public PermRow(String action, boolean admin, boolean operator, boolean user) {
            this.action = action;
            this.admin = admin;
            this.operator = operator;
            this.user = user;
        }
    }
}
