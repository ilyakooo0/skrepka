namespace Skrepka

open Avalonia.Layout
open Avalonia.Styling
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module ViewChat =

    open Store
    open AppTypes
    open Buttons
    open TextFields

    let private ensureMarchingAntsStyle =
        lazy
            (let s =
                Avalonia.Styling.Style(fun sel ->
                    sel.OfType<Avalonia.Controls.Shapes.Rectangle>().Class("marching"))

             let anim = Avalonia.Animation.Animation()
             anim.Duration <- System.TimeSpan.FromSeconds 3.
             anim.IterationCount <- Avalonia.Animation.IterationCount.Infinite
             anim.Easing <- Avalonia.Animation.Easings.LinearEasing()
             let kf1 = Avalonia.Animation.KeyFrame()

             kf1.Setters.Add(
                 Avalonia.Styling.Setter(Avalonia.Controls.Shapes.Shape.StrokeDashOffsetProperty, box 0.)
             )

             kf1.Cue <- Avalonia.Animation.Cue(0.)
             let kf2 = Avalonia.Animation.KeyFrame()

             kf2.Setters.Add(
                 Avalonia.Styling.Setter(Avalonia.Controls.Shapes.Shape.StrokeDashOffsetProperty, box 6.)
             )

             kf2.Cue <- Avalonia.Animation.Cue(1.)
             anim.Children.Add(kf1)
             anim.Children.Add(kf2)
             s.Animations.Add(anim)
             Avalonia.Application.Current.Styles.Add(s))

    let private scrollRef = Fabulous.ViewRef<Avalonia.Controls.ScrollViewer>()
    let mutable private lastMsgCount = 0
    let mutable private pageSize = 50
    let mutable private loadingMore = false
    let mutable private isAtBottom = true

    let private scrollToEnd () =
        Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(fun () ->
            match scrollRef.TryValue with
            | Some sv -> sv.ScrollToEnd()
            | None -> ()
        , Avalonia.Threading.DispatcherPriority.Background) |> ignore

    let private strokeTransition =
        DoubleTransition(Avalonia.Controls.Shapes.Shape.StrokeThicknessProperty, System.TimeSpan.FromMilliseconds 800.)

    let private messageItem m =
        let align, cols, col =
            match m.Direction with
            | Outgoing _ -> HorizontalAlignment.Right, [ Dimension.Stars 3.; Dimension.Stars 7. ], 1
            | Incoming -> HorizontalAlignment.Left, [ Dimension.Stars 7.; Dimension.Stars 3. ], 0

        Grid(cols, [ Dimension.Auto ]) {
            Border(
                (Grid() {
                    TextBlock(m.Body)
                        .fontSize(14.)
                        .fontFamily(Constants.fontFamily)
                        .fontWeight(Avalonia.Media.FontWeight.Bold)
                        .textWrapping(Avalonia.Media.TextWrapping.Wrap)
                        .padding (8.)

                    match m.Direction with
                    | Outgoing status ->
                        ensureMarchingAntsStyle.Force()
                        let isSent = status = DeliveryStatus.Sent

                        Rectangle()
                            .stroke(Avalonia.Media.Colors.Black)
                            .strokeThickness(4.)
                            .strokeDashArray([ 4.; 2. ])
                            .isHitTestVisible(false)
                            .classes("marching")

                        Rectangle()
                            .stroke(Avalonia.Media.Colors.Black)
                            .strokeThickness(if isSent then 0. else 4.)
                            .isHitTestVisible(false)
                            .transition (strokeTransition)
                    | Incoming ->
                        Rectangle()
                            .stroke(Avalonia.Media.Colors.Black)
                            .strokeThickness(4.)
                            .isHitTestVisible (false)
                }))
                .horizontalAlignment(align)
                .margin(4.)
                .gridColumn (col)
        }

    let viewChat model pk compose =
        let name = contactName model.Contacts pk
        let msgs = messagesFor pk model.Messages

        let bar =
            (Grid([ Dimension.Auto; Dimension.Star; Dimension.Auto ], [ Dimension.Auto ]) {
                (backButton (SetPage Conversations)).gridColumn (0)

                (textField "Message..." compose (fun text -> SetPage(Chat(pk, text))))
                    .margin(8.)
                    .gridColumn (1)

                (smallImageButton "avares://Skrepka/Assets/Images/send.png" DoSend).gridColumn (2)
            })
                .horizontalAlignment (HorizontalAlignment.Stretch)

        let content =
            (Grid([ Dimension.Star ], [ Dimension.Auto; Dimension.Auto; Dimension.Star ]) {
                TextBlock(name).fontSize(20.).padding(8.).gridRow (0)

                (viewErrorBanner model.Error).gridRow (1)

                (let msgView =
                    if msgs.IsEmpty then
                        lastMsgCount <- 0
                        pageSize <- 50
                        AnyView(TextBlock("No messages yet").padding(8.).fontSize (14.))
                    else
                        if msgs.Length <> lastMsgCount then
                            lastMsgCount <- msgs.Length
                            if isAtBottom then scrollToEnd ()

                        let skip = max 0 (msgs.Length - pageSize)
                        let visible = msgs |> List.skip skip

                        AnyView(
                            ScrollViewer(
                                VStack(0.) {
                                    for m in visible do
                                        messageItem m
                                })
                                .reference(scrollRef)
                                .onLoaded(fun _ ->
                                    pageSize <- 50
                                    loadingMore <- false
                                    isAtBottom <- true
                                    scrollToEnd ()
                                    DismissError)
                                .onScrollChanged(fun args ->
                                    let sv = args.Source :?> Avalonia.Controls.ScrollViewer
                                    isAtBottom <- sv.Offset.Y + sv.Viewport.Height >= sv.Extent.Height - 20.
                                    if sv.Offset.Y < 50. && not loadingMore && skip > 0 then
                                        loadingMore <- true
                                        let oldHeight = sv.Extent.Height
                                        pageSize <- min msgs.Length (pageSize + 50)
                                        Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(fun () ->
                                            match scrollRef.TryValue with
                                            | Some sv2 ->
                                                let newHeight = sv2.Extent.Height
                                                sv2.Offset <- Avalonia.Vector(0., sv2.Offset.Y + (newHeight - oldHeight))
                                                loadingMore <- false
                                            | None -> loadingMore <- false
                                        , Avalonia.Threading.DispatcherPriority.Background) |> ignore
                                    SetPage(Chat(pk, compose))))

                 msgView).gridRow (2)
            })

        Styles.withBottomBar bar content
