namespace Skrepka

open Avalonia.Layout
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewChat =

    open Store
    open AppTypes
    open Buttons

    let viewChat model pk compose =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        (Grid([ Dimension.Auto; Dimension.Auto; Dimension.Star; Dimension.Auto ], [ Dimension.Star ]) {
            (HStack(8.) {
                backButton (SetPage Conversations)

                TextBlock(name).fontSize(20.).centerVertical ()
            })
                .gridRow (0)

            (viewErrorBanner model.Error).gridRow (1)

            (if msgs.IsEmpty then
                 AnyView(TextBlock("No messages yet").padding(8.).fontSize (14.))
             else
                 let reversed = List.rev msgs

                 AnyView(
                     ScrollViewer(
                         ItemsRepeater(reversed, fun m ->
                             let prefix, tick =
                                 match m.Direction with
                                 | Outgoing DeliveryStatus.Delivered -> "You: ", " \u2713"
                                 | Outgoing DeliveryStatus.Sent -> "You: ", ""
                                 | Incoming -> "", ""

                             TextBlock($"{prefix}{m.Body}{tick}").padding(8.).fontSize (14.))
                     )
                 ))
                .gridRow (2)

            (HStack(8.) {
                TextBox(compose, fun text -> SetPage(Chat(pk, text)))
                    .watermark("Message...")
                    .horizontalAlignment (HorizontalAlignment.Stretch)

                Button("Send", DoSend)
            })
                .gridRow (3)
        })
            .margin (12.)
