import SwiftUI
import UIKit

/// App-level delegate enforcing Portrait-only on iPhone and full Portrait + Landscape support on iPad & Mac.
final class DurakAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .pad || ProcessInfo.processInfo.isiOSAppOnMac {
            return .all
        }
        return .portrait
    }
}

@main
struct DurakApp: App {
    @UIApplicationDelegateAdaptor(DurakAppDelegate.self) private var appDelegate
    @State private var router = AppRouter()
    @State private var themeManager = ThemeManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(router)
                .environment(themeManager)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1180, height: 820)
    }
}
