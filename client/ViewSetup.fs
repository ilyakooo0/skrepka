namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewSetup =

    open AppTypes
    open Buttons

    let viewSetup () =
        (VStack(24.) {
            Image("avares://Skrepka/Assets/Images/logo.png", Avalonia.Media.Stretch.Uniform)
                .margin(8., 0., 8., 0.)
                .maxWidth (300.)

            TextBlock("Skrepka")
                .fontSize(32.)
                .fontFamily(FontFamily("avares://Skrepka/Assets/Fonts#Unbounded"))
                .fontWeight(FontWeight.Bold)
                .centerText ()

            TextBlock("").height (50.)

            button Primary "Next" GenIdentity
        })
            .margin(30.)
            .centerVertical ()
