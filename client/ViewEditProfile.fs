namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewEditProfile =

    open AppTypes
    open Buttons
    open TextFields

    let viewEditProfile model displayName bio (photo: byte[] option) =
        (Grid([], [ Dimension.Star; Dimension.Auto ]) {
            ScrollViewer(
                (VStack(16.) {
                    viewErrorBanner model.Error

                    imageButton photo DoPickPhoto

                    TextBlock("Name").fontFamily(Constants.fontFamily).fontWeight(FontWeight.Bold).margin (0, 24, 0, -8)
                    (textField displayName (fun text -> SetPage(EditProfile(text, bio, photo)))).margin (0, 0, 0, 8)


                    TextBlock("Bio").fontFamily(Constants.fontFamily).fontWeight(FontWeight.Bold).margin (0, 0, 0, -8)

                    (multilineTextField bio (fun text -> SetPage(EditProfile(displayName, text, photo))))
                        .margin (0, 0, 0, 8)
                })
                    .margin (20.)
            )
                .gridRow (0)

            Border(

                (HStack(8.) {
                    (button Secondary "back" (SetPage Settings)).margin (8.)

                    (button Secondary "save" DoSaveProfile).margin (8.)
                })
                    .background (Constants.accentColor)
            )
                .borderThickness(Avalonia.Thickness(0., 4., 0., 0.))
                .borderBrush(SolidColorBrush(Colors.Black))
                .gridRow (1)
        })
