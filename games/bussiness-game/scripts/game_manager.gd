extends Node3D

## Drives the business board game: turn order, dice, movement, landing effects,
## the property economy, and the AI opponent.
##
## Both the human turn and the bot turn run through the same async turn function,
## so the whole game is one coroutine loop rather than a nested call chain.

const Data = preload("res://scripts/board_data.gd")

const PLAYER_COLORS: Array[Color] = [
	Color(0.90, 0.29, 0.29),
	Color(0.30, 0.48, 0.92),
	Color(0.28, 0.72, 0.40),
	Color(0.94, 0.74, 0.22),
]

## Names handed to the bot seats, in seat order after the human.
const BOT_NAMES: Array[String] = ["Bot Rita", "Bot Sam", "Bot Lena"]

## Bot keeps this much cash in reserve before it will buy.
const BOT_CASH_RESERVE := 250
const BOT_THINK_TIME := 0.9
const DICE_SHOW_TIME := 0.5

@onready var _tokens_root: Node3D = $Tokens
@onready var _hud: GameHUD = $HUD

var _players: Array[PlayerToken] = []
var _current := 0
var _game_over := false
var _last_dice := 0

func _ready() -> void:
	_hud.new_game_pressed.connect(_on_new_game_pressed)
	_hud.push_message("Welcome to Business Board. Roll, buy, and charge rent when a rival lands on your property.")
	var config: Dictionary = await _hud.game_requested
	_spawn_players(config)
	for i in _players.size():
		_hud.add_player(_players[i].player_name, _players[i].color, _players[i].is_bot)
	_hud.push_message("%d players in the game. Roll when it is your turn." % _players.size())
	_refresh_hud()
	_run_game()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("roll_dice"):
		_hud.request_roll()

func _on_new_game_pressed() -> void:
	_game_over = true
	_hud.set_roll_enabled(false)
	get_tree().call_deferred("reload_current_scene")

func _spawn_players(config: Dictionary) -> void:
	_players.clear()
	var configs := _build_player_configs(int(config.get("count", 2)), str(config.get("mode", "solo")))
	for i in configs.size():
		var token := PlayerToken.new()
		token.name = "Token%d" % i
		_tokens_root.add_child(token)
		token.configure(i, str(configs[i]["name"]), PLAYER_COLORS[i % PLAYER_COLORS.size()], bool(configs[i]["bot"]))
		token.money = Data.START_MONEY
		token.snap_to_tile(0)
		_players.append(token)

## Seat 1 is always the human at the keyboard. In solo mode every later seat is a
## bot. In hot-seat every seat is human and they share the keyboard, one turn each.
func _build_player_configs(count: int, mode: String) -> Array:
	var total := clampi(count, 2, 4)
	var configs: Array = []
	for i in total:
		var is_bot := mode == "solo" and i > 0
		var player_name := ""
		if mode == "solo":
			player_name = "You" if i == 0 else BOT_NAMES[(i - 1) % BOT_NAMES.size()]
		else:
			player_name = "Player %d" % (i + 1)
		configs.append({"name": player_name, "bot": is_bot})
	return configs

# --- turn loop ---------------------------------------------------------------

func _run_game() -> void:
	await get_tree().process_frame
	while not _game_over:
		await _run_turn()
		_check_game_over()

func _run_turn() -> void:
	var player := _players[_current]
	if player.bankrupt:
		_current = (_current + 1) % _players.size()
		return

	_hud.set_turn(player.player_name, player.is_bot)
	if player.is_bot:
		_hud.set_roll_enabled(false)
		await get_tree().create_timer(BOT_THINK_TIME).timeout
	else:
		_hud.set_roll_enabled(true)
		await _hud.roll_pressed
		_hud.set_roll_enabled(false)

	await _take_turn(player)
	_current = (_current + 1) % _players.size()

func _take_turn(player: PlayerToken) -> void:
	var d1 := randi_range(1, 6)
	var d2 := randi_range(1, 6)
	_last_dice = d1 + d2
	_hud.show_dice(d1, d2)
	_hud.push_message("%s rolled %d + %d = [b]%d[/b]." % [player.player_name, d1, d2, _last_dice])
	await get_tree().create_timer(DICE_SHOW_TIME).timeout

	if player.board_index + _last_dice >= Data.BOARD_SIZE:
		player.money += Data.GO_SALARY
		_hud.push_message("%s passed GO and collected [b]$%d[/b]." % [player.player_name, Data.GO_SALARY])

	await player.move_steps(_last_dice)
	_refresh_hud()
	await get_tree().create_timer(0.25).timeout
	await _resolve_landing(player)
	_refresh_hud()

# --- landing effects ---------------------------------------------------------

func _resolve_landing(player: PlayerToken) -> void:
	var index := player.board_index
	var tile: Dictionary = Data.tile(index)
	_hud.show_tile_info(_tile_info_text(index, tile))

	match str(tile.get("type", "")):
		"property", "transit", "utility":
			await _resolve_ownable(player, tile, index)
		"tax":
			var amount := int(tile.get("amount", 100))
			_pay(player, amount)
			_hud.push_message("%s paid [b]$%d[/b] in %s." % [player.player_name, amount, tile["name"]])
		"card":
			_resolve_card(player)
		"go_to_jail":
			_hud.push_message("%s was sent to Jail." % player.player_name)
			player.snap_to_tile(Data.JAIL_INDEX)
		"go":
			_hud.push_message("%s rests on GO." % player.player_name)
		"jail":
			_hud.push_message("%s is only visiting the Jail." % player.player_name)
		"free_parking":
			_hud.push_message("%s takes a break at Free Parking." % player.player_name)
		_:
			_hud.push_message("%s landed on %s." % [player.player_name, tile["name"]])

func _resolve_ownable(player: PlayerToken, tile: Dictionary, index: int) -> void:
	var owner := _owner_of(index)
	var price := int(tile.get("price", 0))

	if owner == null:
		var wants := false
		if player.is_bot:
			_hud.push_message("%s looks at %s ($%d)." % [player.player_name, tile["name"], price])
			await get_tree().create_timer(0.6).timeout
			wants = _bot_wants_to_buy(player, price)
		else:
			wants = await _ask_purchase(tile, price, player)
		if wants and player.money >= price:
			player.money -= price
			player.owned.append(index)
			_hud.push_message("%s bought [b]%s[/b] for $%d." % [player.player_name, tile["name"], price])
		else:
			_hud.push_message("%s passed on %s." % [player.player_name, tile["name"]])
		_refresh_hud()
		return

	if owner == player:
		_hud.push_message("%s already owns %s." % [player.player_name, tile["name"]])
		return

	var rent := _rent_for(tile, owner)
	_pay(player, rent)
	owner.money += rent
	_hud.push_message("%s paid [b]$%d[/b] rent to %s in %s." % [player.player_name, rent, owner.player_name, tile["name"]])
	_refresh_hud()

func _resolve_card(player: PlayerToken) -> void:
	var card: Dictionary = Data.CARDS[randi() % Data.CARDS.size()]
	var delta := int(card["delta"])
	if delta >= 0:
		player.money += delta
	else:
		_pay(player, -delta)
	_hud.push_message("Fortune card: %s" % str(card["text"]))
	_refresh_hud()

func _pay(player: PlayerToken, amount: int) -> void:
	if amount <= 0:
		return
	player.money -= amount
	if player.money < 0:
		player.money = 0
		player.bankrupt = true
		_hud.push_message("[b]%s is bankrupt and out of the game.[/b]" % player.player_name)

func _rent_for(tile: Dictionary, owner: PlayerToken) -> int:
	match str(tile.get("type", "")):
		"property":
			return int(tile["rent"][0])
		"transit":
			return 25 * maxi(1, _count_owned_of_type(owner, "transit"))
		"utility":
			return 4 * maxi(2, _last_dice)
	return 0

# --- helpers -----------------------------------------------------------------

func _owner_of(index: int) -> PlayerToken:
	for player in _players:
		if player.owned.has(index):
			return player
	return null

func _count_owned_of_type(player: PlayerToken, type: String) -> int:
	var count := 0
	for index in player.owned:
		if Data.tile_type(int(index)) == type:
			count += 1
	return count

func _bot_wants_to_buy(player: PlayerToken, price: int) -> bool:
	if player.money < price:
		return false
	return player.money - price >= BOT_CASH_RESERVE

func _ask_purchase(tile: Dictionary, price: int, player: PlayerToken) -> bool:
	_hud.show_purchase_prompt(str(tile["name"]), price, player.money)
	var buy: bool = await _hud.purchase_choice
	_hud.hide_purchase_prompt()
	return buy

func _tile_info_text(index: int, tile: Dictionary) -> String:
	var label := "Tile %d - %s" % [index, str(tile["name"])]
	match str(tile.get("type", "")):
		"property":
			var owner := _owner_of(index)
			var line := "\nPrice $%d   Rent $%d" % [int(tile["price"]), int(tile["rent"][0])]
			if owner != null:
				line += "\nOwned by %s" % owner.player_name
			return label + line
		"transit", "utility":
			var owner := _owner_of(index)
			var line := "\nPrice $%d" % int(tile["price"])
			if owner != null:
				line += "\nOwned by %s" % owner.player_name
			return label + line
		"tax":
			return label + "\nPay $%d" % int(tile.get("amount", 0))
	return label

func _refresh_hud() -> void:
	for i in _players.size():
		_hud.set_money(i, _players[i].money)

func _check_game_over() -> void:
	var alive := 0
	var winner: PlayerToken = null
	for player in _players:
		if not player.bankrupt:
			alive += 1
			winner = player
	if alive <= 1 and not _game_over:
		_game_over = true
		_hud.set_roll_enabled(false)
		_hud.hide_purchase_prompt()
		if winner != null:
			_hud.push_message("[b]%s wins the game![/b]" % winner.player_name)
		else:
			_hud.push_message("[b]Everyone is bankrupt. Game over.[/b]")
