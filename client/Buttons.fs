namespace Skrepka

open Avalonia.Media
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module Buttons =
    open Avalonia.Media.Transformation
    open System
    open Avalonia.Animation.Easings

    let private animationDuration: int64 = 60
    let private easing = CubicEaseOut()


    let private translate x y =
        let b = TransformOperations.CreateBuilder 1
        b.AppendTranslate(x, y)
        b.Build() :> ITransform

    let button (text: string) (msg: 'msg) =
        Component(text) {
            let! pressed = Context.State(false)
            let offset = if pressed.Current then 4. else 8.

            (Grid() {
                Rectangle()
                    .fill(SolidColorBrush(Colors.Black))
                    .renderTransform(translate offset offset)
                    .transition (
                        TransformOperationsTransition(
                            Avalonia.Visual.RenderTransformProperty,
                            TimeSpan.FromMilliseconds animationDuration
                        )
                            .easing (easing)
                    )

                Rectangle().fill (SolidColorBrush(Constants.accentColor))

                TextBlock(text)
                    .foreground(SolidColorBrush(Colors.White))
                    .fontSize(24.)
                    .fontFamily(FontFamily("avares://Skrepka/Assets/Fonts#Unbounded"))
                    .fontWeight(FontWeight.Bold)
                    .center()
                    .margin (8.)

                Rectangle().stroke(Colors.Black).strokeThickness (4.)
            })
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .onTapped (fun _ -> msg)
        }

    let imageButton (img: byte[] option) (msg: 'msg) =
        let key =
            match img with
            | None -> "img-button"
            | Some i -> $"img-button-{hash i}"

        Component(key) {
            let! pressed = Context.State(false)
            let offset = if pressed.Current then 4. else 8.

            (Grid() {
                Rectangle()
                    .fill(SolidColorBrush(Colors.Black))
                    .renderTransform(translate offset offset)
                    .transition (
                        TransformOperationsTransition(
                            Avalonia.Visual.RenderTransformProperty,
                            TimeSpan.FromMilliseconds animationDuration
                        )
                            .easing (easing)
                    )

                Rectangle().fill (SolidColorBrush(Colors.White))

                match img with
                | None ->
                    ViewBox(
                        (VStack(32) {
                            Image("avares://Skrepka/Assets/Images/user.png", Stretch.Uniform)
                                .width(80.)
                                .margin (0., 20., 0., 0.)

                            Label("Upload")
                                .fontFamily(FontFamily("avares://Skrepka/Assets/Fonts#Unbounded"))
                                .fontWeight(FontWeight.Bold)
                                .fontSize(24.)
                                .centerContentHorizontal ()
                        })
                    )
                        .margin (24.)

                | Some i ->
                    Image(new Avalonia.Media.Imaging.Bitmap(new System.IO.MemoryStream(i)), Stretch.UniformToFill)
                        .clipToBounds (true)

                Rectangle().stroke(Colors.Black).strokeThickness (4.)
            })
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .width(200.)
                .height(200.)
                .onTapped (fun _ -> msg)
        }
