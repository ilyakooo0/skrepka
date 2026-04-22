namespace Skrepka

module Keyboard =
    let private evt = Event<float>()
    let heightChanged = evt.Publish
    let triggerHeightChanged h = evt.Trigger h

module SafeArea =
    let private evt = Event<float * float>()
    let insetsChanged = evt.Publish
    let triggerInsetsChanged (top, bottom) = evt.Trigger(top, bottom)
