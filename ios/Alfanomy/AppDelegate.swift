import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

// Аналог MainActivity.java + MyFirebaseMessagingService.java из Android-версии:
// один WKWebView на весь экран, показывающий тот же веб-апп из web/,
// плюс push-токен, который прокидывается в JS-модель через registerPushToken.
@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                      didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }

        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = WebViewController()
        window?.makeKeyAndVisible()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    // Вызывается Firebase, когда получен/обновлён push-токен - сохраняем и
    // пробуем сразу передать в JS, как MyFirebaseMessagingService.onNewToken.
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        PushToken.shared.store(token)
    }

    // Показываем уведомление, даже если приложение открыто на экране
    // (аналог showNotification в Android-версии).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                 willPresent notification: UNNotification,
                                 withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }
}
