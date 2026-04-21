namespace Skrepka

open Avalonia.Layout
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewChat =

    open Store
    open AppTypes
    open Buttons
    open TextFields

    let viewChat model pk compose =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        let bar =
            (Grid([ Dimension.Auto; Dimension.Star; Dimension.Auto ], [ Dimension.Auto ]) {
                (backButton (SetPage Conversations)).gridColumn (0)

                (textField compose (fun text -> SetPage(Chat(pk, text))))
                    .verticalAlignment(VerticalAlignment.Stretch)
                    .margin(8.)
                    .gridColumn (1)

                (smallButton Primary "Send" DoSend).gridColumn (2)
            })
                .horizontalAlignment (HorizontalAlignment.Stretch)

        let content =
            (Grid([ Dimension.Star ], [ Dimension.Auto; Dimension.Auto; Dimension.Star ]) {
                TextBlock(name).fontSize(20.).padding(8.).gridRow (0)

                (viewErrorBanner model.Error).gridRow (1)

                (if msgs.IsEmpty then
                     AnyView(TextBlock("No messages yet").padding(8.).fontSize (14.))
                 else
                     let layout = Avalonia.Layout.StackLayout()
                     layout.DisableVirtualization <- true

                     AnyView(
                         ScrollViewer(
                             ItemsRepeater(msgs, fun m ->
                                 let tick =
                                     match m.Direction with
                                     | Outgoing DeliveryStatus.Delivered -> " ✓"
                                     | Outgoing DeliveryStatus.Sent -> ""
                                     | Incoming -> ""

                                 let align =
                                     match m.Direction with
                                     | Incoming -> HorizontalAlignment.Right
                                     | Outgoing _ -> HorizontalAlignment.Left

                                 Border(
                                     TextBlock($"{m.Body}{tick}")
                                         .fontSize(14.)
                                         .padding (8.))
                                     .borderThickness(Avalonia.Thickness(2.))
                                     .borderBrush(Avalonia.Media.SolidColorBrush(Avalonia.Media.Colors.Black))
                                     .horizontalAlignment(align)
                                     .margin (4.))
                                 .layout(layout)
                         )
                             .horizontalScrollBarVisibility(Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled)
                             .offset(Avalonia.Vector(0., System.Double.MaxValue))))
                    .gridRow (2)
            })

        Styles.withBottomBar bar content
