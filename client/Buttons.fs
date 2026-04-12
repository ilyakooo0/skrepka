namespace Skrepka


open System
open System.IO
open System.Text.Json
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics
open Fabulous
open Fabulous.Maui
open Microsoft.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View

module Buttons =
    open Microsoft.Maui

    let button (text: string) (msg: 'msg) : WidgetBuilder<'msg, _> =
        Component(text) {
            Grid() {
                Rectangle().margin(Thickness(8., 8., -8., -8.)).background (Colors.Black)

                Button(text, msg)
                    .borderWidth(4)
                    .background(Constants.accentColor)
                    .borderColor(Colors.Black)
                    .textColor(Colors.White)
                    .font (fontFamily = "UnboundedBold", size = 24.)
            }
        }
