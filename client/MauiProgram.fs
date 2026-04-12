namespace Skrepka

open Microsoft.Maui.Hosting
open Fabulous.Maui

type MauiProgram =
    static member CreateMauiApp() =
        MauiApp
            .CreateBuilder()
            .UseFabulousApp(App.program)
            .ConfigureFonts(fun fonts ->
                fonts
                    .AddFont("OpenSans-Regular.ttf", "OpenSansRegular")
                    .AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold")
                    .AddFont("Unbounded-SemiBold.ttf", "UnboundedSemiBold")
                    .AddFont("Unbounded-Black.ttf", "UnboundedBlack")
                    .AddFont("Unbounded-Bold.ttf", "UnboundedBold")
                    .AddFont("Unbounded-ExtraBold.ttf", "UnboundedExtraBold")
                    .AddFont("Unbounded-ExtraLight.ttf", "UnboundedExtraLight")
                    .AddFont("Unbounded-Light.ttf", "UnboundedLight")
                    .AddFont("Unbounded-Medium.ttf", "UnboundedMedium")
                    .AddFont("Unbounded-Regular.ttf", "UnboundedRegular")
                |> ignore)
            .Build()
