import PhotosUI
import SwiftUI
import UIKit

/// Presents the system photo picker; returns a downscaled JPEG as base64.
struct PhotoPicker: UIViewControllerRepresentable {
    let onPick: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

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
        init(onPick: @escaping (String) -> Void) { self.onPick = onPick }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else {
                DispatchQueue.main.async { picker.dismiss(animated: true) }
                return
            }
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                guard let image = object as? UIImage,
                      let base64 = Self.downscaledBase64(image) else { return }
                DispatchQueue.main.async { self.onPick(base64) }
            }
        }

        /// Resize to fit 256px and JPEG-encode, to keep the profile payload small.
        static func downscaledBase64(_ image: UIImage) -> String? {
            let maxDim: CGFloat = 256
            let scale = min(1, maxDim / max(image.size.width, image.size.height))
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: size)
            let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            return resized.jpegData(compressionQuality: 0.7)?.base64EncodedString()
        }
    }
}
