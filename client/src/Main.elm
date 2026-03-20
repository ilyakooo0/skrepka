module Main exposing (main)

{-| Skrepka – Decentralized encrypted messaging client.

    Built with LynxJS-Elm for native iOS/Android.
    Implements the Skrepka protocol v0.1 for E2E encrypted messaging.

    Crypto: Ed25519 signing, X25519 key agreement, XChaCha20-Poly1305 AEAD.
    Uses raw X25519 shared secret as cipher key (HKDF not yet available).

-}

import Browser
import Crypto.Cipher as Cipher
import Crypto.Ed25519 as Ed
import Crypto.X25519 as X
import Dict exposing (Dict)
import Http
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode
import Lynx
import Lynx.Attributes as Attr
    exposing
        ( Alignment(..)
        , FlexDirection(..)
        , FontWeight(..)
        , ScrollDirection(..)
        , TextAlign(..)
        )
import Lynx.Events exposing (onInput, onTap)
import Random
import Set exposing (Set)
import Time



-- ============================================================================
-- MAIN
-- ============================================================================


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- ============================================================================
-- MODEL
-- ============================================================================


type alias Model =
    { edPriv : Maybe Ed.PrivateKey
    , edPub : Maybe Ed.PublicKey
    , xPriv : Maybe X.PrivateKey
    , xPub : Maybe X.PublicKey
    , serverUrl : String
    , authToken : String
    , screen : Screen
    , contacts : Dict String Contact
    , messages : Dict String (List ChatMessage)
    , seenIds : Set String
    , draft : String
    , activeChat : String
    , addIdentity : String
    , addName : String
    , displayName : String
    , currentTime : Int
    , error : Maybe String
    , connecting : Bool
    , sending : Bool
    }


type Screen
    = SetupScreen
    | ContactsScreen
    | ChatScreen
    | AddContactScreen


type alias Contact =
    { edPubHex : String
    , xPubHex : String
    , name : String
    , lastMessage : String
    , lastTime : Int
    , online : Bool
    }


type alias ChatMessage =
    { id : String
    , body : String
    , timestamp : Int
    , outgoing : Bool
    }



-- ============================================================================
-- INIT
-- ============================================================================


init : () -> ( Model, Cmd Msg )
init _ =
    ( { edPriv = Nothing
      , edPub = Nothing
      , xPriv = Nothing
      , xPub = Nothing
      , serverUrl = "http://localhost:8080"
      , authToken = ""
      , screen = SetupScreen
      , contacts = Dict.empty
      , messages = Dict.empty
      , seenIds = Set.empty
      , draft = ""
      , activeChat = ""
      , addIdentity = ""
      , addName = ""
      , displayName = ""
      , currentTime = 0
      , error = Nothing
      , connecting = False
      , sending = False
      }
    , Random.generate GotSeed (randomHexString 32)
    )



-- ============================================================================
-- MSG
-- ============================================================================


type Msg
    = GotSeed String
    | GotTime Time.Posix
      -- Auth
    | Connect
    | GotChallenge (Result Http.Error ChallengeResponse)
    | GotVerify (Result Http.Error VerifyResponse)
      -- Messaging
    | PrepareSend
    | GotSendEntropy String
    | GotSendResult (Result Http.Error SendResponse)
      -- Polling
    | PollTick Time.Posix
    | GotPoll (Result Http.Error PollResponse)
    | GotAck (Result Http.Error Bool)
      -- Contacts
    | AddContact
    | GotLookup (Result Http.Error LookupResponse)
      -- Navigation
    | Navigate Screen
    | OpenChat String
      -- Input
    | UpdateDraft String
    | UpdateServerUrl String
    | UpdateAddIdentity String
    | UpdateAddName String
    | UpdateDisplayName String
      -- Error
    | DismissError



-- ============================================================================
-- UPDATE
-- ============================================================================


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        GotSeed seedHex ->
            let
                edPriv =
                    Ed.privateKeyFromHex seedHex

                xPriv =
                    X.privateKeyFromHex seedHex
            in
            ( { model
                | edPriv = edPriv
                , edPub = Maybe.map Ed.getPublicKey edPriv
                , xPriv = xPriv
                , xPub = Maybe.map X.getPublicKey xPriv
              }
            , Cmd.none
            )

        GotTime posix ->
            ( { model | currentTime = Time.posixToMillis posix // 1000 }, Cmd.none )

        -- AUTH ----------------------------------------------------------------

        Connect ->
            case model.edPub of
                Just pub ->
                    ( { model | connecting = True, error = Nothing }
                    , requestChallenge model.serverUrl (Ed.publicKeyToHex pub)
                    )

                Nothing ->
                    ( { model | error = Just "No identity keypair" }, Cmd.none )

        GotChallenge result ->
            case ( result, model.edPriv ) of
                ( Ok resp, Just priv ) ->
                    let
                        sig =
                            Ed.sign resp.challenge priv
                    in
                    ( model
                    , verifyAuth model.serverUrl
                        (Maybe.withDefault "" (Maybe.map Ed.publicKeyToHex model.edPub))
                        resp.challenge
                        (Ed.signatureToHex sig)
                    )

                ( Err err, _ ) ->
                    ( { model | connecting = False, error = Just (httpErrorToString err) }
                    , Cmd.none
                    )

                _ ->
                    ( { model | connecting = False }, Cmd.none )

        GotVerify result ->
            case result of
                Ok resp ->
                    if resp.token /= "" then
                        ( { model
                            | authToken = resp.token
                            , connecting = False
                            , screen = ContactsScreen
                          }
                        , Cmd.none
                        )

                    else
                        ( { model
                            | connecting = False
                            , error = Just "Authentication failed"
                          }
                        , Cmd.none
                        )

                Err err ->
                    ( { model | connecting = False, error = Just (httpErrorToString err) }
                    , Cmd.none
                    )

        -- MESSAGING -----------------------------------------------------------

        PrepareSend ->
            if String.isEmpty (String.trim model.draft) then
                ( model, Cmd.none )

            else
                ( { model | sending = True }
                  -- 16 bytes msg ID + 32 bytes ephemeral X25519 key + 24 bytes nonce = 72
                , Random.generate GotSendEntropy (randomHexString 72)
                )

        GotSendEntropy entropyHex ->
            case ( model.edPriv, model.edPub ) of
                ( Just edPriv, Just edPub ) ->
                    let
                        recipientEdHex =
                            model.activeChat

                        contact =
                            Dict.get recipientEdHex model.contacts
                    in
                    case contact of
                        Just c ->
                            let
                                msgId =
                                    String.left 32 entropyHex

                                ephSeedHex =
                                    String.slice 32 96 entropyHex

                                nonceHex =
                                    String.slice 96 144 entropyHex

                                timestamp =
                                    model.currentTime

                                plaintextJson =
                                    Encode.encode 0
                                        (Encode.object
                                            [ ( "type", Encode.string "text" )
                                            , ( "id", Encode.string msgId )
                                            , ( "timestamp", Encode.int timestamp )
                                            , ( "body", Encode.string model.draft )
                                            ]
                                        )

                                blob =
                                    encryptMessage edPriv edPub c.xPubHex ephSeedHex nonceHex plaintextJson

                                outMsg =
                                    { id = msgId
                                    , body = model.draft
                                    , timestamp = timestamp
                                    , outgoing = True
                                    }

                                existing =
                                    Dict.get recipientEdHex model.messages
                                        |> Maybe.withDefault []
                            in
                            case blob of
                                Just blobHex ->
                                    ( { model
                                        | draft = ""
                                        , messages =
                                            Dict.insert recipientEdHex
                                                (existing ++ [ outMsg ])
                                                model.messages
                                      }
                                    , sendMessageHttp model.serverUrl
                                        model.authToken
                                        recipientEdHex
                                        blobHex
                                        timestamp
                                    )

                                Nothing ->
                                    ( { model
                                        | sending = False
                                        , error = Just "Encryption failed"
                                      }
                                    , Cmd.none
                                    )

                        Nothing ->
                            ( { model | sending = False, error = Just "Contact not found" }
                            , Cmd.none
                            )

                _ ->
                    ( { model | sending = False, error = Just "No identity" }, Cmd.none )

        GotSendResult result ->
            case result of
                Ok _ ->
                    ( { model | sending = False }, Cmd.none )

                Err err ->
                    ( { model | sending = False, error = Just (httpErrorToString err) }
                    , Cmd.none
                    )

        -- POLLING -------------------------------------------------------------

        PollTick posix ->
            let
                t =
                    Time.posixToMillis posix // 1000
            in
            if model.authToken /= "" then
                ( { model | currentTime = t }
                , pollMessages model.serverUrl model.authToken
                )

            else
                ( { model | currentTime = t }, Cmd.none )

        GotPoll result ->
            case ( result, model.xPriv, model.edPub ) of
                ( Ok resp, Just xPriv, Just edPub ) ->
                    let
                        myEdHex =
                            Ed.publicKeyToHex edPub

                        ( newMessages, newSeenIds, ackIds ) =
                            processEvents xPriv myEdHex resp.events model.seenIds

                        updatedMessages =
                            List.foldl
                                (\( from, chatMsg ) dict ->
                                    let
                                        existing =
                                            Dict.get from dict |> Maybe.withDefault []
                                    in
                                    Dict.insert from (existing ++ [ chatMsg ]) dict
                                )
                                model.messages
                                newMessages

                        updatedContacts =
                            List.foldl
                                (\( from, chatMsg ) dict ->
                                    Dict.update from
                                        (\existing ->
                                            case existing of
                                                Just c ->
                                                    Just
                                                        { c
                                                            | lastMessage = chatMsg.body
                                                            , lastTime = chatMsg.timestamp
                                                        }

                                                Nothing ->
                                                    Just
                                                        { edPubHex = from
                                                        , xPubHex = ""
                                                        , name = String.left 8 from ++ "..."
                                                        , lastMessage = chatMsg.body
                                                        , lastTime = chatMsg.timestamp
                                                        , online = True
                                                        }
                                        )
                                        dict
                                )
                                model.contacts
                                newMessages

                        ackCmd =
                            if List.isEmpty ackIds then
                                Cmd.none

                            else
                                ackMessages model.serverUrl model.authToken ackIds
                    in
                    ( { model
                        | messages = updatedMessages
                        , seenIds = newSeenIds
                        , contacts = updatedContacts
                      }
                    , ackCmd
                    )

                ( Err (Http.BadStatus 401), _, _ ) ->
                    ( { model
                        | authToken = ""
                        , screen = SetupScreen
                        , error = Just "Session expired, please reconnect"
                      }
                    , Cmd.none
                    )

                _ ->
                    ( model, Cmd.none )

        GotAck _ ->
            ( model, Cmd.none )

        -- CONTACTS ------------------------------------------------------------

        AddContact ->
            if String.isEmpty model.addIdentity then
                ( model, Cmd.none )

            else
                case parseIdentity model.addIdentity of
                    Just ( edHex, xHex ) ->
                        let
                            name =
                                if String.isEmpty model.addName then
                                    String.left 8 edHex ++ "..."

                                else
                                    model.addName

                            contact =
                                { edPubHex = edHex
                                , xPubHex = xHex
                                , name = name
                                , lastMessage = ""
                                , lastTime = 0
                                , online = False
                                }
                        in
                        ( { model
                            | contacts = Dict.insert edHex contact model.contacts
                            , addIdentity = ""
                            , addName = ""
                            , screen = ContactsScreen
                          }
                        , lookupPresence model.serverUrl edHex
                        )

                    Nothing ->
                        ( { model | error = Just "Invalid identity. Expected: <ed25519_hex>.<x25519_hex>" }
                        , Cmd.none
                        )

        GotLookup result ->
            case result of
                Ok resp ->
                    ( { model
                        | contacts =
                            Dict.update resp.pubkey
                                (Maybe.map (\c -> { c | online = resp.online }))
                                model.contacts
                      }
                    , Cmd.none
                    )

                Err _ ->
                    ( model, Cmd.none )

        -- NAVIGATION ----------------------------------------------------------

        Navigate screen ->
            ( { model | screen = screen }, Cmd.none )

        OpenChat edPubHex ->
            ( { model | screen = ChatScreen, activeChat = edPubHex, draft = "" }, Cmd.none )

        -- INPUT ---------------------------------------------------------------

        UpdateDraft text ->
            ( { model | draft = text }, Cmd.none )

        UpdateServerUrl text ->
            ( { model | serverUrl = text }, Cmd.none )

        UpdateAddIdentity text ->
            ( { model | addIdentity = text }, Cmd.none )

        UpdateAddName text ->
            ( { model | addName = text }, Cmd.none )

        UpdateDisplayName text ->
            ( { model | displayName = text }, Cmd.none )

        -- ERROR ---------------------------------------------------------------

        DismissError ->
            ( { model | error = Nothing }, Cmd.none )



-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ if model.authToken /= "" then
            Time.every 3000 PollTick

          else
            Sub.none
        , Time.every 60000 GotTime
        ]



-- ============================================================================
-- VIEW
-- ============================================================================


view : Model -> Lynx.Node Msg
view model =
    Lynx.view
        [ Attr.flexDirection Column
        , Attr.flex 1
        , Attr.backgroundColor "#0d1117"
        ]
        [ case model.error of
            Just err ->
                errorBanner err

            Nothing ->
                Lynx.view [] []
        , case model.screen of
            SetupScreen ->
                viewSetup model

            ContactsScreen ->
                viewContacts model

            ChatScreen ->
                viewChat model

            AddContactScreen ->
                viewAddContact model
        ]



-- Error Banner ----------------------------------------------------------------


errorBanner : String -> Lynx.Node Msg
errorBanner err =
    Lynx.view
        [ onTap DismissError
        , Attr.backgroundColor "#3d1114"
        , Attr.paddingTop 10
        , Attr.paddingBottom 10
        , Attr.paddingLeft 16
        , Attr.paddingRight 16
        , Attr.flexDirection Row
        , Attr.alignItems Center
        ]
        [ Lynx.text [ Attr.color "#f85149", Attr.fontSize 14, Attr.flex 1 ]
            [ Lynx.textContent err ]
        , Lynx.text [ Attr.color "#f85149", Attr.fontSize 16 ]
            [ Lynx.textContent "x" ]
        ]



-- Setup Screen ----------------------------------------------------------------


viewSetup : Model -> Lynx.Node Msg
viewSetup model =
    let
        identityStr =
            case ( model.edPub, model.xPub ) of
                ( Just edP, Just xP ) ->
                    Ed.publicKeyToHex edP ++ "." ++ X.publicKeyToHex xP

                _ ->
                    ""
    in
    Lynx.view
        [ Attr.flexDirection Column
        , Attr.flex 1
        , Attr.padding 24
        , Attr.justifyContent Center
        ]
        [ Lynx.text
            [ Attr.fontSize 36
            , Attr.fontWeight Bold
            , Attr.color "#58a6ff"
            , Attr.textAlign TextCenter
            , Attr.marginBottom 8
            ]
            [ Lynx.textContent "Skrepka" ]
        , Lynx.text
            [ Attr.fontSize 14
            , Attr.color "#8b949e"
            , Attr.textAlign TextCenter
            , Attr.marginBottom 32
            ]
            [ Lynx.textContent "Encrypted messaging, no accounts" ]

        -- Identity
        , fieldLabel "Your identity (share this with contacts)"
        , if String.isEmpty identityStr then
            Lynx.text
                [ Attr.color "#8b949e"
                , Attr.fontSize 14
                , Attr.marginBottom 24
                ]
                [ Lynx.textContent "Generating keypair..." ]

          else
            Lynx.view
                [ Attr.backgroundColor "#161b22"
                , Attr.borderRadius 8
                , Attr.padding 12
                , Attr.marginBottom 24
                ]
                [ Lynx.text [ Attr.color "#c9d1d9", Attr.fontSize 11 ]
                    [ Lynx.textContent identityStr ]
                ]

        -- Server URL
        , fieldLabel "Relay server"
        , textInput
            { onInput = UpdateServerUrl
            , value = model.serverUrl
            , placeholder = "http://relay.example.com:8080"
            }
        , spacer 24

        -- Display name
        , fieldLabel "Display name (optional)"
        , textInput
            { onInput = UpdateDisplayName
            , value = model.displayName
            , placeholder = "Anonymous"
            }
        , spacer 32

        -- Connect button
        , if model.connecting then
            disabledButton "Connecting..."

          else if model.edPriv == Nothing then
            disabledButton "Generating keys..."

          else
            primaryButton Connect "Connect to Server"
        ]



-- Contacts Screen -------------------------------------------------------------


viewContacts : Model -> Lynx.Node Msg
viewContacts model =
    Lynx.view
        [ Attr.flexDirection Column, Attr.flex 1 ]
        [ -- Header
          Lynx.view
            [ Attr.flexDirection Row
            , Attr.alignItems Center
            , Attr.paddingTop 16
            , Attr.paddingBottom 16
            , Attr.paddingLeft 20
            , Attr.paddingRight 20
            , Attr.backgroundColor "#161b22"
            ]
            [ Lynx.text
                [ Attr.fontSize 20
                , Attr.fontWeight Bold
                , Attr.color "#c9d1d9"
                , Attr.flex 1
                ]
                [ Lynx.textContent "Messages" ]
            , Lynx.view
                [ onTap (Navigate AddContactScreen)
                , Attr.paddingLeft 12
                , Attr.paddingRight 4
                ]
                [ Lynx.text [ Attr.color "#58a6ff", Attr.fontSize 28 ]
                    [ Lynx.textContent "+" ]
                ]
            ]

        -- Conversation list
        , if Dict.isEmpty model.contacts then
            Lynx.view
                [ Attr.flex 1
                , Attr.alignItems Center
                , Attr.justifyContent Center
                , Attr.padding 40
                ]
                [ Lynx.text
                    [ Attr.color "#8b949e"
                    , Attr.fontSize 16
                    , Attr.textAlign TextCenter
                    ]
                    [ Lynx.textContent "No conversations yet" ]
                , spacer 8
                , Lynx.text
                    [ Attr.color "#8b949e"
                    , Attr.fontSize 14
                    , Attr.textAlign TextCenter
                    ]
                    [ Lynx.textContent "Tap + to add a contact" ]
                ]

          else
            Lynx.scrollView
                [ Attr.flex 1, Attr.scrollDirection Vertical ]
                (Dict.values model.contacts
                    |> List.sortBy (\c -> negate c.lastTime)
                    |> List.map viewContactRow
                )

        -- Identity bar
        , case model.edPub of
            Just pub ->
                Lynx.view
                    [ Attr.paddingTop 10
                    , Attr.paddingBottom 10
                    , Attr.paddingLeft 20
                    , Attr.paddingRight 20
                    , Attr.backgroundColor "#161b22"
                    , Attr.flexDirection Row
                    , Attr.alignItems Center
                    ]
                    [ Lynx.view
                        [ Attr.width 8
                        , Attr.height 8
                        , Attr.borderRadius 4
                        , Attr.backgroundColor "#3fb950"
                        , Attr.marginRight 8
                        ]
                        []
                    , Lynx.text [ Attr.color "#8b949e", Attr.fontSize 11, Attr.flex 1 ]
                        [ Lynx.textContent (truncateKey (Ed.publicKeyToHex pub)) ]
                    ]

            Nothing ->
                Lynx.view [] []
        ]


viewContactRow : Contact -> Lynx.Node Msg
viewContactRow contact =
    Lynx.view
        [ onTap (OpenChat contact.edPubHex)
        , Attr.flexDirection Row
        , Attr.alignItems Center
        , Attr.paddingTop 14
        , Attr.paddingBottom 14
        , Attr.paddingLeft 20
        , Attr.paddingRight 20
        , Attr.borderColor "#21262d"
        , Attr.borderWidth 1
        ]
        [ -- Avatar
          Lynx.view
            [ Attr.width 44
            , Attr.height 44
            , Attr.borderRadius 22
            , Attr.backgroundColor "#30363d"
            , Attr.alignItems Center
            , Attr.justifyContent Center
            , Attr.marginRight 12
            ]
            [ Lynx.text [ Attr.color "#58a6ff", Attr.fontSize 18, Attr.fontWeight Bold ]
                [ Lynx.textContent (String.left 1 contact.name |> String.toUpper) ]
            ]

        -- Name + last message
        , Lynx.view [ Attr.flex 1, Attr.flexDirection Column ]
            [ Lynx.view [ Attr.flexDirection Row, Attr.alignItems Center ]
                [ Lynx.text
                    [ Attr.color "#c9d1d9"
                    , Attr.fontSize 16
                    , Attr.fontWeight Bold
                    , Attr.flex 1
                    ]
                    [ Lynx.textContent contact.name ]
                , if contact.online then
                    Lynx.view
                        [ Attr.width 8
                        , Attr.height 8
                        , Attr.borderRadius 4
                        , Attr.backgroundColor "#3fb950"
                        , Attr.marginLeft 8
                        ]
                        []

                  else
                    Lynx.view [] []
                ]
            , if String.isEmpty contact.lastMessage then
                Lynx.view [] []

              else
                Lynx.text
                    [ Attr.color "#8b949e"
                    , Attr.fontSize 14
                    , Attr.marginTop 2
                    ]
                    [ Lynx.textContent (String.left 50 contact.lastMessage) ]
            ]
        ]



-- Chat Screen -----------------------------------------------------------------


viewChat : Model -> Lynx.Node Msg
viewChat model =
    let
        contactName =
            Dict.get model.activeChat model.contacts
                |> Maybe.map .name
                |> Maybe.withDefault (truncateKey model.activeChat)

        chatMessages =
            Dict.get model.activeChat model.messages
                |> Maybe.withDefault []
    in
    Lynx.view
        [ Attr.flexDirection Column, Attr.flex 1 ]
        [ -- Header
          Lynx.view
            [ Attr.flexDirection Row
            , Attr.alignItems Center
            , Attr.paddingTop 12
            , Attr.paddingBottom 12
            , Attr.paddingLeft 16
            , Attr.paddingRight 16
            , Attr.backgroundColor "#161b22"
            ]
            [ Lynx.view
                [ onTap (Navigate ContactsScreen)
                , Attr.paddingRight 12
                , Attr.paddingTop 4
                , Attr.paddingBottom 4
                ]
                [ Lynx.text [ Attr.color "#58a6ff", Attr.fontSize 20 ]
                    [ Lynx.textContent "<" ]
                ]
            , Lynx.text
                [ Attr.color "#c9d1d9"
                , Attr.fontSize 18
                , Attr.fontWeight Bold
                , Attr.flex 1
                ]
                [ Lynx.textContent contactName ]
            ]

        -- Messages
        , Lynx.scrollView
            [ Attr.flex 1
            , Attr.scrollDirection Vertical
            , Attr.paddingTop 12
            , Attr.paddingBottom 12
            , Attr.paddingLeft 16
            , Attr.paddingRight 16
            ]
            (if List.isEmpty chatMessages then
                [ Lynx.view
                    [ Attr.alignItems Center
                    , Attr.paddingTop 80
                    ]
                    [ Lynx.text
                        [ Attr.color "#8b949e"
                        , Attr.fontSize 14
                        , Attr.textAlign TextCenter
                        ]
                        [ Lynx.textContent "No messages yet. Say hello!" ]
                    ]
                ]

             else
                List.map viewMessage chatMessages
            )

        -- Input bar
        , Lynx.view
            [ Attr.flexDirection Row
            , Attr.alignItems Center
            , Attr.paddingTop 8
            , Attr.paddingBottom 8
            , Attr.paddingLeft 12
            , Attr.paddingRight 12
            , Attr.backgroundColor "#161b22"
            ]
            [ Lynx.input
                [ onInput UpdateDraft
                , Attr.value model.draft
                , Attr.placeholder "Message..."
                , Attr.flex 1
                , Attr.height 40
                , Attr.fontSize 16
                , Attr.color "#c9d1d9"
                , Attr.backgroundColor "#0d1117"
                , Attr.borderWidth 1
                , Attr.borderColor "#30363d"
                , Attr.borderRadius 20
                , Attr.paddingLeft 16
                ]
                []
            , Lynx.view
                [ onTap PrepareSend
                , Attr.marginLeft 8
                , Attr.backgroundColor
                    (if model.sending || String.isEmpty (String.trim model.draft) then
                        "#30363d"

                     else
                        "#58a6ff"
                    )
                , Attr.borderRadius 20
                , Attr.width 40
                , Attr.height 40
                , Attr.alignItems Center
                , Attr.justifyContent Center
                ]
                [ Lynx.text [ Attr.color "#ffffff", Attr.fontSize 16, Attr.fontWeight Bold ]
                    [ Lynx.textContent "^" ]
                ]
            ]
        ]


viewMessage : ChatMessage -> Lynx.Node Msg
viewMessage chatMsg =
    Lynx.view
        [ Attr.flexDirection Row
        , Attr.justifyContent
            (if chatMsg.outgoing then
                End

             else
                Start
            )
        , Attr.marginBottom 6
        ]
        [ Lynx.view
            [ Attr.backgroundColor
                (if chatMsg.outgoing then
                    "#1a3a5c"

                 else
                    "#21262d"
                )
            , Attr.borderRadius 16
            , Attr.paddingTop 10
            , Attr.paddingBottom 10
            , Attr.paddingLeft 14
            , Attr.paddingRight 14
            , Attr.maxWidth 280
            ]
            [ Lynx.text [ Attr.color "#c9d1d9", Attr.fontSize 15 ]
                [ Lynx.textContent chatMsg.body ]
            ]
        ]



-- Add Contact Screen ----------------------------------------------------------


viewAddContact : Model -> Lynx.Node Msg
viewAddContact model =
    Lynx.view
        [ Attr.flexDirection Column, Attr.flex 1 ]
        [ -- Header
          Lynx.view
            [ Attr.flexDirection Row
            , Attr.alignItems Center
            , Attr.paddingTop 12
            , Attr.paddingBottom 12
            , Attr.paddingLeft 16
            , Attr.paddingRight 16
            , Attr.backgroundColor "#161b22"
            ]
            [ Lynx.view
                [ onTap (Navigate ContactsScreen)
                , Attr.paddingRight 12
                , Attr.paddingTop 4
                , Attr.paddingBottom 4
                ]
                [ Lynx.text [ Attr.color "#58a6ff", Attr.fontSize 20 ]
                    [ Lynx.textContent "<" ]
                ]
            , Lynx.text
                [ Attr.color "#c9d1d9"
                , Attr.fontSize 18
                , Attr.fontWeight Bold
                ]
                [ Lynx.textContent "Add Contact" ]
            ]

        -- Form
        , Lynx.view
            [ Attr.padding 24, Attr.flexDirection Column ]
            [ fieldLabel "Identity string"
            , Lynx.text
                [ Attr.color "#6e7681"
                , Attr.fontSize 12
                , Attr.marginBottom 8
                ]
                [ Lynx.textContent "Paste the <ed25519>.<x25519> identity from your contact" ]
            , textInput
                { onInput = UpdateAddIdentity
                , value = model.addIdentity
                , placeholder = "abc123...def456.ghi789...jkl012"
                }
            , spacer 20
            , fieldLabel "Name"
            , textInput
                { onInput = UpdateAddName
                , value = model.addName
                , placeholder = "Display name (optional)"
                }
            , spacer 32
            , primaryButton AddContact "Add Contact"
            ]
        ]



-- ============================================================================
-- UI COMPONENTS
-- ============================================================================


fieldLabel : String -> Lynx.Node msg
fieldLabel text =
    Lynx.text
        [ Attr.color "#8b949e"
        , Attr.fontSize 13
        , Attr.marginBottom 6
        ]
        [ Lynx.textContent text ]


textInput : { onInput : String -> msg, value : String, placeholder : String } -> Lynx.Node msg
textInput config =
    Lynx.input
        [ onInput config.onInput
        , Attr.value config.value
        , Attr.placeholder config.placeholder
        , Attr.height 44
        , Attr.fontSize 16
        , Attr.color "#c9d1d9"
        , Attr.backgroundColor "#161b22"
        , Attr.borderWidth 1
        , Attr.borderColor "#30363d"
        , Attr.borderRadius 8
        , Attr.paddingLeft 12
        ]
        []


primaryButton : msg -> String -> Lynx.Node msg
primaryButton msg text =
    Lynx.view
        [ onTap msg
        , Attr.backgroundColor "#58a6ff"
        , Attr.borderRadius 8
        , Attr.paddingTop 14
        , Attr.paddingBottom 14
        , Attr.alignItems Center
        ]
        [ Lynx.text [ Attr.color "#ffffff", Attr.fontSize 16, Attr.fontWeight Bold ]
            [ Lynx.textContent text ]
        ]


disabledButton : String -> Lynx.Node msg
disabledButton text =
    Lynx.view
        [ Attr.backgroundColor "#30363d"
        , Attr.borderRadius 8
        , Attr.paddingTop 14
        , Attr.paddingBottom 14
        , Attr.alignItems Center
        ]
        [ Lynx.text [ Attr.color "#8b949e", Attr.fontSize 16 ]
            [ Lynx.textContent text ]
        ]


spacer : Int -> Lynx.Node msg
spacer px =
    Lynx.view [ Attr.height px ] []



-- ============================================================================
-- HTTP API
-- ============================================================================


requestChallenge : String -> String -> Cmd Msg
requestChallenge serverUrl pubkey =
    Http.post
        { url = serverUrl ++ "/auth/challenge"
        , body =
            Http.jsonBody
                (Encode.object [ ( "pubkey", Encode.string pubkey ) ])
        , expect = Http.expectJson GotChallenge challengeDecoder
        }


verifyAuth : String -> String -> String -> String -> Cmd Msg
verifyAuth serverUrl pubkey challenge signature =
    Http.post
        { url = serverUrl ++ "/auth/verify"
        , body =
            Http.jsonBody
                (Encode.object
                    [ ( "pubkey", Encode.string pubkey )
                    , ( "challenge", Encode.string challenge )
                    , ( "signature", Encode.string signature )
                    ]
                )
        , expect = Http.expectJson GotVerify verifyDecoder
        }


pollMessages : String -> String -> Cmd Msg
pollMessages serverUrl token =
    Http.request
        { method = "GET"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = serverUrl ++ "/poll"
        , body = Http.emptyBody
        , expect = Http.expectJson GotPoll pollDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


sendMessageHttp : String -> String -> String -> String -> Int -> Cmd Msg
sendMessageHttp serverUrl token to encryptedBlob timestamp =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = serverUrl ++ "/messages/"
        , body =
            Http.jsonBody
                (Encode.object
                    [ ( "to", Encode.string to )
                    , ( "encryptedBlob", Encode.string encryptedBlob )
                    , ( "timestamp", Encode.int timestamp )
                    ]
                )
        , expect = Http.expectJson GotSendResult sendDecoder
        , timeout = Just 10000
        , tracker = Nothing
        }


ackMessages : String -> String -> List String -> Cmd Msg
ackMessages serverUrl token messageIds =
    Http.request
        { method = "POST"
        , headers = [ Http.header "Authorization" ("Bearer " ++ token) ]
        , url = serverUrl ++ "/messages/ack"
        , body =
            Http.jsonBody
                (Encode.object
                    [ ( "messageIds", Encode.list Encode.string messageIds ) ]
                )
        , expect = Http.expectJson GotAck (Decode.field "ok" Decode.bool)
        , timeout = Just 5000
        , tracker = Nothing
        }


lookupPresence : String -> String -> Cmd Msg
lookupPresence serverUrl pubkey =
    Http.get
        { url = serverUrl ++ "/lookup/" ++ pubkey
        , expect = Http.expectJson GotLookup (lookupDecoder pubkey)
        }



-- ============================================================================
-- PROTOCOL / CRYPTO
-- ============================================================================


{-| Encrypt a message per Skrepka protocol section 3.

Uses X25519 ECDH for key agreement and XChaCha20-Poly1305 for encryption.
The raw X25519 shared secret is used directly as the cipher key (HKDF
not available; shared secret is already 32 uniformly random bytes).

Blob format (hex):
ephemeral\_x25519\_pub (64 hex) ++ nonce (48 hex)
++ ciphertext (var) ++ sender\_ed25519\_pub (64 hex) ++ signature (128 hex)

-}
encryptMessage :
    Ed.PrivateKey
    -> Ed.PublicKey
    -> String
    -> String
    -> String
    -> String
    -> Maybe String
encryptMessage edPriv edPub recipientXPubHex ephSeedHex nonceHex plaintextJson =
    case ( X.privateKeyFromHex ephSeedHex, X.publicKeyFromHex recipientXPubHex, Cipher.nonce24FromHex nonceHex ) of
        ( Just ephPriv, Just recipientXPub, Just nonce ) ->
            let
                ephPub =
                    X.getPublicKey ephPriv

                ephPubHex =
                    X.publicKeyToHex ephPub

                -- X25519 key agreement
                sharedSecretHex =
                    X.getSharedSecret ephPriv recipientXPub
            in
            case Cipher.keyFromHex sharedSecretHex of
                Just key ->
                    let
                        -- Encrypt plaintext
                        plaintextHex =
                            textToHex plaintextJson

                        ciphertextHex =
                            Cipher.xchacha20Encrypt key nonce plaintextHex

                        -- Sign the ciphertext
                        sig =
                            Ed.sign ciphertextHex edPriv

                        senderPubHex =
                            Ed.publicKeyToHex edPub

                        sigHex =
                            Ed.signatureToHex sig
                    in
                    Just
                        (ephPubHex
                            ++ nonceHex
                            ++ ciphertextHex
                            ++ senderPubHex
                            ++ sigHex
                        )

                Nothing ->
                    Nothing

        _ ->
            Nothing


{-| Decrypt a message per Skrepka protocol section 3.
Returns (senderEdPubHex, plaintextJson) on success.
-}
decryptMessage : X.PrivateKey -> String -> Maybe ( String, String )
decryptMessage xPriv blob =
    let
        hexLen =
            String.length blob
    in
    if hexLen < 304 then
        -- Minimum: 64 + 48 + 0 + 64 + 128 = 304 hex chars
        Nothing

    else
        let
            ephPubHex =
                String.slice 0 64 blob

            nonceHex =
                String.slice 64 112 blob

            ciphertextHex =
                String.slice 112 (hexLen - 192) blob

            senderEdPubHex =
                String.slice (hexLen - 192) (hexLen - 128) blob

            sigHex =
                String.slice (hexLen - 128) hexLen blob
        in
        case ( Ed.publicKeyFromHex senderEdPubHex, Ed.signatureFromHex sigHex ) of
            ( Just senderEdPub, Just sig ) ->
                -- Verify Ed25519 signature on ciphertext
                if not (Ed.verify sig ciphertextHex senderEdPub) then
                    Nothing

                else
                    case ( X.publicKeyFromHex ephPubHex, Cipher.nonce24FromHex nonceHex ) of
                        ( Just ephPub, Just nonce ) ->
                            let
                                sharedSecretHex =
                                    X.getSharedSecret xPriv ephPub
                            in
                            case Cipher.keyFromHex sharedSecretHex of
                                Just key ->
                                    case Cipher.xchacha20Decrypt key nonce ciphertextHex of
                                        Just plaintextHex ->
                                            Just ( senderEdPubHex, hexToText plaintextHex )

                                        Nothing ->
                                            Nothing

                                Nothing ->
                                    Nothing

                        _ ->
                            Nothing

            _ ->
                Nothing


{-| Process poll events: decrypt, dedup, collect ACK IDs.
-}
processEvents :
    X.PrivateKey
    -> String
    -> List PollEvent
    -> Set String
    -> ( List ( String, ChatMessage ), Set String, List String )
processEvents xPriv myEdHex events seenIds =
    List.foldl
        (\event ( msgs, seen, acks ) ->
            if event.eventType /= "message" then
                ( msgs, seen, acks )

            else
                case Decode.decodeString envelopeDecoder event.payload of
                    Err _ ->
                        ( msgs, seen, event.id :: acks )

                    Ok envelope ->
                        if envelope.fromKey == myEdHex then
                            -- Skip our own messages
                            ( msgs, seen, event.id :: acks )

                        else
                            case decryptMessage xPriv envelope.encryptedBlob of
                                Nothing ->
                                    ( msgs, seen, event.id :: acks )

                                Just ( senderPub, json ) ->
                                    case Decode.decodeString messagePayloadDecoder json of
                                        Err _ ->
                                            ( msgs, seen, event.id :: acks )

                                        Ok payload ->
                                            if Set.member payload.id seen then
                                                ( msgs, seen, event.id :: acks )

                                            else
                                                ( ( senderPub
                                                  , { id = payload.id
                                                    , body = payload.body
                                                    , timestamp = payload.timestamp
                                                    , outgoing = False
                                                    }
                                                  )
                                                    :: msgs
                                                , Set.insert payload.id seen
                                                , event.id :: acks
                                                )
        )
        ( [], seenIds, [] )
        events



-- ============================================================================
-- JSON DECODERS
-- ============================================================================


type alias ChallengeResponse =
    { challenge : String }


challengeDecoder : Decoder ChallengeResponse
challengeDecoder =
    Decode.map ChallengeResponse
        (Decode.field "challenge" Decode.string)


type alias VerifyResponse =
    { token : String, expiresAt : Int }


verifyDecoder : Decoder VerifyResponse
verifyDecoder =
    Decode.map2 VerifyResponse
        (Decode.field "token" Decode.string)
        (Decode.field "expiresAt" Decode.int)


type alias PollEvent =
    { id : String
    , eventType : String
    , payload : String
    }


type alias PollResponse =
    { events : List PollEvent
    , cursor : String
    }


pollEventDecoder : Decoder PollEvent
pollEventDecoder =
    Decode.map3 PollEvent
        (Decode.field "id" Decode.string)
        (Decode.field "eventType" Decode.string)
        (Decode.field "payload" Decode.string)


pollDecoder : Decoder PollResponse
pollDecoder =
    Decode.map2 PollResponse
        (Decode.field "events" (Decode.list pollEventDecoder))
        (Decode.field "cursor" Decode.string)


type alias Envelope =
    { toKey : String
    , fromKey : String
    , encryptedBlob : String
    , timestamp : Int
    }


envelopeDecoder : Decoder Envelope
envelopeDecoder =
    Decode.map4 Envelope
        (Decode.field "toKey" Decode.string)
        (Decode.field "fromKey" Decode.string)
        (Decode.field "encryptedBlob" Decode.string)
        (Decode.field "timestamp" Decode.int)


type alias SendResponse =
    { status : String
    , messageId : String
    }


sendDecoder : Decoder SendResponse
sendDecoder =
    Decode.map2 SendResponse
        (Decode.field "status" Decode.string)
        (Decode.field "messageId" Decode.string)


type alias MessagePayload =
    { type_ : String
    , id : String
    , timestamp : Int
    , body : String
    }


messagePayloadDecoder : Decoder MessagePayload
messagePayloadDecoder =
    Decode.map4 MessagePayload
        (Decode.field "type" Decode.string)
        (Decode.field "id" Decode.string)
        (Decode.field "timestamp" Decode.int)
        (Decode.field "body" Decode.string)


type alias LookupResponse =
    { pubkey : String
    , online : Bool
    }


lookupDecoder : String -> Decoder LookupResponse
lookupDecoder pubkey =
    Decode.map (LookupResponse pubkey)
        (Decode.field "online" Decode.bool)



-- ============================================================================
-- HELPERS
-- ============================================================================


{-| Parse identity string "ed25519hex.x25519hex" into (edHex, xHex).
-}
parseIdentity : String -> Maybe ( String, String )
parseIdentity str =
    case String.split "." str of
        [ edHex, xHex ] ->
            if String.length edHex == 64 && String.length xHex == 64 then
                Just ( edHex, xHex )

            else
                Nothing

        _ ->
            Nothing


truncateKey : String -> String
truncateKey key =
    if String.length key > 16 then
        String.left 8 key ++ "..." ++ String.right 8 key

    else
        key


httpErrorToString : Http.Error -> String
httpErrorToString err =
    case err of
        Http.BadUrl url ->
            "Bad URL: " ++ url

        Http.Timeout ->
            "Request timed out"

        Http.NetworkError ->
            "Network error"

        Http.BadStatus code ->
            "Server error: " ++ String.fromInt code

        Http.BadBody msg_ ->
            "Bad response: " ++ msg_


{-| Convert a UTF-8 string to hex-encoded bytes. Only handles ASCII/Latin-1.
-}
textToHex : String -> String
textToHex str =
    str
        |> String.toList
        |> List.concatMap charToHexBytes
        |> String.fromList


charToHexBytes : Char -> List Char
charToHexBytes c =
    let
        code =
            Char.toCode c
    in
    if code < 128 then
        [ nibbleToHex (code // 16), nibbleToHex (modBy 16 code) ]

    else if code < 2048 then
        -- 2-byte UTF-8
        let
            b1 =
                0xC0 + (code // 64)

            b2 =
                0x80 + modBy 64 code
        in
        [ nibbleToHex (b1 // 16)
        , nibbleToHex (modBy 16 b1)
        , nibbleToHex (b2 // 16)
        , nibbleToHex (modBy 16 b2)
        ]

    else
        -- 3-byte UTF-8
        let
            b1 =
                0xE0 + (code // 4096)

            b2 =
                0x80 + modBy 64 (code // 64)

            b3 =
                0x80 + modBy 64 code
        in
        [ nibbleToHex (b1 // 16)
        , nibbleToHex (modBy 16 b1)
        , nibbleToHex (b2 // 16)
        , nibbleToHex (modBy 16 b2)
        , nibbleToHex (b3 // 16)
        , nibbleToHex (modBy 16 b3)
        ]


nibbleToHex : Int -> Char
nibbleToHex n =
    case n of
        0 ->
            '0'

        1 ->
            '1'

        2 ->
            '2'

        3 ->
            '3'

        4 ->
            '4'

        5 ->
            '5'

        6 ->
            '6'

        7 ->
            '7'

        8 ->
            '8'

        9 ->
            '9'

        10 ->
            'a'

        11 ->
            'b'

        12 ->
            'c'

        13 ->
            'd'

        14 ->
            'e'

        _ ->
            'f'


{-| Decode hex-encoded UTF-8 bytes back to a string.
-}
hexToText : String -> String
hexToText hex =
    hexToBytes hex
        |> decodeUtf8Bytes
        |> Maybe.withDefault ""


hexToBytes : String -> List Int
hexToBytes hex =
    let
        chars =
            String.toList hex

        pairs =
            pairUp chars
    in
    List.filterMap
        (\( hi, lo ) ->
            Maybe.map2 (\h l -> h * 16 + l) (hexCharToInt hi) (hexCharToInt lo)
        )
        pairs


pairUp : List a -> List ( a, a )
pairUp list =
    case list of
        a :: b :: rest ->
            ( a, b ) :: pairUp rest

        _ ->
            []


hexCharToInt : Char -> Maybe Int
hexCharToInt c =
    let
        code =
            Char.toCode c
    in
    if code >= 48 && code <= 57 then
        Just (code - 48)

    else if code >= 97 && code <= 102 then
        Just (code - 87)

    else if code >= 65 && code <= 70 then
        Just (code - 55)

    else
        Nothing


decodeUtf8Bytes : List Int -> Maybe String
decodeUtf8Bytes bytes =
    decodeUtf8Help bytes []
        |> Maybe.map (List.reverse >> String.fromList)


decodeUtf8Help : List Int -> List Char -> Maybe (List Char)
decodeUtf8Help bytes acc =
    case bytes of
        [] ->
            Just acc

        b :: rest ->
            if b < 128 then
                decodeUtf8Help rest (Char.fromCode b :: acc)

            else if b >= 0xC0 && b < 0xE0 then
                case rest of
                    b2 :: rest2 ->
                        let
                            code =
                                (b - 0xC0) * 64 + (b2 - 0x80)
                        in
                        decodeUtf8Help rest2 (Char.fromCode code :: acc)

                    _ ->
                        Nothing

            else if b >= 0xE0 && b < 0xF0 then
                case rest of
                    b2 :: b3 :: rest3 ->
                        let
                            code =
                                (b - 0xE0) * 4096 + (b2 - 0x80) * 64 + (b3 - 0x80)
                        in
                        decodeUtf8Help rest3 (Char.fromCode code :: acc)

                    _ ->
                        Nothing

            else if b >= 0xF0 then
                case rest of
                    b2 :: b3 :: b4 :: rest4 ->
                        let
                            code =
                                (b - 0xF0) * 262144 + (b2 - 0x80) * 4096 + (b3 - 0x80) * 64 + (b4 - 0x80)
                        in
                        decodeUtf8Help rest4 (Char.fromCode code :: acc)

                    _ ->
                        Nothing

            else
                Nothing


{-| Generate a random hex string of the given byte count.
-}
randomHexString : Int -> Random.Generator String
randomHexString byteCount =
    Random.list (byteCount * 2) randomHexChar
        |> Random.map String.fromList


randomHexChar : Random.Generator Char
randomHexChar =
    Random.map
        (\n ->
            if n < 10 then
                Char.fromCode (n + 48)

            else
                Char.fromCode (n - 10 + 97)
        )
        (Random.int 0 15)
