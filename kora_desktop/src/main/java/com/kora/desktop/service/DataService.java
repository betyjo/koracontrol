package com.kora.desktop.service;

import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.kora.desktop.device.TagEngine;

import javafx.application.Platform;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public class DataService {
    private MqttClient client;
    private Consumer<JsonObject> dataCallback; // Keep for legacy compatibility if needed
    private Consumer<JsonObject> aiAlertCallback; // AI alert callback for integration
    private final AtomicLong messageCount = new AtomicLong(0);
    private final AtomicLong reconnectCount = new AtomicLong(0);
    private volatile boolean connected = false;

    public void setDataCallback(Consumer<JsonObject> callback) {
        this.dataCallback = callback;
    }
    
    public void setAIAlertCallback(Consumer<JsonObject> callback) {
        this.aiAlertCallback = callback;
    }

    public void startMqttClient() {
        try {
            MemoryPersistence persistence = new MemoryPersistence();
            client = new MqttClient("tcp://localhost:1883", MqttClient.generateClientId(), persistence);
            client.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    System.out.println("MQTT Connection lost!");
                    connected = false;
                    reconnectCount.incrementAndGet();
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) throws Exception {
                    try {
                        String payload = new String(message.getPayload());
                        JsonObject json = JsonParser.parseString(payload).getAsJsonObject();
                        
                        // Handle AI analysis messages
                        if (topic.equals("kora/ai/analysis") || topic.equals("kora/ai/alerts")) {
                            // Run AI alerts on JavaFX Application Thread
                            Platform.runLater(() -> {
                                handleAIAlert(json);
                                if (aiAlertCallback != null) {
                                    aiAlertCallback.accept(json);
                                }
                            });
                        } else {
                            messageCount.incrementAndGet();
                            // Run UI/Engine updates on the JavaFX Application Thread
                            Platform.runLater(() -> {
                                updateTagEngine(json);
                                if (dataCallback != null) {
                                    dataCallback.accept(json);
                                }
                            });
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                }
            });

            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            client.connect(options);
            client.subscribe("kora/sensor/data"); // Standardized sensor data topic
            client.subscribe("kora/scada/tags"); // Standardized SCADA tags topic
            client.subscribe("kora/alarm/notifications"); // Standardized alarm notifications topic
            client.subscribe("kora/ai/analysis"); // AI analysis results topic
            client.subscribe("kora/ai/alerts"); // AI critical alerts topic
            System.out.println("✅ Connected to local MQTT broker in JavaFX.");
            connected = true;

        } catch (MqttException e) {
            System.err.println("❌ Could not connect to MQTT: " + e.getMessage());
        }
    }

    private void handleAIAlert(JsonObject aiData) {
        try {
            String type = aiData.has("type") ? aiData.get("type").getAsString() : "unknown";
            String source = aiData.has("source") ? aiData.get("source").getAsString() : "unknown";
            String message = aiData.has("message") ? aiData.get("message").getAsString() : "No message";
            boolean isAnomaly = aiData.has("is_anomaly") && aiData.get("is_anomaly").getAsBoolean();
            double confidence = aiData.has("confidence") ? aiData.get("confidence").getAsDouble() : 0.0;
            
            if (isAnomaly) {
                System.out.println("🤖 AI ANOMALY DETECTED: " + message);
                System.out.println("   Source: " + source);
                System.out.println("   Confidence: " + confidence);
                
                // Update TagEngine with AI anomaly status
                TagEngine engine = TagEngine.getInstance();
                engine.setTag("ai_anomaly_detected", true);
                engine.setTag("ai_anomaly_confidence", confidence);
                engine.setTag("ai_anomaly_message", message);
                
                // Raise AI anomaly critical alarm in AlarmManager
                AlarmManager.getInstance().raiseAlarm("backend_ai", "AI Anomaly: " + message + " (Confidence: " + confidence + ")", AlarmManager.Severity.CRITICAL);
            } else {
                // Update TagEngine with normal status
                TagEngine engine = TagEngine.getInstance();
                engine.setTag("ai_anomaly_detected", false);
                engine.setTag("ai_anomaly_confidence", confidence);
                
                // Clear the AI anomaly alarm in AlarmManager
                AlarmManager.getInstance().clearAlarm("backend_ai");
            }
        } catch (Exception e) {
            System.err.println("❌ Error processing AI alert: " + e.getMessage());
        }
    }

    private void updateTagEngine(JsonObject data) {
        TagEngine engine = TagEngine.getInstance();
        
        // Handle new style tags
        for (String key : data.keySet()) {
            try {
                if (data.get(key).isJsonPrimitive() && data.get(key).getAsJsonPrimitive().isNumber()) {
                    engine.setTag(key, data.get(key).getAsDouble());
                } else if (data.get(key).isJsonPrimitive() && data.get(key).getAsJsonPrimitive().isBoolean()) {
                    engine.setTag(key, data.get(key).getAsBoolean());
                }
            } catch (Exception ignored) {}
        }

        // Handle legacy format mapping
        if (data.has("tank_level")) {
            engine.setTag("tank_a_level", data.get("tank_level").getAsDouble());
        }
        if (data.has("pump_status")) {
            engine.setTag("pump_1_running", "ON".equals(data.get("pump_status").getAsString()));
        }
        if (data.has("valve_status")) {
            engine.setTag("valve_inlet", "OPEN".equals(data.get("valve_status").getAsString()));
        }
        if (data.has("flow_rate")) {
            engine.setTag("flow_rate", data.get("flow_rate").getAsDouble());
        }
        if (data.has("pressure")) {
            engine.setTag("pressure", data.get("pressure").getAsDouble());
        }
        
        // Evaluate limit thresholds and trigger alarms in real-time
        AlarmManager.getInstance().checkTagConditions();
    }

    public void sendEmergencyStop() {
        if (client != null && client.isConnected()) {
            try {
                MqttMessage msg = new MqttMessage("{\"command\": \"STOP\"}".getBytes());
                client.publish("kora/command/emergency", msg); // Standardized emergency topic
                TagEngine.getInstance().setTag("pump_1_running", false);
                TagEngine.getInstance().setTag("pump_2_running", false);
            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
    }

    public void sendTogglePump(boolean turnOn) {
        if (client != null && client.isConnected()) {
            try {
                String cmd = turnOn ? "START" : "STOP";
                MqttMessage msg = new MqttMessage(("{\"command\": \"" + cmd + "\"}").getBytes());
                client.publish("kora/command/pump", msg); // Standardized pump command topic
            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
    }

    public void sendToggleValve(boolean open) {
        if (client != null && client.isConnected()) {
            try {
                String cmd = open ? "OPEN" : "CLOSE";
                MqttMessage msg = new MqttMessage(("{\"command\": \"" + cmd + "\"}").getBytes());
                client.publish("kora/command/valve", msg); // Standardized valve command topic
            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
    }

    public void sendSetpointChange(String tag, double value, String mode) {
        if (client != null && client.isConnected()) {
            try {
                JsonObject json = new JsonObject();
                json.addProperty("tag", tag);
                json.addProperty("value", value);
                json.addProperty("mode", mode);
                json.addProperty("command", "SETPOINT");
                MqttMessage msg = new MqttMessage(json.toString().getBytes());
                client.publish("kora/command/setpoint", msg);
            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
        // Optimistic UI update
        TagEngine.getInstance().setTag(tag, value);
    }

    // ── MQTT stats accessors ──
    public boolean isConnected() {
        return connected && client != null && client.isConnected();
    }

    public long getMessageCount() {
        return messageCount.get();
    }

    public long getReconnectCount() {
        return reconnectCount.get();
    }

    public void sendSetTag(String tag, Object value) {
        if (client != null && client.isConnected()) {
            try {
                JsonObject json = new JsonObject();
                if (value instanceof Number) {
                    json.addProperty(tag, (Number) value);
                } else if (value instanceof Boolean) {
                    json.addProperty(tag, (Boolean) value);
                } else {
                    json.addProperty(tag, value.toString());
                }
                MqttMessage msg = new MqttMessage(json.toString().getBytes());
                client.publish("kora/command/set_tag", msg); // Standardized tag command topic
            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
        // Optimistic UI update
        if (value instanceof Number) {
            TagEngine.getInstance().setTag(tag, ((Number) value).doubleValue());
        } else if (value instanceof Boolean) {
            TagEngine.getInstance().setTag(tag, (Boolean) value);
        }
    }
}
