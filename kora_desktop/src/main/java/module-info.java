module com.kora.desktop {
    requires javafx.controls;
    requires javafx.fxml;
    requires com.google.gson;

    opens com.kora.desktop to javafx.fxml;

    exports com.kora.desktop;
}
