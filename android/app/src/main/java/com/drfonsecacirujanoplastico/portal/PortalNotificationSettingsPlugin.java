package com.drfonsecacirujanoplastico.portal;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PortalNotificationSettings")
public class PortalNotificationSettingsPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String channelId = call.getString("channelId", "");
        Intent intent = null;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && channelId != null && !channelId.isEmpty()) {
            intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        }

        if (openIntent(intent)) {
            call.resolve();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && openIntent(appNotificationSettingsIntent())) {
            call.resolve();
            return;
        }

        if (openIntent(appDetailsIntent())) {
            call.resolve();
            return;
        }

        call.reject("Unable to open Android notification settings.");
    }

    private Intent appNotificationSettingsIntent() {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        return intent;
    }

    private Intent appDetailsIntent() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        return intent;
    }

    private boolean openIntent(Intent intent) {
        if (intent == null) return false;
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException | IllegalArgumentException ignored) {
            return false;
        }
    }
}
