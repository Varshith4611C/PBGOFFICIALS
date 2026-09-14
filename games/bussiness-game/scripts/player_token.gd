class_name PlayerToken
extends Node3D

const Data = preload("res://scripts/board_data.gd")
const Builder = preload("res://scripts/board_builder.gd")

## One player pawn on the board. Holds the player's cash and property list,
## and animates tile-to-tile movement.

## Small offset per player so two pawns on the same tile do not overlap.
const SLOT_OFFSETS: Array[Vector3] = [
	Vector3(-0.22, 0.0, -0.22),
	Vector3(0.22, 0.0, -0.22),
	Vector3(-0.22, 0.0, 0.22),
	Vector3(0.22, 0.0, 0.22),
]

const HOP_HEIGHT := 0.3
const STEP_TIME := 0.09

var player_name: String = "Player"
var money: int = Data.START_MONEY
var board_index: int = 0
var is_bot: bool = false
var color: Color = Color.WHITE
var bankrupt: bool = false
var slot: int = 0

## Board indices this player owns.
var owned: Array = []

func configure(p_slot: int, p_name: String, p_color: Color, p_is_bot: bool) -> void:
	slot = p_slot
	player_name = p_name
	color = p_color
	is_bot = p_is_bot
	_build_pawn()
	_build_name_label()

func _build_pawn() -> void:
	var base := MeshInstance3D.new()
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 0.17
	base_mesh.bottom_radius = 0.20
	base_mesh.height = 0.08
	base_mesh.radial_segments = 20
	base.mesh = base_mesh
	base.position = Vector3(0.0, 0.04, 0.0)
	base.material_override = _material(color.darkened(0.25), 0.5)
	add_child(base)

	var body := MeshInstance3D.new()
	var body_mesh := CylinderMesh.new()
	body_mesh.top_radius = 0.07
	body_mesh.bottom_radius = 0.11
	body_mesh.height = 0.26
	body_mesh.radial_segments = 20
	body.mesh = body_mesh
	body.position = Vector3(0.0, 0.21, 0.0)
	body.material_override = _material(color, 0.4)
	add_child(body)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radius = 0.115
	head_mesh.height = 0.23
	head_mesh.radial_segments = 20
	head_mesh.rings = 10
	head.mesh = head_mesh
	head.position = Vector3(0.0, 0.45, 0.0)
	head.material_override = _material(color, 0.45)
	add_child(head)

func _build_name_label() -> void:
	var label := Label3D.new()
	label.text = player_name
	label.font_size = 44
	label.pixel_size = 0.006
	label.modulate = color.lightened(0.55)
	label.outline_size = 16
	label.outline_modulate = Color(0.02, 0.02, 0.04, 0.9)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = false
	label.alpha_cut = Label3D.ALPHA_CUT_DISCARD
	label.position = Vector3(0.0, 0.8, 0.0)
	add_child(label)

func snap_to_tile(index: int) -> void:
	board_index = posmod(index, Data.BOARD_SIZE)
	position = world_position_for(board_index)

func world_position_for(index: int) -> Vector3:
	return Builder.tile_position(index) \
		+ Vector3(0.0, Builder.TILE_THICKNESS * 0.5, 0.0) \
		+ SLOT_OFFSETS[slot % SLOT_OFFSETS.size()]

## Walk forward `steps` tiles, one hop at a time. Always moves forward
## (board indices increase), which is how passing GO is detected.
func move_steps(steps: int) -> void:
	for _i in steps:
		board_index = posmod(board_index + 1, Data.BOARD_SIZE)
		await _hop_to(board_index)

func _hop_to(index: int) -> void:
	var target := world_position_for(index)
	var start := position
	var mid := start.lerp(target, 0.5)
	mid.y += HOP_HEIGHT
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.tween_property(self, "position", mid, STEP_TIME)
	tween.tween_property(self, "position", target, STEP_TIME)
	await tween.finished

func _material(what: Color, metallic: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = what
	mat.metallic = metallic
	mat.roughness = 0.26
	mat.emission_enabled = true
	mat.emission = what
	mat.emission_energy_multiplier = 0.20
	return mat
