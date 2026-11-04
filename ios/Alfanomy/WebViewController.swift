import UIKit
import WebKit

// Аналог MainActivity.java: один WKWebView на весь экран, грузит index.html
// из бандла и передаёт push-токен в JS-модель через evaluateJavaScript,
// точно так же, как Android-версия делает через webView.evaluateJavascript.
final class WebViewController: UIViewController, WKNavigationDelegate {

    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Полоса статуса (часы, батарея) и нижняя полоса на iPhone без кнопки "Домой" -
        // цветом заголовка веб-аппа (jQuery Mobile, тема a: #e9e9e9).
        view.backgroundColor = UIColor(red: 0xE9 / 255.0, green: 0xE9 / 255.0, blue: 0xE9 / 255.0, alpha: 1)

        webView = WKWebView(frame: view.bounds)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // Веб-апп сам не учитывает вырезы экрана: без этого прокручиваемый список
        // заезжал под полосу статуса. Держим WKWebView строго внутри safe area.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])

        if let indexUrl = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(indexUrl, allowingReadAccessTo: indexUrl.deletingLastPathComponent())
        }

        NotificationCenter.default.addObserver(self, selector: #selector(tokenUpdated),
                                                name: PushToken.updatedNotification, object: nil)
    }

    // Тёмный текст полосы статуса на светлом фоне заголовка (и в тёмной теме iPhone).
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

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
