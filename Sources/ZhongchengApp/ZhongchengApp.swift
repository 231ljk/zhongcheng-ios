import SwiftUI
import WebKit

@main
struct ZhongchengApp: App {
    var body: some Scene {
        WindowGroup {
            WebView()
                .ignoresSafeArea()
                .statusBarHidden(false)
        }
    }
}

/// 全屏 WKWebView，加载包内离线网页 IDE（index.html，单文件含全部内核）
struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.078, green: 0.094, blue: 0.122, alpha: 1)
        // 允许橡皮筋回弹外的滚动，键盘弹出时自动收起工具条
        webView.scrollView.keyboardDismissMode = .interactive
        if let url = Bundle.module.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
