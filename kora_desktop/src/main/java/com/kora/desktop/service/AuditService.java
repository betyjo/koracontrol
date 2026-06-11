package com.kora.desktop.service;

import com.google.gson.JsonObject;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * Singleton audit service that records all operator actions locally
 * and periodically syncs them to the backend API.
 */
public class AuditService {

    public static class AuditEntry {
        public final String id;
        public final String user;
        public final String actionType;
        public final String target;
        public final String description;
        public final String oldValue;
        public final String newValue;
        public final LocalDateTime timestamp;
        public boolean synced;

        public AuditEntry(String user, String actionType, String target, String description, String oldValue, String newValue) {
            this.id = java.util.UUID.randomUUID().toString();
            this.user = user;
            this.actionType = actionType;
            this.target = target;
            this.description = description;
            this.oldValue = oldValue != null ? oldValue : "";
            this.newValue = newValue != null ? newValue : "";
            this.timestamp = LocalDateTime.now();
            this.synced = false;
        }

        public String getFormattedTimestamp() {
            return timestamp.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        }
    }

    private static AuditService instance;
    private final CopyOnWriteArrayList<AuditEntry> entries = new CopyOnWriteArrayList<>();
    private Consumer<List<AuditEntry>> onEntriesChanged;
    private static final int MAX_LOCAL_ENTRIES = 1000;
    private static final String API_BASE = "http://127.0.0.1:8000/api";

    private AuditService() {}

    public static AuditService getInstance() {
        if (instance == null) {
            instance = new AuditService();
        }
        return instance;
    }

    public void setOnEntriesChanged(Consumer<List<AuditEntry>> callback) {
        this.onEntriesChanged = callback;
    }

    /**
     * Log an operator action.
     *
     * @param actionType  One of: control, setpoint, alarm, override
     * @param target      Target identifier (tag name, alarm id, etc.)
     * @param description Human-readable description
     * @param oldValue    Previous value (if applicable)
     * @param newValue    New value (if applicable)
     */
    public void logAction(String actionType, String target, String description, String oldValue, String newValue) {
        String user = "unknown";
        AuthService auth = AuthService.getInstance();
        if (auth.isLoggedIn() && auth.getUsername() != null) {
            user = auth.getUsername();
        }

        AuditEntry entry = new AuditEntry(user, actionType, target, description, oldValue, newValue);
        entries.add(0, entry);

        // Trim old entries
        while (entries.size() > MAX_LOCAL_ENTRIES) {
            entries.remove(entries.size() - 1);
        }

        // Notify UI
        if (onEntriesChanged != null) {
            onEntriesChanged.accept(getEntries());
        }

        // Attempt async sync to backend
        syncEntryAsync(entry);
    }

    // Convenience overloads
    public void logAction(String actionType, String target, String description) {
        logAction(actionType, target, description, "", "");
    }

    public void logAction(String actionType, String target, String description, String newValue) {
        logAction(actionType, target, description, "", newValue);
    }

    public List<AuditEntry> getEntries() {
        return Collections.unmodifiableList(new ArrayList<>(entries));
    }

    public int getUnsyncedCount() {
        return (int) entries.stream().filter(e -> !e.synced).count();
    }

    /**
     * Attempt to sync a single audit entry to the backend in a background thread.
     */
    private void syncEntryAsync(AuditEntry entry) {
        Thread.ofVirtual().start(() -> {
            try {
                AuthService auth = AuthService.getInstance();
                if (!auth.isLoggedIn() || "demo-token".equals(auth.getAccessToken())) {
                    return; // Skip sync for offline/demo mode
                }

                try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
                    HttpPost request = new HttpPost(API_BASE + "/audit/operator-actions/");
                    request.setHeader("Authorization", "Bearer " + auth.getAccessToken());

                    JsonObject json = new JsonObject();
                    json.addProperty("action_type", entry.actionType);
                    json.addProperty("description", entry.description);
                    json.addProperty("old_value", entry.oldValue);
                    json.addProperty("new_value", entry.newValue);

                    StringEntity entity = new StringEntity(json.toString(), ContentType.APPLICATION_JSON);
                    request.setEntity(entity);

                    try (CloseableHttpResponse response = httpClient.execute(request)) {
                        int code = response.getCode();
                        EntityUtils.consume(response.getEntity());
                        if (code == 200 || code == 201) {
                            entry.synced = true;
                        }
                    }
                }
            } catch (Exception e) {
                // Silently ignore sync failures — entry stays local
            }
        });
    }
}
