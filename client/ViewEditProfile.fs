namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewEditProfile =

    open AppTypes
    open Buttons
    open TextFields
    open Styles

    let viewEditProfile model displayName bio (photo: byte[] option) =
        let content =
            ScrollViewer(
                (VStack(16.) {
                    viewErrorBanner model.Error

                    imageButton photo DoPickPhoto

                    TextBlock("Name").fontFamily(Constants.fontFamily).fontWeight(FontWeight.Bold).margin (0, 24, 0, -8)
                    (textField "" displayName (fun text -> SetPage(EditProfile(text, bio, photo)))).margin (0, 0, 0, 8)


                    TextBlock("Bio").fontFamily(Constants.fontFamily).fontWeight(FontWeight.Bold).margin (0, 0, 0, -8)

                    (multilineTextField bio (fun text -> SetPage(EditProfile(displayName, text, photo))))
                        .margin (0, 0, 0, 8)
                })
                    .margin (20.)
            )

        let bar =
            HStack(8.) {
                backButton (SetPage Settings)
                (button Secondary "save" DoSaveProfile).margin (8.)
            }

        withBottomBar model.SafeAreaBottom bar content
