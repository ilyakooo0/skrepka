namespace Skrepka

open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewAddContact =

    open AppTypes

    let viewAddContact model cpk cnn =
        (VStack(16.) {
            HStack(8.) {
                Button("< Back", SetPage Conversations)

                TextBlock("Add Contact").fontSize (20.)
            }

            viewErrorBanner model.Error

            TextBlock("Public Key:")
            TextBox(cpk, fun text -> SetPage(AddContact(text, cnn))).watermark ("sampel-palnet-...")

            TextBlock("Nickname:")
            TextBox(cnn, fun text -> SetPage(AddContact(cpk, text)))

            Button("Save Contact", DoSaveContact).centerHorizontal ()
        })
            .margin (20.)
