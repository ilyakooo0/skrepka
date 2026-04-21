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
        let contacts =
            model.Contacts.Values
            |> Seq.toList
            |> List.sortBy (fun c ->
                messagesFor c.Pubkey model.Messages
                |> List.tryLast
                |> Option.map (fun m -> m.Timestamp)
                |> Option.defaultValue c.AddedDate)

        let content =
            if contacts.IsEmpty then
                AnyView(
                    TextBlock("No contacts yet. Tap + to add one.")
                        .centerText()
                        .foreground (SolidColorBrush(Colors.Gray))
                )
            else
                AnyView(
                    ScrollViewer(
                        VStack(0.) {
                            for c in contacts do
                                let name = contactName model.Contacts c.Pubkey

                                let preview =
                                    messagesFor c.Pubkey model.Messages
                                    |> List.tryLast
                                    |> Option.map (fun m ->
                                        if m.Body.Length > 40 then m.Body.[..39] + "..." else m.Body)
                                    |> Option.defaultValue ""

                                Border(
                                    (HStack(8.) {

                                        (Grid() {
                                            (match c.Photo with
                                             | None ->
                                                 Image("avares://Skrepka/Assets/Images/user.png", Stretch.Uniform)
                                                     .margin (8.)
                                             | Some i -> Image(cachedBitmap i, Stretch.UniformToFill))
                                                .clipToBounds (true)

                                            Rectangle().stroke(Colors.Black).strokeThickness (4.)
                                        })
                                            .width(40.)
                                            .height (40.)

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
                        }
                    )
                        .background(Colors.White)
                        .verticalAlignment (VerticalAlignment.Bottom)
                )

        let bar =
            VStack(0.) {
                TextBlock($"{connStatusLabel model.Auth} | {model.PollStatus}")
                    .fontSize(10.)
                    .foreground(SolidColorBrush(Colors.Gray))
                    .centerText ()

                (Grid([ Dimension.Auto; Dimension.Star; Dimension.Auto ], [ Dimension.Auto ]) {
                    (smallImageButton "avares://Skrepka/Assets/Images/user.png" (SetPage Settings)).gridColumn (0)
                    (textField "" "" Search).margin(8.).verticalAlignment(VerticalAlignment.Stretch).gridColumn (1)
                    (smallTextButton "+" (SetPage(AddContact("")))).gridColumn (2)
                })
                    .horizontalAlignment (HorizontalAlignment.Stretch)
            }

        withBottomBar bar content
