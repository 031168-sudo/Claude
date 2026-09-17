package ru.alfanomy.mapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private WebView webView;
    private static MainActivity activeInstance;

    @SuppressLint("SetJavaScriptEnabled") @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        activeInstance = this;

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true); s.setAllowContentAccess(true); s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Страница полностью загрузилась - можно передавать push-токен в JS-модель
                trySendPendingToken();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        WebView.setWebContentsDebuggingEnabled(true);
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");

        requestNotificationPermissionIfNeeded();
        fetchAndStoreFcmToken();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }
    }

    private void fetchAndStoreFcmToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            getSharedPreferences("push", MODE_PRIVATE).edit().putString("fcm_token", token).apply();
            trySendPendingToken();
        });
    }

    private void trySendPendingToken() {
        String token = getSharedPreferences("push", MODE_PRIVATE).getString("fcm_token", null);
        if (token == null || webView == null) return;
        String js = "(function(){if(window.app&&window.app.model&&window.app.model.registerPushToken){window.app.model.registerPushToken('" + token + "');}})();";
        webView.evaluateJavascript(js, null);
    }

    // Вызывается из MyFirebaseMessagingService, когда токен обновился, а приложение уже открыто
    static void registerTokenIfActive(String token) {
        if (activeInstance != null) {
            activeInstance.runOnUiThread(activeInstance::trySendPendingToken);
        }
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        if (activeInstance == this) activeInstance = null;
    }

    @Override public boolean onKeyDown(int keyCode, KeyEvent event) { if (keyCode==KeyEvent.KEYCODE_BACK && webView.canGoBack()) { webView.goBack(); return true; } return super.onKeyDown(keyCode,event); }
}
