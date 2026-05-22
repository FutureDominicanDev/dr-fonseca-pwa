package com.drfonsecacirujanoplastico.portal;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "PortalAudioRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class PortalAudioRecorderPlugin extends Plugin {
    private MediaRecorder recorder;
    private File outputFile;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecording(call);
        } else {
            call.reject("Microphone permission denied.");
        }
    }

    private void startRecording(PluginCall call) {
        if (recorder != null) {
            call.reject("Recording already in progress.");
            return;
        }

        try {
            outputFile = File.createTempFile("staff-voice-", ".m4a", getContext().getCacheDir());
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(96000);
            recorder.setAudioSamplingRate(44100);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();

            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (Exception error) {
            cleanupRecorder();
            deleteOutputFile();
            call.reject("Unable to start recording.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null || outputFile == null) {
            call.reject("No recording in progress.");
            return;
        }

        try {
            recorder.stop();
        } catch (RuntimeException ignored) {
            cleanupRecorder();
            deleteOutputFile();
            call.reject("Recording was too short.");
            return;
        }

        cleanupRecorder();

        try {
            byte[] bytes = readFile(outputFile);
            String encoded = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject result = new JSObject();
            result.put("dataUrl", "data:audio/mp4;base64," + encoded);
            result.put("mimeType", "audio/mp4");
            result.put("fileName", outputFile.getName());
            deleteOutputFile();
            call.resolve(result);
        } catch (IOException error) {
            deleteOutputFile();
            call.reject("Unable to read recording.");
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cleanupRecorder();
        deleteOutputFile();
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    private void cleanupRecorder() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {
            }
            recorder = null;
        }
    }

    private void deleteOutputFile() {
        if (outputFile != null) {
            try {
                outputFile.delete();
            } catch (Exception ignored) {
            }
            outputFile = null;
        }
    }

    private byte[] readFile(File file) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        try (FileInputStream input = new FileInputStream(file)) {
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
        }
        return output.toByteArray();
    }
}
