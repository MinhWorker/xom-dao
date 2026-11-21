@tool
extends EditorPlugin
## Registers the `XomdaoBridge` autoload while the plugin is enabled.

const AUTOLOAD_NAME := "XomdaoBridge"
const AUTOLOAD_PATH := "res://addons/xomdao_bridge/bridge.gd"


func _enable_plugin() -> void:
	add_autoload_singleton(AUTOLOAD_NAME, AUTOLOAD_PATH)


func _disable_plugin() -> void:
	remove_autoload_singleton(AUTOLOAD_NAME)
