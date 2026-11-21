extends RefCounted
## The Bridge over a WebSocket to the Harness: how a Game runs from the editor, headless, or in a
## browser tab with `?harness=<url>`. One JSON text frame per message.
##
## The Harness refuses a Game client until a Room exists, by closing the socket, so until the
## Harness has said something this connects again every second and sends again what the Game
## posted so far. Once it has spoken, a closed socket is a lost connection.

const RETRY_SEC := 1.0
const BUFFER_BYTES := 4 * 1024 * 1024

var url: String
var _on_message: Callable
var _on_lost: Callable
var _socket: WebSocketPeer
## Posted before the Harness first answered; sent again on every new connection.
var _outbox: Array[String] = []
var _flushed := false
var _heard := false
var _retry_in := 0.0
var _closed := false


func _init(socket_url: String, on_message: Callable, on_lost: Callable) -> void:
	url = socket_url
	_on_message = on_message
	_on_lost = on_lost


func open() -> bool:
	_connect()
	return true


func is_open() -> bool:
	return _socket != null and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN


func post(text: String) -> void:
	if _closed:
		return
	if not _heard:
		_outbox.append(text)
	if _flushed and is_open():
		_socket.send_text(text)


func poll(delta: float) -> void:
	if _closed:
		return
	if _socket == null:
		_retry_in -= delta
		if _retry_in <= 0.0:
			_connect()
		return
	_socket.poll()
	match _socket.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			if not _flushed:
				for text in _outbox:
					_socket.send_text(text)
				_flushed = true
			while _socket.get_available_packet_count() > 0:
				_heard = true
				_outbox.clear()
				_on_message.call(_socket.get_packet().get_string_from_utf8())
		WebSocketPeer.STATE_CLOSED:
			_socket = null
			if _heard:
				_closed = true
				_on_lost.call()
			else:
				_retry_in = RETRY_SEC


func close() -> void:
	_closed = true
	if _socket != null:
		_socket.close()
	_socket = null


func _connect() -> void:
	_flushed = false
	_socket = WebSocketPeer.new()
	_socket.inbound_buffer_size = BUFFER_BYTES
	_socket.outbound_buffer_size = BUFFER_BYTES
	var error := _socket.connect_to_url(url)
	if error != OK:
		push_warning("XomdaoBridge: cannot reach the Harness at %s (%s)" % [url, error_string(error)])
		_socket = null
		_retry_in = RETRY_SEC
