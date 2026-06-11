package com.kora.desktop.device;

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.Property;

import java.util.HashMap;
import java.util.Map;

public class TagEngine {

    private static TagEngine instance;

    private final Map<String, DoubleProperty> doubleTags = new HashMap<>();
    private final Map<String, BooleanProperty> booleanTags = new HashMap<>();
    private final Map<String, StringProperty> stringTags = new HashMap<>();

    private TagEngine() {
        // Initialize default tags
        setTag("tank_a_level", 0.0);
        setTag("tank_b_level", 0.0);
        setTag("pressure", 0.0);
        setTag("temperature", 0.0);
        setTag("flow_rate", 0.0);
        
        setTag("pump_1_running", false);
        setTag("pump_2_running", false);
        setTag("valve_inlet", false);
        setTag("valve_outlet", false);
    }

    public static TagEngine getInstance() {
        if (instance == null) {
            instance = new TagEngine();
        }
        return instance;
    }

    public DoubleProperty getDoubleProperty(String tag) {
        return doubleTags.computeIfAbsent(tag, k -> new SimpleDoubleProperty(0.0));
    }

    public BooleanProperty getBooleanProperty(String tag) {
        return booleanTags.computeIfAbsent(tag, k -> new SimpleBooleanProperty(false));
    }

    public StringProperty getStringProperty(String tag) {
        return stringTags.computeIfAbsent(tag, k -> new SimpleStringProperty(""));
    }

    public void setTag(String tag, double value) {
        getDoubleProperty(tag).set(value);
    }

    public void setTag(String tag, boolean value) {
        getBooleanProperty(tag).set(value);
    }

    public void setTag(String tag, String value) {
        getStringProperty(tag).set(value);
    }

    public double getDoubleTag(String tag) {
        return getDoubleProperty(tag).get();
    }

    public boolean getBooleanTag(String tag) {
        return getBooleanProperty(tag).get();
    }

    public String getStringTag(String tag) {
        return getStringProperty(tag).get();
    }

    public boolean hasTag(String tag) {
        return booleanTags.containsKey(tag) || doubleTags.containsKey(tag) || stringTags.containsKey(tag);
    }

    public int getDoubleTagCount() {
        return doubleTags.size();
    }

    public int getBooleanTagCount() {
        return booleanTags.size();
    }

    public int getStringTagCount() {
        return stringTags.size();
    }
}
