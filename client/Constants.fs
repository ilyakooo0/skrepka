namespace Skrepka

open Avalonia.Media

module Constants =
    let accentColor = Color.FromRgb(98uy, 54uy, 255uy)
    let animationDuration: int64 = 60
    let easing = Avalonia.Animation.Easings.CubicEaseOut()
    let fontFamily = "avares://Skrepka/Assets/Fonts#Unbounded"
    let hkdfInfo = "skrepka-v1"
    let profileId = "me"
    let settingsId = "settings"
    let schemaVersion = 2
    let maxBitmapCacheSize = 128
    let pollRetryBaseMs = 3000
    let pollEmptyDelayMs = 5000
    let outboxRetryDelayMs = 3000
    let maxMessages = 200
    let blobVersion = 1uy
