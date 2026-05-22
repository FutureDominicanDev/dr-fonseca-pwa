package com.drfonsecacirujanoplastico.portal;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int SYSTEM_NAVIGATION_BAR_COLOR = Color.parseColor("#EFF4F9");

    private void lockPortraitOrientation() {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }

    private void blendSystemNavigationBar() {
        try {
            Window window = getWindow();
            if (window == null) return;

            window.setNavigationBarColor(SYSTEM_NAVIGATION_BAR_COLOR);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                View decorView = window.getDecorView();
                decorView.setSystemUiVisibility(
                    decorView.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                );
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setNavigationBarContrastEnforced(false);
            }
        } catch (Throwable ignored) {
            // The app should still open even if a device rejects nav bar styling.
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        lockPortraitOrientation();
        registerPlugin(PortalNotificationSettingsPlugin.class);
        registerPlugin(PortalAudioRecorderPlugin.class);
        super.onCreate(savedInstanceState);
        blendSystemNavigationBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        lockPortraitOrientation();
        blendSystemNavigationBar();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        lockPortraitOrientation();
    }
}
