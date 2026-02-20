module com.kora.desktop {
    requires javafx.controls;
    requires javafx.fxml;
    requires com.google.gson;
    requires java.net.http;

    opens com.kora.desktop to javafx.fxml;

    exports com.kora.desktop;
}
