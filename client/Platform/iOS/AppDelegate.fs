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
    override this.CreateAppBuilder() = App.create().UseiOS()

    [<Export("application:didFinishLaunchingWithOptions:")>]
    member this.FinishedLaunching(app: UIApplication, options: NSDictionary) : bool =
        let result = base.FinishedLaunching(app, options)
        if this.Window <> null then
            this.Window.BackgroundColor <- UIColor.White
        result

module Main =
    [<EntryPoint>]
    let main (args: string array) =
        UIApplication.Main(args, null, typeof<AppDelegate>)
        0
