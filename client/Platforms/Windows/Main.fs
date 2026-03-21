namespace Skrepka.WinUI

open System

module Program =
    [<EntryPoint; STAThread>]
    let main args =
        do FSharp.Maui.WinUICompat.Program.Main(args, typeof<Skrepka.WinUI.App>)
        0
