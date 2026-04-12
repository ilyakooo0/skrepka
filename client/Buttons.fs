namespace Skrepka

open System
open System.IO
open System.Text.Json
open Fabulous
open Fabulous.Maui
open Microsoft.Maui.Graphics

open type Fabulous.Maui.View

module Buttons =
    let button text msg =
        Border(Label(text)).width(4).gestureRecognizers () { TapGestureRecognizer(msg) }
