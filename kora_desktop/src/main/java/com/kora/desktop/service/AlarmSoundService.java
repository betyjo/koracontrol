package com.kora.desktop.service;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.SourceDataLine;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Service that plays alert tones when critical/high alarms are raised.
 * Uses javax.sound.sampled for beep generation (no external WAV files needed).
 * Supports horn-silence functionality.
 */
public class AlarmSoundService {

    private static AlarmSoundService instance;

    private final AtomicBoolean silenced = new AtomicBoolean(false);
    private final AtomicBoolean playing = new AtomicBoolean(false);
    private Thread soundThread;

    private AlarmSoundService() {}

    public static AlarmSoundService getInstance() {
        if (instance == null) {
            instance = new AlarmSoundService();
        }
        return instance;
    }

    /**
     * Starts monitoring AlarmManager for critical/high alarms and plays sounds.
     */
    public void start() {
        AlarmManager.getInstance().setOnAlarmsChanged(this::onAlarmsChanged);
    }

    /**
     * Silences the alarm horn. New critical alarms will re-trigger sound
     * unless silence is toggled again.
     */
    public void silence() {
        silenced.set(true);
        stopCurrentSound();
    }

    /**
     * Re-enables alarm sounds after silence.
     */
    public void unsilence() {
        silenced.set(false);
    }

    /**
     * Toggles silence state and returns new state (true = silenced).
     */
    public boolean toggleSilence() {
        boolean newState = !silenced.get();
        silenced.set(newState);
        if (newState) stopCurrentSound();
        return newState;
    }

    public boolean isSilenced() {
        return silenced.get();
    }

    private void onAlarmsChanged(List<AlarmManager.Alarm> alarms) {
        if (silenced.get()) return;

        boolean hasCritical = alarms.stream()
                .anyMatch(a -> a.state == AlarmManager.State.ACTIVE
                        && a.severity == AlarmManager.Severity.CRITICAL);

        boolean hasHigh = alarms.stream()
                .anyMatch(a -> a.state == AlarmManager.State.ACTIVE
                        && a.severity == AlarmManager.Severity.HIGH);

        if (hasCritical) {
            playAlertTone(880, 200, 3); // High-pitched rapid beeps for critical
        } else if (hasHigh) {
            playAlertTone(660, 300, 2); // Medium-pitched beeps for high
        }
    }

    /**
     * Plays a generated beep tone.
     *
     * @param frequency  tone frequency in Hz
     * @param durationMs duration of each beep in ms
     * @param repeatCount number of beeps
     */
    private void playAlertTone(double frequency, int durationMs, int repeatCount) {
        if (playing.get()) return; // Don't overlap sounds

        soundThread = new Thread(() -> {
            playing.set(true);
            try {
                float sampleRate = 8000f;
                int samplesPerBeep = (int) (sampleRate * durationMs / 1000.0);
                byte[] data = new byte[samplesPerBeep];

                // Generate sine wave
                for (int i = 0; i < samplesPerBeep; i++) {
                    double angle = 2.0 * Math.PI * frequency * i / sampleRate;
                    data[i] = (byte) (Math.sin(angle) * 60); // Volume ~47%
                }

                AudioFormat format = new AudioFormat(sampleRate, 8, 1, true, false);
                try (SourceDataLine line = AudioSystem.getSourceDataLine(format)) {
                    line.open(format);
                    line.start();

                    for (int b = 0; b < repeatCount && !silenced.get(); b++) {
                        line.write(data, 0, data.length);
                        // Gap between beeps
                        Thread.sleep(100);
                    }

                    line.drain();
                }
            } catch (LineUnavailableException | InterruptedException e) {
                // Sound not available - silently ignore
            } finally {
                playing.set(false);
            }
        }, "alarm-sound-thread");
        soundThread.setDaemon(true);
        soundThread.start();
    }

    private void stopCurrentSound() {
        if (soundThread != null && soundThread.isAlive()) {
            soundThread.interrupt();
        }
    }
}
