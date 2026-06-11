package com.kora.desktop.main;

import com.kora.desktop.controller.AlarmsController;
import com.kora.desktop.controller.ControlPanelController;
import com.kora.desktop.controller.DashboardController;
import com.kora.desktop.controller.DiagnosticsController;
import com.kora.desktop.controller.MimicController;
import com.kora.desktop.controller.SettingsController;
import com.kora.desktop.controller.TrendsController;
import com.kora.desktop.service.AlarmManager;
import com.kora.desktop.service.AlarmSoundService;
import com.kora.desktop.service.DataService;
import com.kora.desktop.service.ShiftManager;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.fxml.Initializable;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.util.Duration;

import java.net.URL;
import java.util.List;
import java.util.ResourceBundle;

public class MainLayout implements Initializable {

    @FXML private BorderPane rootPane;
    @FXML private VBox sidebar;
    // Button shown when sidebar is collapsed to allow re-expansion
    private Button expandButton;
    @FXML private Label titleLabel;
    @FXML private Button dashboardBtn, mimicBtn, controlsBtn, alarmsBtn, trendsBtn, settingsBtn, logoutBtn;

    // Alarm banner
    @FXML private HBox alarmBanner;
    @FXML private Label alarmBannerIcon, alarmBannerText, alarmBannerCount;
    @FXML private Button hornSilenceBtn;

    // Tabs
    @FXML private TabPane tabPane;
    @FXML private Tab overviewTab, diagnosticsTab;

    // fx:include controller injection
    @FXML private DashboardController overviewDashboardController;
    @FXML private DiagnosticsController diagnosticsIncludeController;

    private Stage stage;
    private Runnable onLogout;
    private DataService dataService;

    // Sub-controllers (loaded via sidebar or fx:include)
    private DashboardController dashboardController;
    private DiagnosticsController diagnosticsController;
    private AlarmsController alarmsController;
    private TrendsController trendsController;
    private MimicController mimicController;
    private ControlPanelController controlPanelController;

    private boolean silenced = false; // kept for backward compat
    private BorderPane root;
    private Timeline bannerTimeline;
    private javafx.scene.Node originalDashboardContent; // Save the original dashboard container to restore when needed

    public MainLayout(Stage stage, Runnable onLogout) {
        this.stage = stage;
        this.onLogout = onLogout;
        loadFXML();
    }

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        // The fx:include dashboard controller IS the dashboard controller
        dashboardController = overviewDashboardController;
        // Add click handler to toggle sidebar collapse/expand
        if (titleLabel != null) {
            titleLabel.setOnMouseClicked(e -> toggleSidebar());
        }
        // Create expand button (hidden initially)
        expandButton = new Button("☰");
        expandButton.setStyle("-fx-background-color: transparent; -fx-text-fill: #00ff9d; -fx-font-size: 18px; -fx-cursor: hand;");
        expandButton.setOnMouseClicked(e -> toggleSidebar());
        expandButton.setVisible(false);
        expandButton.setManaged(false);
        // Ensure it's not added to the layout now; will be set as left when collapsed

        // Wire DataService from dashboard (it creates its own)
        setupDataService();

        // Setup sidebar button handlers
        setupButtonHandlers();

        // Setup alarm banner
        setupAlarmBanner();

        // Setup DiagnosticsController with DataService
        setupDiagnosticsController();
        
        // Save the original dashboard content (VBox with alarm banner and TabPane)
        // This allows us to restore it if it's been replaced by other pages
        originalDashboardContent = rootPane.getCenter();

        // Wire tab switching to update sidebar active state
        tabPane.getSelectionModel().selectedItemProperty().addListener((obs, oldTab, newTab) -> {
            if (newTab == overviewTab) {
                setActiveButton(dashboardBtn);
            }
        });
    }

    private void setupDataService() {
        // Try to get DataService reference from DashboardController
        if (dashboardController != null) {
            try {
                var field = DashboardController.class.getDeclaredField("dataService");
                field.setAccessible(true);
                dataService = (DataService) field.get(dashboardController);
            } catch (Exception e) {
                dataService = new DataService();
                dataService.startMqttClient();
            }
        } else {
            dataService = new DataService();
            dataService.startMqttClient();
        }
    }

    private void setupDiagnosticsController() {
        // DiagnosticsController is injected via fx:include
        diagnosticsController = diagnosticsIncludeController;
        if (diagnosticsController != null && dataService != null) {
            diagnosticsController.setDataService(dataService);
        }
    }


    private void setupAlarmBanner() {
        AlarmManager.getInstance().setOnAlarmsChanged(this::updateAlarmBanner);

        // Start alarm sound service
        AlarmSoundService.getInstance().start();

        // Start shift tracking
        ShiftManager.getInstance().logEvent("SYSTEM", "KORA SCADA Desktop started");

        // Click banner to navigate to alarms view
        alarmBanner.setOnMouseClicked(e -> {
            setActiveButton(alarmsBtn);
            showAlarms();
        });

        // Horn silence button (delegates to AlarmSoundService)
        hornSilenceBtn.setOnAction(e -> {
            boolean nowSilenced = AlarmSoundService.getInstance().toggleSilence();
            hornSilenceBtn.setText(nowSilenced ? "\uD83D\uDD07 MUTED" : "SILENCE");
            if (nowSilenced) {
                alarmBanner.getStyleClass().remove("alarm-banner-critical");
            }
        });

        // Periodic alarm check (every 3 seconds)
        bannerTimeline = new Timeline(new KeyFrame(Duration.seconds(3), e -> {
            AlarmManager am = AlarmManager.getInstance();
            updateAlarmBanner(am.getAllAlarms());
        }));
        bannerTimeline.setCycleCount(Timeline.INDEFINITE);
        bannerTimeline.play();

        // Initial update
        updateAlarmBanner(AlarmManager.getInstance().getAllAlarms());
    }

    private void updateAlarmBanner(List<AlarmManager.Alarm> alarms) {
        long activeCount = alarms.stream().filter(a -> a.state == AlarmManager.State.ACTIVE).count();
        alarmBannerCount.setText(activeCount + " active");

        if (activeCount == 0) {
            alarmBannerText.setText("No active alarms");
            alarmBannerText.setStyle("-fx-text-fill: #b8c5d6; -fx-font-size: 13px;");
            alarmBannerIcon.setText("🔔");
            alarmBanner.getStyleClass().removeAll("alarm-banner-critical", "alarm-banner-high");
            alarmBanner.getStyleClass().add("alarm-banner");
        } else {
            alarmBanner.getStyleClass().removeAll("alarm-banner-critical", "alarm-banner-high");

            AlarmManager.Alarm latest = alarms.stream()
                    .filter(a -> a.state == AlarmManager.State.ACTIVE)
                    .findFirst().orElse(null);

            if (latest != null) {
                String msg = latest.severity + " | " + latest.tag + " — " + latest.message;
                alarmBannerText.setText(msg);

                if (latest.severity == AlarmManager.Severity.CRITICAL) {
                    alarmBannerText.setStyle("-fx-text-fill: #ff4444; -fx-font-size: 13px; -fx-font-weight: bold;");
                    alarmBannerIcon.setText("⚠️");
                    if (!silenced) alarmBanner.getStyleClass().add("alarm-banner-critical");
                } else if (latest.severity == AlarmManager.Severity.HIGH) {
                    alarmBannerText.setStyle("-fx-text-fill: #ff9d00; -fx-font-size: 13px; -fx-font-weight: bold;");
                    alarmBannerIcon.setText("⚡");
                    alarmBanner.getStyleClass().add("alarm-banner-high");
                } else {
                    alarmBannerText.setStyle("-fx-text-fill: #ffdd00; -fx-font-size: 13px;");
                    alarmBannerIcon.setText("ℹ️");
                }
            }
        }
    }

    private void loadFXML() {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource("/ui/main_layout.fxml"));
            loader.setController(this);
            root = loader.load();
        } catch (Exception e) {
            e.printStackTrace();
            createFallbackLayout();
        }
    }

    private void createFallbackLayout() {
        root = new BorderPane();
        root.setStyle("-fx-background-color: #121212;");

        VBox fallbackSidebar = new VBox(10);
        fallbackSidebar.setPadding(new javafx.geometry.Insets(20));
        fallbackSidebar.setStyle("-fx-background-color: #1a1a1a; -fx-min-width: 200px;");

        Label titleLbl = new Label("KORA CONTROL");
        titleLbl.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: #00ff9d; -fx-padding: 10px 0;");

        dashboardBtn = new Button("Dashboard");
        dashboardBtn.setStyle("-fx-background-color: #00ff9d; -fx-text-fill: #121212; -fx-font-weight: bold; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
        dashboardBtn.setMaxWidth(Double.MAX_VALUE);

        alarmsBtn = new Button("Alarms");
        alarmsBtn.setStyle("-fx-background-color: transparent; -fx-text-fill: white; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
        alarmsBtn.setMaxWidth(Double.MAX_VALUE);

        trendsBtn = new Button("Trends");
        trendsBtn.setStyle("-fx-background-color: transparent; -fx-text-fill: white; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
        trendsBtn.setMaxWidth(Double.MAX_VALUE);

        settingsBtn = new Button("Settings");
        settingsBtn.setStyle("-fx-background-color: transparent; -fx-text-fill: white; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
        settingsBtn.setMaxWidth(Double.MAX_VALUE);

        logoutBtn = new Button("LOGOUT");
        logoutBtn.setStyle("-fx-background-color: #ff4444; -fx-text-fill: white; -fx-font-weight: bold; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
        logoutBtn.setMaxWidth(Double.MAX_VALUE);

        fallbackSidebar.getChildren().addAll(titleLbl, dashboardBtn, alarmsBtn, trendsBtn, settingsBtn, logoutBtn);
        root.setLeft(fallbackSidebar);

        dashboardBtn.setOnAction(e -> showDashboard());
        alarmsBtn.setOnAction(e -> showAlarms());
        trendsBtn.setOnAction(e -> showTrends());
        settingsBtn.setOnAction(e -> showSettings());
        logoutBtn.setOnAction(e -> { if (onLogout != null) onLogout.run(); });
    }

    private void setupButtonHandlers() {
        if (dashboardBtn != null) dashboardBtn.setOnAction(e -> {
            setActiveButton(dashboardBtn);
            showDashboard();
        });
        if (mimicBtn != null) mimicBtn.setOnAction(e -> {
            setActiveButton(mimicBtn);
            showMimic();
        });
        if (controlsBtn != null) controlsBtn.setOnAction(e -> {
            setActiveButton(controlsBtn);
            showControlPanel();
        });
        if (alarmsBtn != null) alarmsBtn.setOnAction(e -> {
            setActiveButton(alarmsBtn);
            showAlarms();
        });
        if (trendsBtn != null) trendsBtn.setOnAction(e -> {
            setActiveButton(trendsBtn);
            showTrends();
        });
        if (settingsBtn != null) settingsBtn.setOnAction(e -> {
            setActiveButton(settingsBtn);
            showSettings();
        });
        if (logoutBtn != null) logoutBtn.setOnAction(e -> {
            if (onLogout != null) onLogout.run();
        });
    }

    private void showDashboard() {
        // Restore the original dashboard content if it's been replaced by another view
        if (rootPane.getCenter() != originalDashboardContent) {
            rootPane.setCenter(originalDashboardContent);
        }
        // Switch to overview tab (which contains the dashboard via fx:include)
        if (tabPane != null) {
            tabPane.getSelectionModel().select(overviewTab);
        }
    }

    private void showMimic() {
        loadView("/ui/mimic.fxml", () -> {
            mimicController = new MimicController();
            return mimicController;
        }, "Mimic");
    }

    private void showControlPanel() {
        loadView("/ui/control_panel.fxml", () -> {
            controlPanelController = new ControlPanelController();
            return controlPanelController;
        }, "Control Panel");
    }

    private void showAlarms() {
        loadView("/ui/alarms.fxml", () -> {
            alarmsController = new AlarmsController();
            return alarmsController;
        }, "Alarms");
    }

    private void showTrends() {
        loadView("/ui/charts.fxml", () -> {
            trendsController = new TrendsController();
            return trendsController;
        }, "Trends");
    }

    private void showSettings() {
        try {
            VBox settingsView = new VBox();
            SettingsController settingsController = new SettingsController();
            settingsController.setRootContainer(settingsView);
            settingsController.initSettings();
            rootPane.setCenter(settingsView);
            ensureStylesheet();
        } catch (Exception e) {
            e.printStackTrace();
            rootPane.setCenter(errorLabel("Settings", e));
        }
    }

    private void loadView(String fxmlPath, java.util.function.Supplier<Object> controllerFactory, String name) {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource(fxmlPath));
            Object controller = controllerFactory.get();
            loader.setController(controller);
            Parent view = loader.load();
            rootPane.setCenter(view);
            ensureStylesheet();
        } catch (Exception e) {
            e.printStackTrace();
            rootPane.setCenter(errorLabel(name, e));
        }
    }

    private Label errorLabel(String page, Exception e) {
        String message = e.getMessage();
        if (e.getCause() != null && e.getCause().getMessage() != null) {
            message = e.getCause().getMessage();
        }
        Label label = new Label(page + " failed to load: " + message);
        label.setWrapText(true);
        label.setStyle("-fx-text-fill: #ff4444; -fx-padding: 20; -fx-font-size: 14px;");
        return label;
    }

    private void setActiveButton(Button activeButton) {
        String inactiveStyle = "-fx-background-color: transparent; -fx-text-fill: white; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;";
        if (dashboardBtn != null) dashboardBtn.setStyle(inactiveStyle);
        if (mimicBtn != null) mimicBtn.setStyle(inactiveStyle);
        if (controlsBtn != null) controlsBtn.setStyle(inactiveStyle);
        if (alarmsBtn != null) alarmsBtn.setStyle(inactiveStyle);
        if (trendsBtn != null) trendsBtn.setStyle(inactiveStyle);
        if (settingsBtn != null) settingsBtn.setStyle(inactiveStyle);

        activeButton.setStyle("-fx-background-color: #00ff9d; -fx-text-fill: #121212; -fx-font-weight: bold; -fx-padding: 10px 20px; -fx-cursor: hand; -fx-background-radius: 5;");
    }

    private void ensureStylesheet() {
        if (stage == null || stage.getScene() == null) return;
        var stylesheet = getClass().getResource("/style.css");
        if (stylesheet == null) return;
        String css = stylesheet.toExternalForm();
        if (!stage.getScene().getStylesheets().contains(css)) {
            stage.getScene().getStylesheets().add(css);
        }
    }
    // Flag to track sidebar state
    private boolean sidebarCollapsed = false;

    // Toggle the visibility of the sidebar when the title label or expand button is clicked
    private void toggleSidebar() {
        if (sidebar == null) return;
        if (!sidebarCollapsed) {
            // Collapse sidebar: replace with expandButton
            rootPane.setLeft(expandButton);
            expandButton.setManaged(true);
            expandButton.setVisible(true);
            sidebar.setManaged(false);
            sidebar.setVisible(false);
            sidebarCollapsed = true;
        } else {
            // Expand sidebar: restore original sidebar
            rootPane.setLeft(sidebar);
            sidebar.setManaged(true);
            sidebar.setVisible(true);
            expandButton.setManaged(false);
            expandButton.setVisible(false);
            sidebarCollapsed = false;
        }
        rootPane.requestLayout();
    }


    public BorderPane getRoot() {
        return root;
    }

    public TabPane getTabPane() {
        return tabPane;
    }

    public DataService getDataService() {
        return dataService;
    }

    public void cleanup() {
        if (bannerTimeline != null) bannerTimeline.stop();
        if (dashboardController != null) dashboardController.cleanup();
        if (diagnosticsController != null) diagnosticsController.cleanup();
        if (alarmsController != null) alarmsController.cleanup();
        if (trendsController != null) trendsController.cleanup();
        if (mimicController != null) mimicController.cleanup();
        if (controlPanelController != null) controlPanelController.cleanup();
    }
}
