namespace Skrepka


module Styles =
    open Avalonia
    open Avalonia.Controls
    open Avalonia.Controls.Presenters
    open Avalonia.Media
    open Avalonia.Styling
    open Fabulous
    open Fabulous.Avalonia

    open type Fabulous.Avalonia.View

    let style (selector: Selector -> Selector) (setters: Setter list) =
        let s = Style(selector)

        for setter in setters do
            s.Setters.Add(setter)

        s :> IStyle

    let withBottomBar (bar: WidgetBuilder<'msg, 'a>) (content: WidgetBuilder<'msg, 'b>) =
        Grid([], [ Dimension.Star; Dimension.Auto ]) {
            AnyView(content).gridRow (0)

            Border(AnyView(bar))
                .borderThickness(Avalonia.Thickness(0., 4., 0., 0.))
                .borderBrush(SolidColorBrush(Colors.Black))
                .background(Constants.accentColor)
                .gridRow (1)
        }

    let noListBoxPadding () =
        [ style
              _.OfType<ListBoxItem>()
              [ Setter(ListBoxItem.PaddingProperty, Thickness(0.))
                Setter(ListBoxItem.MinHeightProperty, box 0.) ]
          style
              (_.OfType<ListBoxItem>()
                  .Template()
                  .OfType<ContentPresenter>()
                  .Name("PART_ContentPresenter"))
              [ Setter(ContentPresenter.MarginProperty, Thickness(0.)) ] ]
