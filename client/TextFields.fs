namespace Skrepka

open Avalonia.Media
open Fabulous
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module TextFields =
    open Avalonia.Layout
    open Avalonia.Styling

    let private whiteBg () =
        let bg = Avalonia.Media.Immutable.ImmutableSolidColorBrush(Colors.White)
        let setter = Setter(Avalonia.Controls.Border.BackgroundProperty, bg)

        [ Skrepka.Styles.style
              (_.OfType<Avalonia.Controls.TextBox>()
                  .Class(":pointerover")
                  .Template()
                  .OfType<Avalonia.Controls.Border>()
                  .Name("PART_BorderElement"))
              [ setter ]
          Skrepka.Styles.style
              (_.OfType<Avalonia.Controls.TextBox>()
                  .Class(":focus")
                  .Template()
                  .OfType<Avalonia.Controls.Border>()
                  .Name("PART_BorderElement"))
              [ setter ] ]

    let textField value msg =
        (Grid() {
            TextBox(value, msg).fontFamily(Constants.fontFamily).verticalAlignment(VerticalAlignment.Stretch).verticalContentAlignment(VerticalAlignment.Center).background(SolidColorBrush(Colors.White))
            Rectangle().stroke(Colors.Black).strokeThickness (4.)
        }).styles (whiteBg ())

    let multilineTextField value msg =
        Grid() {
            TextBox(value, msg).fontFamily(Constants.fontFamily).acceptsReturn(true).height (150)
            Rectangle().stroke(Colors.Black).strokeThickness (4.)
        }
