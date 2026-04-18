namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewChat =

    open Store
    open AppTypes

    let viewChat model pk compose =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        (VStack(8.) {
            HStack(8.) {
                Image("avares://Skrepka/Assets/Images/left.png", Stretch.Uniform)
                    .width(24.)
                    .height(24.)
                    .onTapped (fun _ -> SetPage Conversations)

                TextBlock(name).fontSize(20.).centerVertical ()
            }

            viewErrorBanner model.Error

            ScrollViewer(
                VStack(4.) {
                    if msgs.IsEmpty then
                        TextBlock("No messages yet").padding(8.).fontSize (14.)
                    else
                        for m in msgs do
                            let prefix, tick =
                                match m.Direction with
                                | Outgoing DeliveryStatus.Delivered -> "You: ", " \u2713"
                                | Outgoing DeliveryStatus.Sent -> "You: ", ""
                                | Incoming -> "", ""

                            TextBlock($"{prefix}{m.Body}{tick}").padding(8.).fontSize (14.)
                }
            )

            HStack(8.) {
                TextBox(compose, fun text -> SetPage(Chat(pk, text)))
                    .watermark("Message...")
                    .horizontalAlignment (Avalonia.Layout.HorizontalAlignment.Stretch)

                Button("Send", DoSend)
            }
        })
            .margin (12.)
