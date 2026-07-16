import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Presents the system photo picker; returns a 256px JPEG as base64.
struct PhotoPicker: UIViewControllerRepresentable {
    let onPick: (String) -> Void
    var onCancel: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick, onCancel: onCancel) }

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: (String) -> Void
        let onCancel: () -> Void

        init(onPick: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
            self.onPick = onPick
            self.onCancel = onCancel
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            // Empty results means the user cancelled. Dismissal belongs to the caller's
            // `isPresented` binding — dismissing the controller behind SwiftUI's back
            // leaves the binding true, and the sheet never opens again.
            guard let provider = results.first?.itemProvider,
                  provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) else {
                DispatchQueue.main.async { self.onCancel() }
                return
            }
            _ = provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
                // The temp file is deleted the moment this callback returns: decode inline.
                let base64 = url.flatMap { Self.thumbnailBase64(at: $0) }
                DispatchQueue.main.async {
                    if let base64 { self.onPick(base64) } else { self.onCancel() }
                }
            }
        }

        /// Downsample through ImageIO, which decodes straight to the target size. Loading
        /// a `UIImage` first would materialize the full bitmap — ~190 MB for a 48-megapixel
        /// shot — to then throw all but 256px of it away.
        static func thumbnailBase64(at url: URL) -> String? {
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true, // honour the EXIF orientation
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: 256, // pixels, not points: no @2x/@3x inflation
            ]
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                  let thumb = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
            else { return nil }
            let image = UIImage(cgImage: thumb)
            // Reduce quality until the base64 fits within the protocol cap (MAX_PHOTO_LEN,
            // 64 KiB). A high-detail 256px frame can exceed the cap even at q0.7; without
            // this loop `SaveProfile` rejects the whole profile with no recourse for the user.
            let maxBase64Len = 64 * 1024
            var quality: CGFloat = 0.7
            while quality > 0.1 {
                if let jpegData = image.jpegData(compressionQuality: quality) {
                    let base64 = jpegData.base64EncodedString()
                    if base64.count <= maxBase64Len {
                        return base64
                    }
                }
                quality -= 0.1
            }
            // Last resort: the smallest quality that still produces something.
            return image.jpegData(compressionQuality: 0.1)?.base64EncodedString()
        }
    }
}
