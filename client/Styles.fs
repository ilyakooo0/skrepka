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

    let private maxBitmapCacheSize = 128

    let private bitmapCache =
        System.Collections.Concurrent.ConcurrentDictionary<int, Avalonia.Media.Imaging.Bitmap>()

    let cachedBitmap (bytes: byte[]) =
        let h =
            System.HashCode.Combine(
                bytes.Length,
                (if bytes.Length > 3 then System.BitConverter.ToInt32(bytes, 0) else 0),
                (if bytes.Length > 7 then System.BitConverter.ToInt32(bytes, bytes.Length / 2) else 0),
                (if bytes.Length > 11 then System.BitConverter.ToInt32(bytes, bytes.Length - 4) else 0))

        if bitmapCache.Count >= maxBitmapCacheSize then
            bitmapCache.Clear()

        bitmapCache.GetOrAdd(h, fun _ ->
            new Avalonia.Media.Imaging.Bitmap(new System.IO.MemoryStream(bytes)))
