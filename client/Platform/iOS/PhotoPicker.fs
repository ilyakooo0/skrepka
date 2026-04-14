namespace Skrepka.iOS

open System
open System.Threading.Tasks
open Foundation
open UIKit
open PhotosUI

type private PickerDelegate(tcs: TaskCompletionSource<byte[] option>) =
    inherit PHPickerViewControllerDelegate()

    override _.DidFinishPicking(controller, results) =
        controller.DismissViewController(true, null)

        if results.Length = 0 then
            tcs.TrySetResult None |> ignore
        else
            results[0].ItemProvider.LoadDataRepresentation(
                "public.image",
                Action<NSData, NSError>(fun data error ->
                    if isNull error && not (isNull data) then
                        tcs.TrySetResult(Some(data.ToArray())) |> ignore
                    else
                        tcs.TrySetResult None |> ignore))
            |> ignore

module PhotoPicker =
    let mutable private prevent_gc: obj = null

    let pick () : Task<byte[] option> =
        let tcs = TaskCompletionSource<byte[] option>()

        Avalonia.Threading.Dispatcher.UIThread.Post(fun () ->
            let config = new PHPickerConfiguration()
            config.Filter <- PHPickerFilter.ImagesFilter
            config.SelectionLimit <- 1n

            let picker = new PHPickerViewController(config)
            let d = new PickerDelegate(tcs)
            prevent_gc <- box (picker, d)
            tcs.Task.ContinueWith(fun (_: Task<byte[] option>) -> prevent_gc <- null) |> ignore
            picker.Delegate <- d

            let window = UIApplication.SharedApplication.KeyWindow
            if not (isNull window) && not (isNull window.RootViewController) then
                window.RootViewController.PresentViewController(picker, true, null)
            else
                tcs.TrySetResult None |> ignore)

        tcs.Task
