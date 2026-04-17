namespace Skrepka

open Avalonia.Media
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewSettings =

    open AppTypes

    let viewSettings model =
        ScrollViewer(
            (VStack(16.) {
                TextBlock("Settings").fontSize(24.).centerText ()

                match model.Auth with
                | Identified(id, conn) ->
                    TextBlock("Your Public Key:")

                    TextBlock(truncKey id.PubKeyHex).fontSize (14.)

                    Button("Copy Public Key", CopyPubKey)

                    TextBlock("Profile:").fontSize (18.)

                    let displayName, bio, photo =
                        match model.Profile with
                        | Some p -> p.DisplayName, p.Bio, p.Photo
                        | None -> "", "", None

                    if displayName <> "" then
                        TextBlock($"Name: {displayName}").fontSize (14.)

                    if bio <> "" then
                        TextBlock($"Bio: {bio}").fontSize(14.).foreground (SolidColorBrush(Colors.DimGray))

                    Button("Edit Profile", SetPage(EditProfile(displayName, bio, photo)))

                    TextBlock("Server:")

                    match conn with
                    | Online _ -> TextBlock(model.ServerUrl).fontSize (14.)
                    | _ -> TextBox(model.ServerUrl, SetServerUrl)

                    viewErrorBanner model.Error

                    match conn with
                    | Offline -> Button("Connect", DoConnect)
                    | Connecting -> TextBlock("Connecting...").centerText ()
                    | Online _ ->
                        Button("Disconnect", DoDisconnect)
                        Button("Go to Conversations", SetPage Conversations)
                | NoIdentity -> ()
            })
                .margin (20.)
        )
