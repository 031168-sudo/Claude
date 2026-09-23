import UIKit
import WebKit

// Аналог MainActivity.java: один WKWebView на весь экран, грузит index.html
// из бандла и передаёт push-токен в JS-модель через evaluateJavaScript,
// точно так же, как Android-версия делает через webView.evaluateJavascript.
final class WebViewController: UIViewController, WKNavigationDelegate {

    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        webView = WKWebView(frame: view.bounds)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        view.addSubview(webView)

        if let indexUrl = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(indexUrl, allowingReadAccessTo: indexUrl.deletingLastPathComponent())
        }

        NotificationCenter.default.addObserver(self, selector: #selector(tokenUpdated),
                                                name: PushToken.updatedNotification, object: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        trySendPendingToken()
    }

    @objc private func tokenUpdated() {
        trySendPendingToken()
    }

    private func trySendPendingToken() {
        guard let token = PushToken.shared.current else { return }
        let js = "(function(){if(window.app&&window.app.model&&window.app.model.registerPushToken){window.app.model.registerPushToken('\(token)');}})();"
        webView.evaluateJavaScript(js)
    }
}
