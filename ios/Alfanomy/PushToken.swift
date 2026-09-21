import Foundation

// Аналог SharedPreferences("push") из Android-версии: хранит последний
// FCM-токен и уведомляет WebViewController, чтобы тот передал его в JS.
final class PushToken {
    static let shared = PushToken()
    static let updatedNotification = Notification.Name("PushTokenUpdated")

    private let defaultsKey = "fcm_token"

    var current: String? {
        UserDefaults.standard.string(forKey: defaultsKey)
    }

    func store(_ token: String) {
        UserDefaults.standard.set(token, forKey: defaultsKey)
        NotificationCenter.default.post(name: PushToken.updatedNotification, object: token)
    }
}
