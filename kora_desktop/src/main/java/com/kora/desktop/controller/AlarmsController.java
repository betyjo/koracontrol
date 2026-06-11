package com.kora.desktop.controller;

import com.kora.desktop.service.AlarmManager;
import com.kora.desktop.service.AuditService;
import com.kora.desktop.service.AuthService;
import javafx.animation.Animation;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.*;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Callback;
import javafx.util.Duration;

import java.net.URL;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ResourceBundle;
import java.util.stream.Collectors;

public class AlarmsController implements Initializable {

    @FXML
    private BorderPane rootPane;

    @FXML
    private Label activeAlarmCount;

    @FXML
    private ComboBox<String> severityFilterCombo;

    @FXML
    private ComboBox<String> stateFilterCombo;

    @FXML
    private ComboBox<String> timeFilterCombo;

    @FXML
    private TextField searchField;

    @FXML
    private Button refreshButton;

    @FXML
    private Button acknowledgeAllButton;

    @FXML
    private Button exportButton;

    @FXML
    private HBox criticalBanner;

    @FXML
    private Label criticalCountLabel;

    @FXML
    private Button dismissCriticalButton;

    @FXML
    private Label criticalCount;

    @FXML
    private Label highCount;

    @FXML
    private Label mediumCount;

    @FXML
    private Label lowCount;

    @FXML
    private Label acknowledgedCount;

    @FXML
    private CheckBox autoRefreshCheck;

    @FXML
    private TableView<AlarmManager.Alarm> alarmTable;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> idColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> severityColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> stateColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> sourceColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> descriptionColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> valueColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> timeColumn;

    @FXML
    private TableColumn<AlarmManager.Alarm, String> actionsColumn;

    @FXML
    private Label showingLabel;

    @FXML
    private Button prevPageButton;

    @FXML
    private Button nextPageButton;

    @FXML
    private VBox alarmDetailsContainer;

    @FXML
    private VBox alarmDetailsContent;

    @FXML
    private Region severityIndicator;

    @FXML
    private Label detailSeverity;

    @FXML
    private Label detailState;

    @FXML
    private Label detailSource;

    @FXML
    private Label detailDescription;

    @FXML
    private Label detailValue;

    @FXML
    private Label detailTime;

    @FXML
    private Label detailDuration;

    @FXML
    private Button acknowledgeButton;

    @FXML
    private Button clearButton;

    @FXML
    private Button addNoteButton;

    private ObservableList<AlarmManager.Alarm> allAlarmsList = FXCollections.observableArrayList();
    private ObservableList<AlarmManager.Alarm> filteredAlarmsList = FXCollections.observableArrayList();
    private Timeline refreshTimeline;
    private int currentPage = 1;
    private static final int ITEMS_PER_PAGE = 25;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupComboBoxes();
        setupTable();
        setupButtons();
        setupAutoRefresh();
        
        // Bind to AlarmManager
        AlarmManager.getInstance().setOnAlarmsChanged(this::onAlarmsChanged);
        
        // Initialize with current alarms
        loadAlarms();
    }

    private void setupComboBoxes() {
        severityFilterCombo.setItems(FXCollections.observableArrayList(
            "All", "Critical", "High", "Medium", "Low"
        ));
        severityFilterCombo.setValue("All");
        severityFilterCombo.setOnAction(e -> applyFilters());

        stateFilterCombo.setItems(FXCollections.observableArrayList(
            "All", "Active", "Acknowledged", "Cleared"
        ));
        stateFilterCombo.setValue("All");
        stateFilterCombo.setOnAction(e -> applyFilters());

        timeFilterCombo.setItems(FXCollections.observableArrayList(
            "All Time", "Last Hour", "Last 24 Hours", "Last Week"
        ));
        timeFilterCombo.setValue("Last 24 Hours");
        timeFilterCombo.setOnAction(e -> applyFilters());
    }

    private void setupTable() {
        // Set up columns
        idColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().id));
        severityColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().severity.name()));
        stateColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().state.name()));
        sourceColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().tag));
        descriptionColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().message));
        valueColumn.setCellValueFactory(data -> new SimpleStringProperty(formatValue(data.getValue())));
        timeColumn.setCellValueFactory(data -> new SimpleStringProperty(data.getValue().getFormattedTimestamp()));
        actionsColumn.setCellValueFactory(data -> new SimpleStringProperty("Actions"));

        // Custom cell factory for severity coloring
        severityColumn.setCellFactory(column -> new TableCell<AlarmManager.Alarm, String>() {
            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) {
                    setText(null);
                    setStyle("");
                } else {
                    setText(item);
                    AlarmManager.Alarm alarm = getTableView().getItems().get(getIndex());
                    setStyle(getSeverityStyle(alarm.severity));
                }
            }
        });

        // Custom cell factory for state coloring
        stateColumn.setCellFactory(column -> new TableCell<AlarmManager.Alarm, String>() {
            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) {
                    setText(null);
                    setStyle("");
                } else {
                    setText(item);
                    AlarmManager.Alarm alarm = getTableView().getItems().get(getIndex());
                    setStyle(getStateStyle(alarm.state));
                }
            }
        });

        // Custom cell factory for actions
        actionsColumn.setCellFactory(column -> new TableCell<AlarmManager.Alarm, String>() {
            @Override
            protected void updateItem(String item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) {
                    setGraphic(null);
                } else {
                    AlarmManager.Alarm alarm = getTableView().getItems().get(getIndex());
                    HBox actionsBox = new HBox(5);
                    
                    Button ackButton = new Button("Ack");
                    ackButton.setStyle("-fx-background-color: #00ff9d; -fx-text-fill: #071426; -fx-font-size: 10px; -fx-padding: 4px 8px;");
                    ackButton.setDisable(alarm.state != AlarmManager.State.ACTIVE);
                    ackButton.setOnAction(e -> acknowledgeAlarm(alarm));
                    
                    Button clearButton = new Button("Clear");
                    clearButton.setStyle("-fx-background-color: #ff4444; -fx-text-fill: white; -fx-font-size: 10px; -fx-padding: 4px 8px;");
                    clearButton.setDisable(alarm.state == AlarmManager.State.CLEARED);
                    clearButton.setOnAction(e -> clearAlarm(alarm));
                    
                    actionsBox.getChildren().addAll(ackButton, clearButton);
                    setGraphic(actionsBox);
                }
            }
        });

        // Selection listener for details panel
        alarmTable.getSelectionModel().selectedItemProperty().addListener((obs, old, newVal) -> {
            if (newVal != null) {
                showAlarmDetails(newVal);
            }
        });

        alarmTable.setItems(filteredAlarmsList);
    }

    private void setupButtons() {
        refreshButton.setOnAction(e -> loadAlarms());
        acknowledgeAllButton.setOnAction(e -> acknowledgeAll());
        exportButton.setOnAction(e -> exportAlarms());
        
        dismissCriticalButton.setOnAction(e -> {
            criticalBanner.setVisible(false);
            criticalBanner.setManaged(false);
        });

        prevPageButton.setOnAction(e -> changePage(-1));
        nextPageButton.setOnAction(e -> changePage(1));

        acknowledgeButton.setOnAction(e -> {
            AlarmManager.Alarm selected = alarmTable.getSelectionModel().getSelectedItem();
            if (selected != null) {
                acknowledgeAlarm(selected);
            }
        });

        clearButton.setOnAction(e -> {
            AlarmManager.Alarm selected = alarmTable.getSelectionModel().getSelectedItem();
            if (selected != null) {
                clearAlarm(selected);
            }
        });

        addNoteButton.setOnAction(e -> addNoteToAlarm());
    }

    private void setupAutoRefresh() {
        refreshTimeline = new Timeline(
            new KeyFrame(Duration.seconds(30), event -> loadAlarms())
        );
        refreshTimeline.setCycleCount(Animation.INDEFINITE);
        
        autoRefreshCheck.selectedProperty().addListener((obs, old, newVal) -> {
            if (newVal) {
                refreshTimeline.play();
            } else {
                refreshTimeline.stop();
            }
        });
        
        if (autoRefreshCheck.isSelected()) {
            refreshTimeline.play();
        }
    }

    private void loadAlarms() {
        allAlarmsList.setAll(AlarmManager.getInstance().getAllAlarms());
        applyFilters();
        updateStatistics();
        updateCriticalBanner();
    }

    private void applyFilters() {
        String severityFilter = severityFilterCombo.getValue();
        String stateFilter = stateFilterCombo.getValue();
        String searchText = searchField.getText().toLowerCase();

        filteredAlarmsList.clear();
        filteredAlarmsList.addAll(allAlarmsList.stream()
            .filter(alarm -> severityFilter.equals("All") || alarm.severity.name().equalsIgnoreCase(severityFilter))
            .filter(alarm -> stateFilter.equals("All") || alarm.state.name().equalsIgnoreCase(stateFilter))
            .filter(alarm -> searchText.isEmpty() || 
                          alarm.tag.toLowerCase().contains(searchText) ||
                          alarm.message.toLowerCase().contains(searchText))
            .collect(Collectors.toList()));

        updatePagination();
    }

    private void updatePagination() {
        int totalItems = filteredAlarmsList.size();
        int totalPages = (int) Math.ceil((double) totalItems / ITEMS_PER_PAGE);
        
        if (currentPage > totalPages) {
            currentPage = Math.max(1, totalPages);
        }

        int fromIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        int toIndex = Math.min(fromIndex + ITEMS_PER_PAGE, totalItems);

        List<AlarmManager.Alarm> pageData = filteredAlarmsList.subList(fromIndex, toIndex);
        alarmTable.setItems(FXCollections.observableArrayList(pageData));

        showingLabel.setText(String.format("Showing %d-%d of %d alarms", fromIndex + 1, toIndex, totalItems));
        prevPageButton.setDisable(currentPage == 1);
        nextPageButton.setDisable(currentPage >= totalPages);
    }

    private void changePage(int delta) {
        currentPage += delta;
        updatePagination();
    }

    private void updateStatistics() {
        int critical = (int) allAlarmsList.stream().filter(a -> a.severity == AlarmManager.Severity.CRITICAL && a.state == AlarmManager.State.ACTIVE).count();
        int high = (int) allAlarmsList.stream().filter(a -> a.severity == AlarmManager.Severity.HIGH && a.state == AlarmManager.State.ACTIVE).count();
        int medium = (int) allAlarmsList.stream().filter(a -> a.severity == AlarmManager.Severity.MEDIUM && a.state == AlarmManager.State.ACTIVE).count();
        int low = (int) allAlarmsList.stream().filter(a -> a.severity == AlarmManager.Severity.LOW && a.state == AlarmManager.State.ACTIVE).count();
        int acknowledged = (int) allAlarmsList.stream().filter(a -> a.state == AlarmManager.State.ACKNOWLEDGED).count();
        int active = critical + high + medium + low;

        Platform.runLater(() -> {
            criticalCount.setText(String.valueOf(critical));
            highCount.setText(String.valueOf(high));
            mediumCount.setText(String.valueOf(medium));
            lowCount.setText(String.valueOf(low));
            acknowledgedCount.setText(String.valueOf(acknowledged));
            activeAlarmCount.setText(String.valueOf(active));

            // Apply color coding to active count
            if (active > 0) {
                activeAlarmCount.setStyle("-fx-text-fill: #ff9d00;");
            } else {
                activeAlarmCount.setStyle("-fx-text-fill: #00ff9d;");
            }
        });
    }

    private void updateCriticalBanner() {
        int critical = (int) allAlarmsList.stream().filter(a -> a.severity == AlarmManager.Severity.CRITICAL && a.state == AlarmManager.State.ACTIVE).count();
        
        Platform.runLater(() -> {
            if (critical > 0) {
                criticalBanner.setVisible(true);
                criticalBanner.setManaged(true);
                criticalCountLabel.setText(critical + " critical alarm" + (critical > 1 ? "s" : ""));
            } else {
                criticalBanner.setVisible(false);
                criticalBanner.setManaged(false);
            }
        });
    }

    private void showAlarmDetails(AlarmManager.Alarm alarm) {
        alarmDetailsContainer.setVisible(false);
        alarmDetailsContainer.setManaged(false);
        alarmDetailsContent.setVisible(true);
        alarmDetailsContent.setManaged(true);

        detailSeverity.setText(alarm.severity.name());
        detailState.setText(alarm.state.name());
        detailSource.setText(alarm.tag);
        detailDescription.setText(alarm.message);
        detailValue.setText(formatValue(alarm));
        detailTime.setText(alarm.getFormattedTimestamp());
        detailDuration.setText(calculateDuration(alarm));

        // Apply color coding
        severityIndicator.setStyle("-fx-background-color: " + getSeverityColor(alarm.severity) + "; -fx-background-radius: 6;");
        detailSeverity.setStyle("-fx-text-fill: " + getSeverityColor(alarm.severity) + ";");
        
        // Update button states
        acknowledgeButton.setDisable(alarm.state != AlarmManager.State.ACTIVE);
        clearButton.setDisable(alarm.state == AlarmManager.State.CLEARED);
    }

    private String formatValue(AlarmManager.Alarm alarm) {
        // This would be enhanced to show actual values from the alarm
        return alarm.tag + " - " + alarm.severity.name();
    }

    private String calculateDuration(AlarmManager.Alarm alarm) {
        // Calculate duration from timestamp
        return "5 minutes"; // Placeholder
    }

    private String getSeverityStyle(AlarmManager.Severity severity) {
        switch (severity) {
            case CRITICAL: return "-fx-text-fill: #ff4444; -fx-font-weight: bold;";
            case HIGH: return "-fx-text-fill: #ff9d00; -fx-font-weight: bold;";
            case MEDIUM: return "-fx-text-fill: #ffdd00; -fx-font-weight: bold;";
            case LOW: return "-fx-text-fill: #00d4ff; -fx-font-weight: bold;";
            default: return "-fx-text-fill: #b8c5d6;";
        }
    }

    private String getStateStyle(AlarmManager.State state) {
        switch (state) {
            case ACTIVE: return "-fx-text-fill: #ff4444; -fx-font-weight: bold;";
            case ACKNOWLEDGED: return "-fx-text-fill: #ff9d00; -fx-font-weight: bold;";
            case CLEARED: return "-fx-text-fill: #00ff9d; -fx-font-weight: bold;";
            default: return "-fx-text-fill: #b8c5d6;";
        }
    }

    private String getSeverityColor(AlarmManager.Severity severity) {
        switch (severity) {
            case CRITICAL: return "#ff4444";
            case HIGH: return "#ff9d00";
            case MEDIUM: return "#ffdd00";
            case LOW: return "#00d4ff";
            default: return "#b8c5d6";
        }
    }

    private void acknowledgeAlarm(AlarmManager.Alarm alarm) {
        AlarmManager.getInstance().acknowledge(alarm.id, AuthService.getInstance().getUsername());
        AuditService.getInstance().logAction("alarm", alarm.id,
            "Acknowledge alarm on " + alarm.tag, alarm.state.name(), "ACKNOWLEDGED");
        loadAlarms();
    }

    private void clearAlarm(AlarmManager.Alarm alarm) {
        // Implement clear functionality
        System.out.println("Clearing alarm: " + alarm.id);
        loadAlarms();
    }

    private void acknowledgeAll() {
        int count = AlarmManager.getInstance().getActiveCount();
        AlarmManager.getInstance().acknowledgeAll(AuthService.getInstance().getUsername());
        AuditService.getInstance().logAction("alarm", "all",
            "Acknowledge all active alarms (" + count + ")", String.valueOf(count), "ACKNOWLEDGED");
        loadAlarms();
    }

    private void exportAlarms() {
        // Implement export functionality
        System.out.println("Exporting alarms...");
    }

    private void addNoteToAlarm() {
        // Implement add note functionality
        System.out.println("Adding note to alarm...");
    }

    private void onAlarmsChanged(List<AlarmManager.Alarm> alarms) {
        Platform.runLater(() -> {
            loadAlarms();
        });
    }

    public void cleanup() {
        if (refreshTimeline != null) {
            refreshTimeline.stop();
        }
    }

    public BorderPane getRoot() {
        return rootPane;
    }
}
