namespace Skrepka.iOS

open System
open Foundation
open UIKit
open Avalonia
open Avalonia.iOS
open Fabulous.Avalonia
open Skrepka

[<Register(nameof AppDelegate)>]
type AppDelegate() =
    inherit AvaloniaAppDelegate<FabApplication>()

    let readSafeArea () =
        let w = UIApplication.SharedApplication.KeyWindow
        if not (isNull w) then
            SafeArea.triggerInsetsChanged(float w.SafeAreaInsets.Top, float w.SafeAreaInsets.Bottom)

    override this.CreateAppBuilder() =
        NSTimer.CreateScheduledTimer(0.1, false, fun _ ->
            if this.Window <> null then
                this.Window.BackgroundColor <- UIColor.White
            readSafeArea())
        |> ignore

        UIDevice.CurrentDevice.BeginGeneratingDeviceOrientationNotifications()
        NSNotificationCenter.DefaultCenter.AddObserver(
            UIDevice.OrientationDidChangeNotification,
            Action<NSNotification>(fun _ ->
                NSTimer.CreateScheduledTimer(0.1, false, fun _ -> readSafeArea()) |> ignore))
        |> ignore

        NSNotificationCenter.DefaultCenter.AddObserver(
            UIKeyboard.WillShowNotification,
            Action<NSNotification>(fun n ->
                let frame =
                    (n.UserInfo.ObjectForKey(UIKeyboard.FrameEndUserInfoKey) :?> NSValue)
                        .CGRectValue

                let h = float frame.Height

                let safeBottom =
                    let w = UIApplication.SharedApplication.KeyWindow
                    if isNull w then 0. else float w.SafeAreaInsets.Bottom

                Keyboard.triggerHeightChanged (max 0. (h - safeBottom))))
        |> ignore

        NSNotificationCenter.DefaultCenter.AddObserver(
            UIKeyboard.WillHideNotification,
            Action<NSNotification>(fun _ -> Keyboard.triggerHeightChanged 0.))
        |> ignore

        App.create().UseiOS()

module Main =
    [<EntryPoint>]
    let main (args: string array) =
        UIApplication.Main(args, null, typeof<AppDelegate>)
        0
