// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ZhongchengApp",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "ZhongchengApp", targets: ["ZhongchengApp"])
    ],
    targets: [
        .target(
            name: "ZhongchengApp",
            resources: [.copy("Resources/index.html")]
        )
    ]
)
