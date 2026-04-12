namespace Skrepka


open System
open System.IO
open System.Text.Json
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View
open type Fabulous.Maui.VisualElementAnimationModifiers
open type Microsoft.Maui.Controls.ViewExtensions

module Buttons =
    open Microsoft.Maui

    let private animationDuration = 100u
    let private animationEasing = Easing.CubicOut

    let button (text: string) (msg: 'msg) =

        let shadowRef = ViewRef<Microsoft.Maui.Controls.Shapes.Rectangle>()

        let animate pressed =
            match shadowRef.TryValue with
            | None -> ()
            | Some c ->
                if pressed then
                    c.TranslateToAsync(8., 8., animationDuration, animationEasing) |> ignore
                else
                    c.TranslateToAsync(12., 12., animationDuration, animationEasing) |> ignore

        Component(text) {

            Grid() {

                Rectangle().reference(shadowRef).background(Colors.Black).translationX(12.).translationY (12.)
                Rectangle().background (Constants.accentColor)


                Label(text).textColor(Colors.White).font(fontFamily = "UnboundedBold", size = 24.).center().margin (8)


                Rectangle()
                    .strokeThickness(4.)
                    .stroke(Colors.Black)
                    .margin(-3)
                    .fillHorizontal()
                    .fillVertical()
                    .gestureRecognizers () {
                    PointerGestureRecognizer()
                        .onPointerPressed(fun _ -> animate true)
                        .onPointerReleased(fun _ -> animate false)
                        .onPointerExited (fun _ -> animate false)

                    TapGestureRecognizer(msg)
                }

            }
        }
