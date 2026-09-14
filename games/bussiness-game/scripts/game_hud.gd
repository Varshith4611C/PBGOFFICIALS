class_name GameHUD
extends CanvasLayer

## Side panel HUD plus the start-of-game setup card.
##
## Everything is styled from one Theme built in code: deep navy glass panels with
## a gold trim, so the UI matches the board table instead of Godot's default grey.

signal roll_pressed
signal purchase_choice(buy: bool)
signal game_requested(config: Dictionary)
signal new_game_pressed

const COL_PANEL := Color(0.070, 0.082, 0.125, 0.96)
const COL_CARD := Color(0.085, 0.098, 0.148, 0.98)
const COL_BORDER := Color(0.22, 0.26, 0.36, 1.0)
const COL_GOLD := Color(0.91, 0.72, 0.36, 1.0)
const COL_GOLD_SOFT := Color(0.60, 0.48, 0.24, 1.0)
const COL_TEXT := Color(0.92, 0.94, 0.98, 1.0)
const COL_MUTED := Color(0.58, 0.63, 0.74, 1.0)
const COL_MONEY := Color(0.45, 0.88, 0.60, 1.0)
const COL_BTN := Color(0.13, 0.16, 0.23, 1.0)
const COL_BTN_HOVER := Color(0.19, 0.23, 0.32, 1.0)
const COL_BTN_SELECTED := Color(0.28, 0.22, 0.09, 1.0)
const COL_BTN_SELECTED_HOVER := Color(0.35, 0.27, 0.11, 1.0)

const PANEL_WIDTH := 300.0
const PLAYER_COUNTS := [2, 3, 4]

var _side_panel: PanelContainer
var _reopen_button: Button
var _players_box: VBoxContainer
var _money_labels: Array[Label] = []
var _turn_label: Label
var _tile_label: Label
var _dice_label: Label
var _roll_button: Button
var _log: RichTextLabel
var _prompt: PanelContainer
var _prompt_label: Label
var _buy_button: Button
var _pass_button: Button
var _setup_root: Control
var _count_buttons: Array[Button] = []
var _mode_buttons: Array[Button] = []
var _summary_label: Label
var _player_count := 2
var _play_mode := "solo"
var _panel_shown := true

func _ready() -> void:
	_build()

func _build() -> void:
	var root := Control.new()
	root.name = "Root"
	root.theme = _make_theme()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_build_side_panel(root)
	_build_reopen_button(root)
	_build_prompt(root)
	_build_setup(root)

# --- theme -------------------------------------------------------------------

func _make_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font_size = 15

	theme.set_stylebox("panel", "PanelContainer", _panel_style(COL_PANEL, 0))
	theme.set_stylebox("normal", "Button", _button_style(COL_BTN, COL_BORDER))
	theme.set_stylebox("hover", "Button", _button_style(COL_BTN_HOVER, COL_GOLD_SOFT))
	theme.set_stylebox("pressed", "Button", _button_style(COL_GOLD, COL_GOLD))
	theme.set_stylebox("disabled", "Button", _button_style(Color(0.09, 0.10, 0.14, 1.0), Color(0.14, 0.16, 0.22, 1.0)))
	theme.set_stylebox("focus", "Button", _button_style(Color(0.0, 0.0, 0.0, 0.0), COL_GOLD))
	theme.set_color("font_color", "Button", COL_TEXT)
	theme.set_color("font_hover_color", "Button", Color.WHITE)
	theme.set_color("font_pressed_color", "Button", Color(0.10, 0.08, 0.04))
	theme.set_color("font_disabled_color", "Button", Color(0.38, 0.42, 0.52))
	theme.set_color("font_color", "Label", COL_TEXT)

	var separator := StyleBoxLine.new()
	separator.color = COL_BORDER
	separator.thickness = 1
	theme.set_stylebox("separator", "HSeparator", separator)
	theme.set_constant("separation", "HSeparator", 4)

	theme.set_color("default_color", "RichTextLabel", COL_TEXT)
	theme.set_stylebox("normal", "RichTextLabel", StyleBoxEmpty.new())
	theme.set_constant("line_separation", "RichTextLabel", 3)
	theme.set_constant("outline_size", "RichTextLabel", 0)
	return theme

func _panel_style(bg: Color, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = COL_BORDER
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	return style

func _button_style(bg: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(8)
	style.content_margin_left = 14.0
	style.content_margin_right = 14.0
	style.content_margin_top = 9.0
	style.content_margin_bottom = 9.0
	return style

# --- side panel --------------------------------------------------------------

func _build_side_panel(root: Control) -> void:
	_side_panel = PanelContainer.new()
	_side_panel.name = "SidePanel"
	root.add_child(_side_panel)
	_side_panel.anchor_left = 1.0
	_side_panel.anchor_right = 1.0
	_side_panel.anchor_top = 0.0
	_side_panel.anchor_bottom = 1.0
	_side_panel.offset_left = -PANEL_WIDTH
	_side_panel.offset_right = -14.0
	_side_panel.offset_top = 14.0
	_side_panel.offset_bottom = -14.0

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	_side_panel.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 6)
	column.add_child(header)

	var title := Label.new()
	title.text = "BUSINESS BOARD"
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", COL_GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)

	var hide_button := Button.new()
	hide_button.text = "<"
	hide_button.tooltip_text = "Hide the panel to see the whole board"
	hide_button.add_theme_font_size_override("font_size", 13)
	hide_button.pressed.connect(_set_panel_shown.bind(false))
	header.add_child(hide_button)

	var tagline := Label.new()
	tagline.text = "ROLL   BUY   BUILD   WIN"
	tagline.add_theme_font_size_override("font_size", 11)
	tagline.add_theme_color_override("font_color", COL_MUTED)
	column.add_child(tagline)

	# Rotate controls. These call the camera directly, so turning the board never
	# depends on a mouse drag reaching the 3D viewport.
	var rotate_row := HBoxContainer.new()
	rotate_row.add_theme_constant_override("separation", 6)
	column.add_child(rotate_row)

	var rotate_left := Button.new()
	rotate_left.text = "< Turn Left"
	rotate_left.tooltip_text = "Hold to turn the view left (Left arrow or Q)"
	rotate_left.add_theme_font_size_override("font_size", 12)
	rotate_left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rotate_left.button_down.connect(_on_rotate_down.bind(-1))
	rotate_left.button_up.connect(_on_rotate_up)
	rotate_row.add_child(rotate_left)

	var rotate_right := Button.new()
	rotate_right.text = "Turn Right >"
	rotate_right.tooltip_text = "Hold to turn the view right (Right arrow or E)"
	rotate_right.add_theme_font_size_override("font_size", 12)
	rotate_right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rotate_right.button_down.connect(_on_rotate_down.bind(1))
	rotate_right.button_up.connect(_on_rotate_up)
	rotate_row.add_child(rotate_right)

	column.add_child(HSeparator.new())

	_players_box = VBoxContainer.new()
	_players_box.add_theme_constant_override("separation", 7)
	column.add_child(_players_box)

	column.add_child(HSeparator.new())

	_turn_label = Label.new()
	_turn_label.text = "Turn: -"
	_turn_label.add_theme_font_size_override("font_size", 16)
	_turn_label.add_theme_color_override("font_color", COL_GOLD)
	column.add_child(_turn_label)

	_tile_label = Label.new()
	_tile_label.text = ""
	_tile_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tile_label.add_theme_font_size_override("font_size", 13)
	_tile_label.add_theme_color_override("font_color", COL_MUTED)
	_tile_label.custom_minimum_size = Vector2(0.0, 58.0)
	column.add_child(_tile_label)

	_dice_label = Label.new()
	_dice_label.text = "Dice: -"
	_dice_label.add_theme_font_size_override("font_size", 22)
	_dice_label.add_theme_color_override("font_color", COL_TEXT)
	column.add_child(_dice_label)

	_roll_button = Button.new()
	_roll_button.text = "Roll Dice  (Space)"
	_roll_button.disabled = true
	_roll_button.custom_minimum_size = Vector2(0.0, 46.0)
	_roll_button.add_theme_font_size_override("font_size", 18)
	_roll_button.add_theme_stylebox_override("normal", _button_style(Color(0.22, 0.18, 0.08, 1.0), COL_GOLD))
	_roll_button.add_theme_stylebox_override("hover", _button_style(Color(0.32, 0.26, 0.11, 1.0), COL_GOLD))
	_roll_button.add_theme_stylebox_override("pressed", _button_style(COL_GOLD, COL_GOLD))
	_roll_button.add_theme_color_override("font_color", COL_GOLD)
	_roll_button.add_theme_color_override("font_hover_color", Color(1.0, 0.93, 0.74))
	_roll_button.pressed.connect(_on_roll_button)
	column.add_child(_roll_button)

	column.add_child(HSeparator.new())

	_log = RichTextLabel.new()
	_log.bbcode_enabled = true
	_log.scroll_following = true
	_log.selection_enabled = false
	_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_log)

	column.add_child(HSeparator.new())

	var hint := Label.new()
	hint.text = "Drag to rotate   -   Wheel to zoom\n< > buttons, arrows or Q/E to turn\nRight-drag to move   -   R to reset"
	hint.add_theme_font_size_override("font_size", 11)
	hint.add_theme_color_override("font_color", COL_MUTED)
	column.add_child(hint)

	var new_game := Button.new()
	new_game.text = "New Game"
	new_game.pressed.connect(_on_new_game_pressed)
	column.add_child(new_game)

func _build_reopen_button(root: Control) -> void:
	_reopen_button = Button.new()
	_reopen_button.name = "ReopenPanel"
	_reopen_button.text = "Show Panel"
	_reopen_button.visible = false
	root.add_child(_reopen_button)
	_reopen_button.anchor_left = 1.0
	_reopen_button.anchor_right = 1.0
	_reopen_button.anchor_top = 0.0
	_reopen_button.anchor_bottom = 0.0
	_reopen_button.offset_left = -140.0
	_reopen_button.offset_right = -14.0
	_reopen_button.offset_top = 14.0
	_reopen_button.offset_bottom = 50.0
	_reopen_button.pressed.connect(_set_panel_shown.bind(true))

func _set_panel_shown(shown: bool) -> void:
	_panel_shown = shown
	_side_panel.visible = shown
	_reopen_button.visible = not shown
	var cam := get_viewport().get_camera_3d()
	if cam != null and cam.has_method("set_panel_reserve"):
		cam.set_panel_reserve(PANEL_WIDTH if shown else 0.0)

# --- purchase prompt ---------------------------------------------------------

func _build_prompt(root: Control) -> void:
	_prompt = PanelContainer.new()
	_prompt.name = "PurchasePrompt"
	root.add_child(_prompt)
	_prompt.anchor_left = 0.5
	_prompt.anchor_right = 0.5
	_prompt.anchor_top = 0.5
	_prompt.anchor_bottom = 0.5
	_prompt.offset_left = -220.0
	_prompt.offset_right = 220.0
	_prompt.offset_top = -100.0
	_prompt.offset_bottom = 100.0
	_prompt.visible = false
	_prompt.add_theme_stylebox_override("panel", _panel_style(COL_CARD, 12))

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	_prompt.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	_prompt_label = Label.new()
	_prompt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_prompt_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_prompt_label)

	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)

	_buy_button = Button.new()
	_buy_button.text = "Buy"
	_buy_button.custom_minimum_size = Vector2(130.0, 42.0)
	_buy_button.add_theme_font_size_override("font_size", 16)
	_buy_button.add_theme_stylebox_override("normal", _button_style(Color(0.16, 0.30, 0.20, 1.0), COL_MONEY))
	_buy_button.add_theme_stylebox_override("hover", _button_style(Color(0.20, 0.38, 0.25, 1.0), COL_MONEY))
	_buy_button.add_theme_color_override("font_color", COL_MONEY)
	_buy_button.pressed.connect(_on_buy_pressed)
	buttons.add_child(_buy_button)

	_pass_button = Button.new()
	_pass_button.text = "Pass"
	_pass_button.custom_minimum_size = Vector2(130.0, 42.0)
	_pass_button.add_theme_font_size_override("font_size", 16)
	_pass_button.pressed.connect(_on_pass_pressed)
	buttons.add_child(_pass_button)

# --- setup card --------------------------------------------------------------

func _build_setup(root: Control) -> void:
	_setup_root = Control.new()
	_setup_root.name = "Setup"
	_setup_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_setup_root.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(_setup_root)

	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.025, 0.04, 0.74)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_setup_root.add_child(dim)

	var card := PanelContainer.new()
	card.anchor_left = 0.5
	card.anchor_right = 0.5
	card.anchor_top = 0.5
	card.anchor_bottom = 0.5
	card.offset_left = -300.0
	card.offset_right = 300.0
	card.offset_top = -258.0
	card.offset_bottom = 258.0
	card.add_theme_stylebox_override("panel", _panel_style(COL_CARD, 14))
	_setup_root.add_child(card)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	card.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)

	var title := Label.new()
	title.text = "BUSINESS BOARD"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", COL_GOLD)
	column.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Roll the dice, buy the streets, build an empire."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 13)
	subtitle.add_theme_color_override("font_color", COL_MUTED)
	column.add_child(subtitle)

	column.add_child(HSeparator.new())

	column.add_child(_section_label("How many players?"))
	_count_buttons.clear()
	var count_row := HBoxContainer.new()
	count_row.alignment = BoxContainer.ALIGNMENT_CENTER
	count_row.add_theme_constant_override("separation", 10)
	column.add_child(count_row)
	for count in PLAYER_COUNTS:
		var button := Button.new()
		button.text = "%d" % count
		button.custom_minimum_size = Vector2(88.0, 40.0)
		button.pressed.connect(_on_count_pressed.bind(count))
		count_row.add_child(button)
		_count_buttons.append(button)

	column.add_child(_section_label("Who is playing?"))
	_mode_buttons.clear()
	var mode_row := HBoxContainer.new()
	mode_row.alignment = BoxContainer.ALIGNMENT_CENTER
	mode_row.add_theme_constant_override("separation", 10)
	column.add_child(mode_row)
	var mode_labels := ["Just me vs bots", "Hot-seat, everyone plays"]
	for i in mode_labels.size():
		var button := Button.new()
		button.text = mode_labels[i]
		button.custom_minimum_size = Vector2(170.0, 40.0)
		button.pressed.connect(_on_mode_pressed.bind(i))
		mode_row.add_child(button)
		_mode_buttons.append(button)

	_summary_label = Label.new()
	_summary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_summary_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_summary_label.add_theme_font_size_override("font_size", 13)
	_summary_label.add_theme_color_override("font_color", COL_MUTED)
	_summary_label.custom_minimum_size = Vector2(0.0, 60.0)
	column.add_child(_summary_label)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)

	var start := Button.new()
	start.text = "Start Game"
	start.custom_minimum_size = Vector2(0.0, 50.0)
	start.add_theme_font_size_override("font_size", 19)
	start.add_theme_stylebox_override("normal", _button_style(Color(0.22, 0.18, 0.08, 1.0), COL_GOLD))
	start.add_theme_stylebox_override("hover", _button_style(Color(0.32, 0.26, 0.11, 1.0), COL_GOLD))
	start.add_theme_stylebox_override("pressed", _button_style(COL_GOLD, COL_GOLD))
	start.add_theme_color_override("font_color", COL_GOLD)
	start.add_theme_color_override("font_hover_color", Color(1.0, 0.93, 0.74))
	start.pressed.connect(_on_start_pressed)
	column.add_child(start)

	_apply_option_styles()

func _section_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 14)
	label.add_theme_color_override("font_color", COL_TEXT)
	return label

func _on_count_pressed(count: int) -> void:
	_player_count = count
	_apply_option_styles()

func _on_mode_pressed(index: int) -> void:
	_play_mode = "solo" if index == 0 else "hotseat"
	_apply_option_styles()

func _apply_option_styles() -> void:
	for i in _count_buttons.size():
		_style_option(_count_buttons[i], PLAYER_COUNTS[i] == _player_count)
	for i in _mode_buttons.size():
		_style_option(_mode_buttons[i], (i == 0) == (_play_mode == "solo"))
	if _summary_label == null:
		return
	if _play_mode == "solo":
		var bots := _player_count - 1
		_summary_label.text = "You take seat 1 and play against %d bot%s." % [bots, "" if bots == 1 else "s"]
	else:
		_summary_label.text = "%d people share this keyboard, taking one turn each." % _player_count

func _style_option(button: Button, selected: bool) -> void:
	if selected:
		button.add_theme_stylebox_override("normal", _button_style(COL_BTN_SELECTED, COL_GOLD))
		button.add_theme_stylebox_override("hover", _button_style(COL_BTN_SELECTED_HOVER, COL_GOLD))
		button.add_theme_color_override("font_color", COL_GOLD)
		button.add_theme_color_override("font_hover_color", Color(1.0, 0.93, 0.74))
	else:
		button.remove_theme_stylebox_override("normal")
		button.remove_theme_stylebox_override("hover")
		button.remove_theme_color_override("font_color")
		button.remove_theme_color_override("font_hover_color")

func _on_start_pressed() -> void:
	_setup_root.visible = false
	game_requested.emit({"count": _player_count, "mode": _play_mode})

func _on_new_game_pressed() -> void:
	new_game_pressed.emit()

# --- API used by the game manager -------------------------------------------

func add_player(player_name: String, color: Color, is_bot: bool) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_players_box.add_child(row)

	var dot := Panel.new()
	var dot_style := StyleBoxFlat.new()
	dot_style.bg_color = color
	dot_style.set_corner_radius_all(7)
	dot.add_theme_stylebox_override("panel", dot_style)
	dot.custom_minimum_size = Vector2(14.0, 14.0)
	dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(dot)

	var name_label := Label.new()
	name_label.text = player_name + ("   (bot)" if is_bot else "")
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_label)

	var money_label := Label.new()
	money_label.text = "$0"
	money_label.add_theme_font_size_override("font_size", 17)
	money_label.add_theme_color_override("font_color", COL_MONEY)
	row.add_child(money_label)
	_money_labels.append(money_label)

func set_money(index: int, amount: int) -> void:
	if index >= 0 and index < _money_labels.size():
		_money_labels[index].text = "$%d" % amount

func set_turn(player_name: String, is_bot: bool) -> void:
	_turn_label.text = "%s%s" % [player_name, "   (thinking...)" if is_bot else "'s turn"]

func show_dice(a: int, b: int) -> void:
	_dice_label.text = "Dice:  %d + %d  =  %d" % [a, b, a + b]

func set_roll_enabled(enabled: bool) -> void:
	_roll_button.disabled = not enabled
	_roll_button.text = "Roll Dice  (Space)" if enabled else "Waiting..."

func request_roll() -> void:
	if _roll_button != null and not _roll_button.disabled:
		_on_roll_button()

func show_tile_info(text: String) -> void:
	_tile_label.text = text

func push_message(text: String) -> void:
	if _log == null:
		return
	if _log.get_paragraph_count() > 80:
		_log.clear()
		_log.append_text("[color=#6a7284]... earlier messages cleared ...[/color]\n")
	_log.append_text("[color=#d8dce6]%s[/color]\n" % text)

func show_purchase_prompt(tile_name: String, price: int, cash: int) -> void:
	_prompt_label.text = "%s\n\nPrice  $%d      Your cash  $%d\n\nBuy this property?" % [tile_name, price, cash]
	_buy_button.disabled = cash < price
	_pass_button.disabled = false
	_prompt.visible = true

func hide_purchase_prompt() -> void:
	_prompt.visible = false

# --- internal ----------------------------------------------------------------

## Press and hold to turn; the short click nudge lives in the camera.
func _on_rotate_down(direction: int) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam != null and cam.has_method("begin_turn"):
		cam.begin_turn(direction)

func _on_rotate_up() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam != null and cam.has_method("end_turn"):
		cam.end_turn()

func _on_roll_button() -> void:
	roll_pressed.emit()

func _on_buy_pressed() -> void:
	_buy_button.disabled = true
	_pass_button.disabled = true
	purchase_choice.emit(true)

func _on_pass_pressed() -> void:
	_buy_button.disabled = true
	_pass_button.disabled = true
	purchase_choice.emit(false)
