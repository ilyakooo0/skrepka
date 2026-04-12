namespace Skrepka


open System
open System.IO
open System.Text.Json
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View

module Buttons =
    let button (text: string) (msg: 'msg) : WidgetBuilder<'msg, IFabButton> =
        (Button(text, msg).borderWidth(4).background (Constants.accentColor)).borderColor (Colors.Black)
