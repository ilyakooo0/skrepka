import AVFoundation
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

/// Rendering context for QR generation. Building a CIContext is expensive (it spins up a
/// GPU/CPU render pipeline) and `qrImage` is called from inside a SwiftUI `body`.
private let ciContext = CIContext()

/// Generate a QR code image from a string.
func qrImage(_ string: String) -> UIImage? {
    let context = ciContext
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(string.utf8)
    guard let output = filter.outputImage else { return nil }
    let scaled = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
    guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
    return UIImage(cgImage: cg)
}

/// A QR code carries whatever its author put there. Strip a leading scheme so a share
/// link (`skrepka:<key>`, `https://…/<key>`) yields the bare key the core will accept,
/// and so the pubkey field never silently fills with an unrelated URL.
func scannedKeyPayload(_ raw: String) -> String {
    var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    let schemes = ["skrepka://", "skrepka:", "https://", "http://"]
    if let scheme = schemes.first(where: { value.lowercased().hasPrefix($0) }) {
        value = String(value.dropFirst(scheme.count))
        // What remains of a link is host/path#key — the key is the last component.
        if let key = value.split(whereSeparator: { "/#?".contains($0) }).last {
            value = String(key)
        }
    }
    return value.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// A camera-backed QR scanner. Calls `onScan` with the decoded payload once.
struct QRScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    func makeUIViewController(context: Context) -> ScannerVC {
        let vc = ScannerVC()
        vc.coordinator = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerVC, context: Context) {}

    final class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        let onScan: (String) -> Void
        private var done = false
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            guard !done,
                  let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let value = obj.stringValue else { return }
            done = true
            DispatchQueue.main.async { self.onScan(value) }
        }
    }
}

final class ScannerVC: UIViewController {
    weak var coordinator: QRScannerView.Coordinator?
    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(coordinator, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.layer.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)
        previewLayer = preview
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // Both start and stop block until the camera pipeline settles — never on main.
        if session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { self.session.stopRunning() }
        }
    }
}
