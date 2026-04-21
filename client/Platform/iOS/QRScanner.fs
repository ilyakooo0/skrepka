namespace Skrepka.iOS

open System
open System.Threading.Tasks
open Foundation
open UIKit
open AVFoundation
open CoreFoundation

type private ScanDelegate(tcs: TaskCompletionSource<string option>, session: AVCaptureSession) =
    inherit AVCaptureMetadataOutputObjectsDelegate()

    let mutable handled = false

    override _.DidOutputMetadataObjects(output, metadataObjects, connection) =
        if not handled && metadataObjects.Length > 0 then
            match metadataObjects.[0] with
            | :? AVMetadataMachineReadableCodeObject as code when code.Type = AVMetadataObjectType.QRCode ->
                handled <- true
                session.StopRunning()

                DispatchQueue.MainQueue.DispatchAsync(fun () ->
                    let window = UIApplication.SharedApplication.KeyWindow

                    if not (isNull window) && not (isNull window.RootViewController) then
                        window.RootViewController.DismissViewController(true, fun () ->
                            tcs.TrySetResult(Some code.StringValue) |> ignore)
                    else
                        tcs.TrySetResult(Some code.StringValue) |> ignore)
            | _ -> ()

module QRScanner =
    let mutable private prevent_gc: obj = null

    let private presentScanner (tcs: TaskCompletionSource<string option>) =
        let session = new AVCaptureSession()

        match AVCaptureDevice.GetDefaultDevice(AVMediaTypes.Video) with
        | null -> tcs.TrySetResult None |> ignore
        | device ->
            let mutable error: NSError = null
            let input = AVCaptureDeviceInput.FromDevice(device, &error)

            if isNull input then
                tcs.TrySetResult None |> ignore
            else
                session.AddInput(input)

                let output = new AVCaptureMetadataOutput()
                session.AddOutput(output)

                let del = new ScanDelegate(tcs, session)
                output.SetDelegate(del, DispatchQueue.MainQueue)
                output.MetadataObjectTypes <- AVMetadataObjectType.QRCode

                let preview = AVCaptureVideoPreviewLayer.FromSession(session)
                preview.VideoGravity <- AVLayerVideoGravity.ResizeAspectFill
                preview.Frame <- UIScreen.MainScreen.Bounds

                let vc = new UIViewController()
                vc.View.BackgroundColor <- UIColor.Black
                vc.View.Layer.AddSublayer(preview)

                let closeBtn = UIButton.FromType(UIButtonType.System)
                closeBtn.SetTitle("Cancel", UIControlState.Normal)
                closeBtn.SetTitleColor(UIColor.White, UIControlState.Normal)
                closeBtn.Frame <- CoreGraphics.CGRect(20., 60., 100., 44.)

                closeBtn.TouchUpInside.Add(fun _ ->
                    session.StopRunning()

                    vc.DismissViewController(true, fun () ->
                        tcs.TrySetResult None |> ignore))

                vc.View.AddSubview(closeBtn)

                prevent_gc <- box (session, del, preview, vc)

                tcs.Task.ContinueWith(fun (_: Task<string option>) -> prevent_gc <- null)
                |> ignore

                session.StartRunning()

                let window = UIApplication.SharedApplication.KeyWindow

                if not (isNull window) && not (isNull window.RootViewController) then
                    vc.ModalPresentationStyle <- UIModalPresentationStyle.FullScreen
                    window.RootViewController.PresentViewController(vc, true, null)
                else
                    session.StopRunning()
                    tcs.TrySetResult None |> ignore

    let scan () : Task<string option> =
        let tcs = TaskCompletionSource<string option>()

        Avalonia.Threading.Dispatcher.UIThread.Post(fun () ->
            let status = AVCaptureDevice.GetAuthorizationStatus(AVAuthorizationMediaType.Video)

            match status with
            | AVAuthorizationStatus.Denied
            | AVAuthorizationStatus.Restricted -> tcs.TrySetResult None |> ignore
            | AVAuthorizationStatus.NotDetermined ->
                AVCaptureDevice.RequestAccessForMediaType(
                    AVAuthorizationMediaType.Video,
                    fun granted ->
                        if granted then
                            DispatchQueue.MainQueue.DispatchAsync(fun () -> presentScanner tcs)
                        else
                            tcs.TrySetResult None |> ignore
                )
            | _ -> presentScanner tcs)

        tcs.Task
