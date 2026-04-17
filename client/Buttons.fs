namespace Skrepka

open Avalonia.Media
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module Buttons =
    open Avalonia.Media.Transformation
    open System

    type ButtonPriority =
        | Primary
        | Secondary

    let private translate x y =
        let b = TransformOperations.CreateBuilder 1
        b.AppendTranslate(x, y)
        b.Build() :> ITransform

    let private shadowRect offset =
        Rectangle()
            .fill(SolidColorBrush(Colors.Black))
            .renderTransform(translate offset offset)
            .transition (
                TransformOperationsTransition(
                    Avalonia.Visual.RenderTransformProperty,
                    TimeSpan.FromMilliseconds Constants.animationDuration
                )
                    .easing (Constants.easing)
            )

    let private borderRect () =
        Rectangle().stroke(Colors.Black).strokeThickness (4.)

    let button priority (text: string) (msg: 'msg) =
        Component(text) {
            let! pressed = Context.State(false)
            let offset = if pressed.Current then 4. else 8.

            (Grid() {
                shadowRect offset

                Rectangle()
                    .fill (
                        match priority with
                        | Primary -> SolidColorBrush(Constants.accentColor)
                        | Secondary -> SolidColorBrush(Colors.White)
                    )

                TextBlock(text)
                    .foreground(
                        match priority with
                        | Primary -> SolidColorBrush(Colors.White)
                        | Secondary -> SolidColorBrush(Colors.Black)

                    )
                    .fontSize(24.)
                    .fontFamily(FontFamily(Constants.fontFamily))
                    .fontWeight(FontWeight.Bold)
                    .center()
                    .margin (8.)

                borderRect ()
            })
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .margin(16.)
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
                shadowRect offset

                Rectangle().fill (SolidColorBrush(Colors.White))

                match img with
                | None ->
                    ViewBox(
                        (VStack(32) {
                            Image("avares://Skrepka/Assets/Images/user.png", Stretch.Uniform)
                                .width(80.)
                                .margin (0., 20., 0., 0.)

                            Label("Upload")
                                .fontFamily(FontFamily(Constants.fontFamily))
                                .fontWeight(FontWeight.Bold)
                                .fontSize(24.)
                                .centerContentHorizontal ()
                        })
                    )
                        .margin (24.)

                | Some i ->
                    Image(Styles.cachedBitmap i, Stretch.UniformToFill)
                        .clipToBounds (true)

                borderRect ()
            })
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .width(200.)
                .height(200.)
                .margin(16.)
                .onTapped (fun _ -> msg)
        }

    let smallImageButton (img: byte[] option) (msg: 'msg) =
        let key =
            match img with
            | None -> "img-button"
            | Some i -> $"img-button-{hash i}"

        Component(key) {
            let! pressed = Context.State(false)
            let offset = if pressed.Current then 2. else 4.

            (Grid() {
                shadowRect offset

                Rectangle().fill (SolidColorBrush(Colors.White))

                match img with
                | None ->
                    ViewBox(
                        Image("avares://Skrepka/Assets/Images/user.png", Stretch.Uniform)
                            .width(32.)
                            .height(32.)
                            .margin (8.)
                    )

                | Some i ->
                    Image(Styles.cachedBitmap i, Stretch.UniformToFill)
                        .width(32.)
                        .height(32.)
                        .clipToBounds (true)

                borderRect ()
            })
                .width(48.)
                .height(48.)
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .margin(8.)
                .onTapped (fun _ -> msg)
        }

    let smallTextButton (text: string) (msg: 'msg) =
        Component($"small-button-{text}") {
            let! pressed = Context.State(false)
            let offset = if pressed.Current then 2. else 4.

            (Grid() {
                shadowRect offset

                Rectangle().fill (SolidColorBrush(Colors.White))

                TextBlock(text)
                    .fontFamily(Constants.fontFamily)
                    .fontWeight(FontWeight.Bold)
                    .fontSize(28.)
                    .textAlignment(TextAlignment.Center)
                    .center ()

                borderRect ()
            })
                .width(48.)
                .height(48.)
                .background(Brushes.Transparent)
                .onPointerPressed(fun _ -> pressed.Set true)
                .onPointerReleased(fun _ -> pressed.Set false)
                .onPointerExited(fun _ -> pressed.Set false)
                .margin(8.)
                .onTapped (fun _ -> msg)
        }
