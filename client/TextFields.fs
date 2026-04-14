namespace Skrepka

open Avalonia.Media
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module TextFields =
    let textField value msg =
        Grid() {
            TextBox(value, msg).fontFamily (Constants.fontFamily)
            Rectangle().stroke(Colors.Black).strokeThickness (4.)
        }

    let multilineTextField value msg =
        Grid() {
            TextBox(value, msg).fontFamily(Constants.fontFamily).acceptsReturn(true).height (150)
            Rectangle().stroke(Colors.Black).strokeThickness (4.)
        }
