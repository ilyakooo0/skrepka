namespace Skrepka

open Avalonia.Media
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module Buttons =

    let button (text: string) (msg: 'msg) =
        let shadowRef = ViewRef<Avalonia.Controls.Shapes.Rectangle>()

        let animate pressed =
            match shadowRef.TryValue with
            | None -> ()
            | Some c ->
                let offset = if pressed then 4. else 12.
                match c.RenderTransform with
                | :? TranslateTransform as t ->
                    t.X <- offset
                    t.Y <- offset
                | _ ->
                    c.RenderTransform <- TranslateTransform(offset, offset)

        Component(text) {
            Grid() {
                Rectangle()
                    .reference(shadowRef)
                    .fill(SolidColorBrush(Colors.Black))
                    .renderTransform (TranslateTransform(12., 12.))

                Rectangle().fill (SolidColorBrush(Constants.accentColor))

                TextBlock(text)
                    .foreground(SolidColorBrush(Colors.White))
                    .fontSize(24.)
                    .fontFamily(FontFamily("avares://Skrepka/Assets/Fonts#Unbounded"))
                    .fontWeight(FontWeight.Bold)
                    .center()
                    .margin (8.)

                Button(msg, Rectangle().strokeThickness(4.).stroke(SolidColorBrush(Colors.Black)).margin (-3.))
                    .onPointerPressed(fun _ -> animate true)
                    .onPointerReleased(fun _ -> animate false)
                    .onPointerExited(fun _ -> animate false)
                    .background(Brushes.Transparent)
                    .borderThickness(0.)
                    .padding(0.)
                    .horizontalAlignment(Avalonia.Layout.HorizontalAlignment.Stretch)
                    .verticalAlignment (Avalonia.Layout.VerticalAlignment.Stretch)
            }
        }
