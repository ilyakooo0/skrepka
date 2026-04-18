namespace Skrepka

module Keyboard =
    let private evt = Event<float>()
    let heightChanged = evt.Publish
    let triggerHeightChanged h = evt.Trigger h
