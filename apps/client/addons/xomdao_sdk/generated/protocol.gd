class_name XomDaoProtocol
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.
## Requests (`{ id, event, data }` on /ws) and the events the server pushes (`{ event, data }`).

const VERSION := 12
const MISMATCH := "protocol-mismatch"
const COIN := "core:coin"

## Requests that log a connection in.
const AUTH_TOKEN := "auth:token"
const AUTH_LOGIN := "auth:login"
const AUTH_GUEST := "auth:guest"

## Requests once logged in.
const SESSION_RESUME := "session:resume"
const PROFILE_UPDATE := "profile:update"
const SHOP_LIST := "shop:list"
const SHOP_BUY := "shop:buy"
const INVENTORY_GET := "inventory:get"
const INVENTORY_EQUIP := "inventory:equip"
const EVENT_GET := "event:get"
const EVENT_CLAIM := "event:claim"
const STATS_GET := "stats:get"
const RANKING_GET := "ranking:get"
const HISTORY_RECENT := "history:recent"
const CATALOG_GET := "catalog:get"
const LOBBY_WATCH := "lobby:watch"
const LOBBY_UNWATCH := "lobby:unwatch"
const ROOM_CREATE := "room:create"
const ROOM_QUICK := "room:quick"
const ROOM_JOIN := "room:join"
const ROOM_LEAVE := "room:leave"
const ROOM_SIT := "room:sit"
const ROOM_OPTIONS := "room:options"
const ROOM_READY := "room:ready"
const GAME_START := "game:start"
const GAME_MOVE := "game:move"
const GAME_RESTART := "game:restart"
const EMOTE_SEND := "emote:send"
const FRIENDS_LIST := "friends:list"
const FRIENDS_ADD := "friends:add"
const FRIENDS_ANSWER := "friends:answer"
const FRIENDS_REMOVE := "friends:remove"
const FRIENDS_SUGGEST := "friends:suggest"
const FRIENDS_FIND := "friends:find"
const CHAT_HISTORY := "chat:history"
const CHAT_SEND := "chat:send"
const QUESTS_GET := "quests:get"
const QUESTS_CLAIM := "quests:claim"
const MAIL_GET := "mail:get"
const MAIL_READ := "mail:read"
const MAIL_CLAIM := "mail:claim"
const FRIENDS_INVITE := "friends:invite"

## Events the server pushes.
const ROOM_STATE := "room:state"
const LOBBY_ROOMS := "lobby:rooms"
const ROOM_CLOSED := "room:closed"
const ROOM_EMOTE := "room:emote"
const REWARD := "reward"
const ACHIEVEMENT := "achievement"
const FRIENDS_CHANGED := "friends:changed"
const CHAT_MESSAGE := "chat:message"
const ROOM_INVITE := "room:invite"
const MAIL_CHANGED := "mail:changed"

const ROOM_STATUS: Array[String] = ["lobby", "playing", "finished"]
const ROOM_ROLE: Array[String] = ["player", "spectator"]
const FRIEND_STATE: Array[String] = ["friend", "incoming", "outgoing"]

static var _replies: Dictionary = {
	"auth:token": XomDaoAuthReply,
	"auth:login": XomDaoAuthReply,
	"auth:guest": XomDaoAuthReply,
	"session:resume": XomDaoSessionInfo,
	"shop:list": XomDaoShopList,
	"shop:buy": XomDaoPurchase,
	"inventory:get": XomDaoProfile,
	"event:get": XomDaoEventProgress,
	"event:claim": XomDaoEventClaim,
	"stats:get": XomDaoPlayerStats,
	"ranking:get": XomDaoRanking,
	"catalog:get": XomDaoCatalog,
	"lobby:watch": XomDaoRoomList,
	"room:create": XomDaoJoinedRoom,
	"room:quick": XomDaoJoinedRoom,
	"room:join": XomDaoJoinedRoom,
	"friends:list": XomDaoFriendList,
	"friends:add": XomDaoFriendList,
	"friends:answer": XomDaoFriendList,
	"friends:remove": XomDaoFriendList,
	"friends:suggest": XomDaoPeopleList,
	"friends:find": XomDaoPeopleList,
	"chat:history": XomDaoChatHistory,
	"quests:get": XomDaoQuestBoard,
	"quests:claim": XomDaoQuestClaim,
	"mail:get": XomDaoMailbox,
	"mail:read": XomDaoMailbox,
	"mail:claim": XomDaoMailClaim,
}
static var _events: Dictionary = {
	"room:state": XomDaoRoomSnapshot,
	"lobby:rooms": XomDaoLobbyRooms,
	"room:closed": XomDaoRoomClosed,
	"room:emote": XomDaoRoomEmote,
	"reward": XomDaoRewardNotice,
	"achievement": XomDaoAchievementNotice,
	"friends:changed": XomDaoFriendList,
	"chat:message": XomDaoChatMessage,
	"room:invite": XomDaoRoomInvite,
	"mail:changed": XomDaoMailbox,
}


## A successful reply's data as its class (`XomDaoSessionInfo` for session:resume…), or the
## reply itself when it has none.
static func parse_reply(event: String, ack: Dictionary) -> Variant:
	var script: GDScript = _replies.get(event)
	return script.from_dict(ack) if script != null else ack


## A pushed event's data as its class (`XomDaoRoomSnapshot` for room:state…).
static func parse_event(event: String, data: Variant) -> Variant:
	var script: GDScript = _events.get(event)
	return script.from_dict(data) if script != null and data is Dictionary else data
