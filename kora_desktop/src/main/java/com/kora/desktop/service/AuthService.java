package com.kora.desktop.service;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class AuthService {

    public enum Role {
        ADMIN, OPERATOR, USER
    }

    public enum LoginResult {
        SUCCESS, INVALID_CREDENTIALS, ACCESS_DENIED, CONNECTION_ERROR, SERVER_ERROR
    }

    private static final String API_BASE = "http://127.0.0.1:8000/api";
    private static final String LOGIN_URL = API_BASE + "/auth/login/";
    private static final String BIOMETRIC_URL = API_BASE + "/auth/biometric-login/";
    private String accessToken;
    private String refreshToken;
    private JsonObject currentUser;
    private Role currentRole;
    private String username;
    private String lastErrorMessage = "";

    private static final Map<Role, Map<String, Boolean>> ROLE_PERMISSIONS = new HashMap<>();

    static {
        Map<String, Boolean> adminPerms = new HashMap<>();
        adminPerms.put("can_view_dashboard", true);
        adminPerms.put("can_view_trends", true);
        adminPerms.put("can_view_alarms", true);
        adminPerms.put("can_acknowledge_alarms", true);
        adminPerms.put("can_override", true);
        adminPerms.put("can_edit_settings", true);
        ROLE_PERMISSIONS.put(Role.ADMIN, adminPerms);

        Map<String, Boolean> operatorPerms = new HashMap<>();
        operatorPerms.put("can_view_dashboard", true);
        operatorPerms.put("can_view_trends", true);
        operatorPerms.put("can_view_alarms", true);
        operatorPerms.put("can_acknowledge_alarms", true);
        operatorPerms.put("can_override", false);
        operatorPerms.put("can_edit_settings", false);
        ROLE_PERMISSIONS.put(Role.OPERATOR, operatorPerms);

        Map<String, Boolean> userPerms = new HashMap<>();
        userPerms.put("can_view_dashboard", true);
        userPerms.put("can_view_trends", true);
        userPerms.put("can_view_alarms", false);
        userPerms.put("can_acknowledge_alarms", false);
        userPerms.put("can_override", false);
        userPerms.put("can_edit_settings", false);
        ROLE_PERMISSIONS.put(Role.USER, userPerms);
    }

    private static AuthService instance;

    private AuthService() {}

    public static AuthService getInstance() {
        if (instance == null) {
            instance = new AuthService();
        }
        return instance;
    }

    public String getLastErrorMessage() {
        return lastErrorMessage;
    }

    private CloseableHttpClient createHttpClient(boolean longTimeout) {
        RequestConfig.Builder config = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(longTimeout ? 30 : 10))
                .setResponseTimeout(Timeout.ofMinutes(longTimeout ? 3 : 1));
        return HttpClients.custom()
                .setDefaultRequestConfig(config.build())
                .build();
    }

    private String extractApiError(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        try {
            JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();
            if (json.has("error") && !json.get("error").isJsonNull()) {
                return json.get("error").getAsString();
            }
            if (json.has("detail") && !json.get("detail").isJsonNull()) {
                return json.get("detail").getAsString();
            }
        } catch (Exception ignored) {
            // Not JSON — fall through
        }
        return null;
    }

    private LoginResult mapHttpFailure(int statusCode, String responseBody) {
        String apiError = extractApiError(responseBody);
        if (apiError != null && !apiError.isBlank()) {
            lastErrorMessage = apiError;
        }

        if (statusCode == 401 || statusCode == 400) {
            if (lastErrorMessage.isBlank()) {
                lastErrorMessage = "Invalid credentials.";
            }
            return LoginResult.INVALID_CREDENTIALS;
        }
        if (statusCode == 403) {
            lastErrorMessage = "Access denied.";
            return LoginResult.ACCESS_DENIED;
        }
        if (statusCode == 504) {
            if (lastErrorMessage.isBlank()) {
                lastErrorMessage = "Face recognition timed out. Please try again.";
            }
            return LoginResult.SERVER_ERROR;
        }
        if (statusCode == 503 || statusCode >= 500) {
            if (lastErrorMessage.isBlank()) {
                lastErrorMessage = statusCode == 503
                        ? "Face recognition is unavailable. Restart kora_backend and try again."
                        : "Server error during authentication. Restart kora_backend and try again.";
            }
            return LoginResult.SERVER_ERROR;
        }
        if (lastErrorMessage.isBlank()) {
            lastErrorMessage = "Unexpected server response (" + statusCode + ").";
        }
        return LoginResult.CONNECTION_ERROR;
    }

    public LoginResult login(String username, String password) {
        lastErrorMessage = "";
        try (CloseableHttpClient httpClient = createHttpClient(false)) {
            HttpPost request = new HttpPost(LOGIN_URL);

            JsonObject json = new JsonObject();
            json.addProperty("username", username);
            json.addProperty("password", password);

            StringEntity entity = new StringEntity(json.toString(), ContentType.APPLICATION_JSON);
            request.setEntity(entity);

            try (CloseableHttpResponse response = httpClient.execute(request)) {
                int statusCode = response.getCode();
                if (statusCode == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonObject responseJson = JsonParser.parseString(responseBody).getAsJsonObject();
                    
                    String tempAccessToken = responseJson.get("access").getAsString();
                    String tempRefreshToken = responseJson.get("refresh").getAsString();

                    // Extract role from the user object in the response
                    Role resolvedRole = null;
                    if (responseJson.has("user")) {
                        JsonObject userObj = responseJson.get("user").getAsJsonObject();
                        if (userObj.has("role")) {
                            resolvedRole = mapDjangoRole(userObj.get("role").getAsString());
                        }
                    }

                    // If no role found in user object, try to decode from JWT claims
                    if (resolvedRole == null) {
                        resolvedRole = extractRoleFromJwt(tempAccessToken);
                    }

                    // If still no role, default to USER (will be rejected)
                    if (resolvedRole == null) {
                        resolvedRole = Role.USER;
                    }

                    // STRICT ENFORCEMENT: Only Operators can use the Desktop HMI
                    if (resolvedRole != Role.OPERATOR) {
                        System.err.println("ACCESS DENIED: User '" + username + "' has role '" + resolvedRole + "'. Only OPERATOR is allowed on Desktop.");
                        return LoginResult.ACCESS_DENIED;
                    }

                    // Role is OPERATOR — grant access
                    this.accessToken = tempAccessToken;
                    this.refreshToken = tempRefreshToken;
                    this.currentRole = resolvedRole;
                    this.username = username;
                    if (responseJson.has("user")) {
                        this.currentUser = responseJson.get("user").getAsJsonObject();
                    }
                    return LoginResult.SUCCESS;
                } else {
                    System.err.println("Login failed with status code: " + statusCode);
                    String responseBody = EntityUtils.toString(response.getEntity());
                    return mapHttpFailure(statusCode, responseBody);
                }
            } catch (ParseException e) {
                e.printStackTrace();
                lastErrorMessage = "Invalid response from server.";
                return LoginResult.CONNECTION_ERROR;
            }
        } catch (IOException e) {
            System.err.println("Connection error during login: " + e.getMessage());
            lastErrorMessage = "Cannot reach server at " + API_BASE + ". Start kora_backend and try again.";
            // Offline demo mode — only allow operator
            if ("operator".equals(username) && "operator".equals(password)) {
                this.username = "operator";
                this.currentRole = Role.OPERATOR;
                this.accessToken = "demo-token";
                return LoginResult.SUCCESS;
            }
            // Any other user (admin, customer, etc.) is rejected in offline mode too
            if ("admin".equals(username)) {
                return LoginResult.ACCESS_DENIED;
            }
            return LoginResult.CONNECTION_ERROR;
        }
    }

    public LoginResult biometricLogin(byte[] imageBytes) {
        lastErrorMessage = "";
        try (CloseableHttpClient httpClient = createHttpClient(true)) {
            HttpPost request = new HttpPost(BIOMETRIC_URL);

            String base64Image = java.util.Base64.getEncoder().encodeToString(imageBytes);

            JsonObject json = new JsonObject();
            json.addProperty("image", base64Image);

            StringEntity entity = new StringEntity(json.toString(), ContentType.APPLICATION_JSON);
            request.setEntity(entity);
            request.setHeader("Accept", "application/json");

            try (CloseableHttpResponse response = httpClient.execute(request)) {
                int statusCode = response.getCode();
                String responseBody = EntityUtils.toString(response.getEntity());

                if (statusCode == 200) {
                    JsonObject responseJson = JsonParser.parseString(responseBody).getAsJsonObject();

                    String tempAccessToken = responseJson.get("access").getAsString();
                    String tempRefreshToken = responseJson.get("refresh").getAsString();

                    Role resolvedRole = null;
                    if (responseJson.has("user")) {
                        JsonObject userObj = responseJson.get("user").getAsJsonObject();
                        if (userObj.has("role")) {
                            resolvedRole = mapDjangoRole(userObj.get("role").getAsString());
                        }
                    }

                    if (resolvedRole == null) {
                        resolvedRole = extractRoleFromJwt(tempAccessToken);
                    }
                    if (resolvedRole == null) {
                        resolvedRole = Role.USER;
                    }

                    if (resolvedRole != Role.OPERATOR) {
                        lastErrorMessage = "Only SCADA operators may use the desktop HMI.";
                        return LoginResult.ACCESS_DENIED;
                    }

                    this.accessToken = tempAccessToken;
                    this.refreshToken = tempRefreshToken;
                    this.currentRole = resolvedRole;
                    if (responseJson.has("user")) {
                        JsonObject userObj = responseJson.get("user").getAsJsonObject();
                        this.currentUser = userObj;
                        if (userObj.has("username")) {
                            this.username = userObj.get("username").getAsString();
                        }
                    }
                    return LoginResult.SUCCESS;
                }

                return mapHttpFailure(statusCode, responseBody);
            } catch (ParseException e) {
                e.printStackTrace();
                lastErrorMessage = "Invalid response from server.";
                return LoginResult.CONNECTION_ERROR;
            }
        } catch (IOException e) {
            e.printStackTrace();
            lastErrorMessage = "Cannot reach server at " + API_BASE
                    + ". Start kora_backend (python manage.py runserver) and try again.";
            return LoginResult.CONNECTION_ERROR;
        }
    }

    /**
     * Maps Django role strings to Java Role enum.
     * Django uses: 'admin', 'operator', 'customer'
     * Java uses:   ADMIN,   OPERATOR,   USER
     */
    private Role mapDjangoRole(String djangoRole) {
        if (djangoRole == null) return null;
        switch (djangoRole.toLowerCase().trim()) {
            case "admin":    return Role.ADMIN;
            case "operator": return Role.OPERATOR;
            case "customer": return Role.USER;
            case "user":     return Role.USER;
            default:         return Role.USER;
        }
    }

    /**
     * Extracts role from the JWT access token payload (base64-decoded middle segment).
     */
    private Role extractRoleFromJwt(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return null;
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            JsonObject claims = JsonParser.parseString(payload).getAsJsonObject();
            if (claims.has("role")) {
                return mapDjangoRole(claims.get("role").getAsString());
            }
        } catch (Exception e) {
            System.err.println("Could not extract role from JWT: " + e.getMessage());
        }
        return null;
    }

    public void logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.currentUser = null;
        this.currentRole = null;
        this.username = null;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public boolean isLoggedIn() {
        return accessToken != null && !accessToken.isEmpty();
    }

    public Role getCurrentRole() {
        return currentRole != null ? currentRole : Role.USER;
    }

    public String getUsername() {
        return username;
    }

    public boolean hasPermission(String permission) {
        if (currentRole == null) return false;
        Map<String, Boolean> perms = ROLE_PERMISSIONS.get(currentRole);
        return perms != null && perms.getOrDefault(permission, false);
    }
}

