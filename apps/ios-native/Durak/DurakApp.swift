import SwiftUI

@main
struct DurakApp: App {
    @State private var router = AppRouter()
    @State private var themeManager = ThemeManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(router)
                .environment(themeManager)
                .preferredColorScheme(.dark)
        }
    }
}
