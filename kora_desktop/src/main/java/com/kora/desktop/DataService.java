package com.kora.desktop;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class DataService {
    private static final String BASE_URL = "http://127.0.0.1:8000/api/";
    private String jwtToken = ""; // Needs to be set after login or provided

    public void setJwtToken(String jwtToken) {
        this.jwtToken = jwtToken;
    }

    // Fetch tags from Django
    public String getLatestTags() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "logs/"))
                // .header("Authorization", "Bearer " + jwtToken) // Uncomment if auth is required
                .GET()
                .build();
        
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("Failed to fetch tags: " + response.statusCode());
        }
        return response.body();
    }

    // Send command to PLC via API
    public String sendCommand(int tagId, double value) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String jsonPayload = String.format("{\"tag_id\": %d, \"value\": %.2f}", tagId, value);
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "control/")) // Assuming this is the endpoint
                // .header("Authorization", "Bearer " + jwtToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200 && response.statusCode() != 201) {
            throw new RuntimeException("Failed to send command: " + response.statusCode());
        }
        return response.body();
    }
}
