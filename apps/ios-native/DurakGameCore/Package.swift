// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DurakGameCore",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "DurakGameCore", targets: ["DurakGameCore"]),
    ],
    targets: [
        .target(
            name: "DurakGameCore",
            path: "Sources/DurakGameCore"
        ),
        .testTarget(
            name: "DurakGameCoreTests",
            dependencies: ["DurakGameCore"],
            path: "Tests/DurakGameCoreTests"
        ),
    ]
)
