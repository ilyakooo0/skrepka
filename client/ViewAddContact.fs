namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewAddContact =

    open AppTypes
    open Buttons
    open Styles
    open Labels
    open TextFields

    let private qrBytes (text: string) =
        use qr = new QRCoder.QRCodeGenerator()
        use data = qr.CreateQrCode(text, QRCoder.QRCodeGenerator.ECCLevel.M)
        use png = new QRCoder.PngByteQRCode(data)
        png.GetGraphic(8, [| 0uy; 0uy; 0uy |], [| 255uy; 255uy; 255uy |])

    let viewAddContact model (cpk: string) =
        let content =
            ScrollViewer(
                (VStack(16.) {

                    h2 ("Share your address")

                    match model.Auth with
                    | Identified(id, _) ->
                        let ob = hexToOb id.PubKeyHex

                        Image(Styles.cachedBitmap (qrBytes ob), Stretch.Uniform).maxWidth(200.).centerHorizontal ()

                        body(ob).fontSize(12.).centerText ()

                        smallButton Primary "Copy Address" CopyPubKey
                    | NoIdentity -> ()

                    h2 "Enter someone else's address"

                    let cpkTrimmed: string = cpk.Trim()

                    let isValid =
                        Phonemic.fromOb cpkTrimmed
                        |> Option.orElseWith (fun () -> Crypto.tryFromHex cpkTrimmed)
                        |> Option.filter (fun bytes -> bytes.Length = 32)
                        |> Option.isSome

                    let hasError = cpkTrimmed <> "" && not isValid

                    if hasError then
                        errorTextField cpk (fun key -> SetPage(AddContact(key)))
                    else
                        textField cpk (fun key -> SetPage(AddContact(key)))


                    if isValid then
                        smallButton Primary "Add" DoSaveContact
                    else
                        disabledSmallButton Primary "Add" DoSaveContact
                })
                    .margin (20.)
            )

        let bar = HStack(8.) { backButton (SetPage Conversations) }

        withBottomBar bar content
