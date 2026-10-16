#!/bin/bash
# يفعّل الوضع الغامر (Fullscreen) في مشروع Capacitor Android
set -e
cd android

echo "═══ 1) styles.xml ═══"
cat > app/src/main/res/values/styles.xml << 'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:statusBarColor">#2b303b</item>
        <item name="android:navigationBarColor">#2b303b</item>
        <item name="android:windowBackground">#2b303b</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="AppTheme"></style>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar"></style>
</resources>
XML

echo "═══ 2) MainActivity.java ═══"
MK=$(find app/src/main/java -name MainActivity.java | head -1)
if [ -z "$MK" ]; then echo "!! MainActivity not found"; exit 1; fi
PKG=$(grep -oP '^package \K[^;]+' "$MK")
echo "Package: $PKG"

cat > "$MK" << JAVA
package $PKG;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
JAVA

echo "═══ 3) AndroidManifest windowSoftInputMode ═══"
MANIFEST="app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  sed -i 's/android:windowSoftInputMode="[^"]*"/android:windowSoftInputMode="adjustResize"/' "$MANIFEST"
fi

echo "✔ Fullscreen applied successfully"
