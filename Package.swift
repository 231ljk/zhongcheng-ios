// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ZhongchengApp",
    platforms: [.iOS(.v15)],
    products: [
        .executable(name: "ZhongchengApp", targets: ["ZhongchengApp"])
    ],
    targets: [
        .executableTarget(
            name: "ZhongchengApp",
            resources: [.copy("Resources/index.html")]
        )
    ]
)
