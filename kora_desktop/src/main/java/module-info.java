module com.kora.desktop {
    requires javafx.controls;
    requires javafx.fxml;
    requires javafx.graphics;
    requires javafx.swing;
    requires com.google.gson;
    requires org.eclipse.paho.client.mqttv3;
    requires java.net.http;
    requires org.apache.httpcomponents.client5.httpclient5;
    requires org.apache.httpcomponents.core5.httpcore5;
    requires java.desktop;
    requires webcam.capture;

    opens com.kora.desktop.controller to javafx.fxml;
    opens com.kora.desktop.model to javafx.fxml;
    opens com.kora.desktop.service to javafx.fxml;
    opens com.kora.desktop.device to javafx.fxml;
    opens com.kora.desktop.main to javafx.fxml;
    opens com.kora.desktop.ui.faceplate to javafx.fxml;

    exports com.kora.desktop.controller;
    exports com.kora.desktop.model;
    exports com.kora.desktop.service;
    exports com.kora.desktop.device;
    exports com.kora.desktop.main;
    exports com.kora.desktop.ui.faceplate;
}
