namespace Skrepka.iOS

open Foundation
open UIKit
open Avalonia
open Avalonia.iOS
open Fabulous.Avalonia
open Skrepka

[<Register(nameof AppDelegate)>]
type AppDelegate() =
    inherit AvaloniaAppDelegate<FabApplication>()

    override this.CreateAppBuilder() =
        NSTimer.CreateScheduledTimer(0.0, false, fun _ ->
            if this.Window <> null then
                this.Window.BackgroundColor <- UIColor.White)
        |> ignore

        App.create().UseiOS()

module Main =
    [<EntryPoint>]
    let main (args: string array) =
        UIApplication.Main(args, null, typeof<AppDelegate>)
        0
