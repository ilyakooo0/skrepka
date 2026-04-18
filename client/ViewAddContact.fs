namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewAddContact =

    open AppTypes
    open Buttons
    open Styles

    let private qrBytes (text: string) =
        use qr = new QRCoder.QRCodeGenerator()
        use data = qr.CreateQrCode(text, QRCoder.QRCodeGenerator.ECCLevel.M)
        use png = new QRCoder.PngByteQRCode(data)
        png.GetGraphic(8, [| 0uy; 0uy; 0uy |], [| 255uy; 255uy; 255uy |])

    let viewAddContact model cpk cnn =
        let content =
            ScrollViewer(
                (VStack(16.) {
                    match model.Auth with
                    | Identified(id, _) ->
                        let ob = hexToOb id.PubKeyHex

                        TextBlock("Your key (share with contact):").foreground (SolidColorBrush(Colors.DimGray))

                        Image(Styles.cachedBitmap (qrBytes ob), Stretch.Uniform)
                            .maxWidth(200.)
                            .centerHorizontal ()

                        TextBlock(truncKey id.PubKeyHex)
                            .fontSize(12.)
                            .foreground(SolidColorBrush(Colors.DimGray))
                            .centerText ()
                    | NoIdentity -> ()

                    viewErrorBanner model.Error

                    TextBlock("Public Key:")
                    TextBox(cpk, fun text -> SetPage(AddContact(text, cnn))).watermark ("sampel-palnet-...")

                    TextBlock("Nickname:")
                    TextBox(cnn, fun text -> SetPage(AddContact(cpk, text)))

                    Button("Save Contact", DoSaveContact).centerHorizontal ()
                })
                    .margin (20.)
            )

        let bar =
            HStack(8.) {
                backButton (SetPage Conversations)
            }

        withBottomBar bar content
