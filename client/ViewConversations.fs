namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewConversations =

    open AppTypes
    open Buttons
    open TextFields
    open Styles
    open Avalonia.Layout

    let viewConversations model =
        let contacts = model.Contacts.Values |> Seq.toList

        let content =
            if contacts.IsEmpty then
                AnyView(
                    TextBlock("No contacts yet. Tap + to add one.")
                        .centerText()
                        .foreground (SolidColorBrush(Colors.Gray))
                )
            else
                AnyView(
                    ListBox(
                        contacts,
                        fun c ->
                            let name = contactName model.Contacts c.Pubkey

                            let preview =
                                messagesFor c.Pubkey model.Messages
                                |> List.tryLast
                                |> Option.map (fun m -> if m.Body.Length > 40 then m.Body.[..39] + "..." else m.Body)
                                |> Option.defaultValue ""

                            Border(
                                (HStack(8.) {

                                    Grid() {
                                        (match c.Photo with
                                         | None -> Image("avares://Skrepka/Assets/Images/user.png", Stretch.Uniform)
                                         | Some i -> Image(cachedBitmap i, Stretch.UniformToFill))
                                            .width(16.)
                                            .height(16.)
                                            .margin(8.)
                                            .clipToBounds (true)

                                        Rectangle().stroke(Colors.Black).strokeThickness (4.)
                                    }

                                    VStack(2.) {
                                        TextBlock(name)
                                            .fontFamily(Constants.fontFamily)
                                            .fontWeight(FontWeight.Bold)
                                            .fontSize (16.)

                                        if preview <> "" then
                                            TextBlock(preview).fontSize(12.).fontWeight (FontWeight.Bold)
                                    }

                                })
                                    .margin (8.)
                            )
                                .borderThickness(Avalonia.Thickness(0., 0., 0., 4.))
                                .borderBrush(SolidColorBrush(Colors.Black))
                                .background(Colors.Transparent)
                                .onTapped (fun _ -> SetPage(Chat(c.Pubkey, "")))
                    )
                        .styles(noListBoxPadding ())
                        .background (Colors.White)
                )

        let bar =
            (Grid([ Dimension.Auto; Dimension.Star; Dimension.Auto ], [ Dimension.Auto ]) {
                (smallImageButton None (SetPage Settings)).gridColumn (0)
                (textField "" Search).margin(8.).verticalAlignment(VerticalAlignment.Stretch).gridColumn (1)
                (smallTextButton "+" (SetPage(AddContact("")))).gridColumn (2)
            })
                // .margin(20.)
                .horizontalAlignment (HorizontalAlignment.Stretch)

        withBottomBar bar content
