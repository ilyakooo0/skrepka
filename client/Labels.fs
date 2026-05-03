namespace Skrepka

open Avalonia.Media
open Avalonia.Media.TextFormatting
open Fabulous.Avalonia

open type Fabulous.Avalonia.View

module Labels =
    let private label size text =
        TextBlock(text)
            .fontFamily(FontFamily(Constants.fontFamily))
            .fontWeight(FontWeight.Bold)
            .fontSize(size)
            .textWrapping (TextWrapping.Wrap)

    let h1 text = label 32. text
    let h2 text = label 24. text
    let h3 text = label 20. text
    let h4 text = label 16. text
    let h5 text = label 14. text

    let body text =
        label 14. text |> _.fontWeight(FontWeight.Normal)

    let caption text =
        label 12. text |> _.fontWeight(FontWeight.Normal)
