class_name BoardBuilder
extends Node3D

const Data = preload("res://scripts/board_data.gd")

## Builds the board in a square ring. Tile layout comes from Data.TILES: index 0
## is the bottom-right corner.
##
## The visible board FACE is painted artwork on a flat plane. The walnut table,
## felt deck, gold rim and centre emblem surround it, and the 40 tile positions
## still exist as empty anchors because piece movement resolves through
## tile_position().
##
## ARTWORK ALIGNMENT: the image is mapped onto a square of board_face_span world
## units so the artwork's printed space ring lands on the radius-5.0 ring the
## pieces use. If the art carries an outer margin, or its spaces are not flush to
## the image edge, adjust board_face_span in the Inspector until the pawns sit
## inside the printed spaces.

const TILE_HALF := 0.48
const TILE_THICKNESS := 0.14
const BOARD_RADIUS := 5.0

## Board face art. Loaded with load() rather than preload() so this script still
## parses if the texture has not been imported yet.
const BOARD_FACE_PATH := "res://assets/images/board_face.png"

## Height of the painted face: above the felt deck and centre panel, below the
## pieces, which rest at y = TILE_THICKNESS * 0.5.
const BOARD_FACE_Y := 0.035

const COLOR_PROPERTY := Color(0.96, 0.94, 0.88)
const COLOR_CORNER := Color(0.90, 0.85, 0.74)
const COLOR_CARD := Color(0.70, 0.79, 0.95)
const COLOR_TAX := Color(0.94, 0.76, 0.60)
const COLOR_TRANSIT := Color(0.26, 0.30, 0.38)
const COLOR_UTILITY := Color(0.40, 0.76, 0.73)
const COLOR_GO := Color(0.38, 0.78, 0.54)
const COLOR_JAIL := Color(0.94, 0.78, 0.42)
const COLOR_PARKING := Color(0.86, 0.62, 0.62)
const COLOR_GO_JAIL := Color(0.54, 0.57, 0.68)
const COLOR_TABLE := Color(0.17, 0.11, 0.07)
const COLOR_DECK := Color(0.055, 0.075, 0.125)
const COLOR_INNER := Color(0.075, 0.10, 0.16)
const COLOR_GOLD := Color(0.91, 0.72, 0.36)
const COLOR_FLOOR := Color(0.035, 0.032, 0.042)

## Board face artwork, overridable in the Inspector.
@export var board_face_texture: Texture2D
## World width and height of the board face. 10.96 spans ten 0.96-wide spaces plus
## a half-space at each end, matching the 0.96 step between tile centres.
@export var board_face_span := 10.96

var tile_nodes: Array[Node3D] = []

## World position of the centre of a tile. y is the vertical centre of the slab.
static func tile_position(index: int) -> Vector3:
	var i := posmod(index, Data.BOARD_SIZE)
	var y := TILE_THICKNESS * 0.5
	if i <= 10:
		return Vector3(BOARD_RADIUS - float(i), y, BOARD_RADIUS)
	if i <= 20:
		return Vector3(-BOARD_RADIUS, y, BOARD_RADIUS - float(i - 10))
	if i <= 30:
		return Vector3(-BOARD_RADIUS + float(i - 20), y, -BOARD_RADIUS)
	return Vector3(BOARD_RADIUS, y, -BOARD_RADIUS + float(i - 30))

## Unit vector pointing from a tile towards the middle of the board.
static func tile_inward(index: int) -> Vector3:
	var i := posmod(index, Data.BOARD_SIZE)
	if i <= 10:
		return Vector3(0.0, 0.0, -1.0)
	if i <= 20:
		return Vector3(1.0, 0.0, 0.0)
	if i <= 30:
		return Vector3(0.0, 0.0, 1.0)
	return Vector3(-1.0, 0.0, 0.0)

## Orientation that lays a flat label or bar on a tile with its "up" pointing
## towards the middle of the board, so each side of the board reads from the
## outside edge.
static func tile_basis(index: int) -> Basis:
	var inward := tile_inward(index)
	return Basis(inward.cross(Vector3.UP), inward, Vector3.UP)

func _ready() -> void:
	build()

func build() -> void:
	tile_nodes.clear()
	for child in get_children():
		child.queue_free()
	_build_table()
	for i in Data.BOARD_SIZE:
		tile_nodes.append(_build_tile(i))

func _build_table() -> void:
	# Dim room floor, so the table reads as furniture instead of an endless plane
	# stretching to the horizon.
	var floor_slab := MeshInstance3D.new()
	var floor_mesh := BoxMesh.new()
	floor_mesh.size = Vector3(80.0, 0.4, 80.0)
	floor_slab.mesh = floor_mesh
	floor_slab.material_override = _material(COLOR_FLOOR, 0.78)
	floor_slab.position = Vector3(0.0, -1.6, 0.0)
	add_child(floor_slab)

	# Walnut table. Sized so a border of table shows around the felt deck; its top
	# face sits flush under the deck at y = -0.10.
	var table := MeshInstance3D.new()
	var table_mesh := BoxMesh.new()
	table_mesh.size = Vector3(17.6, 1.3, 17.6)
	table.mesh = table_mesh
	table.material_override = _material(COLOR_TABLE, 0.42)
	table.position = Vector3(0.0, -0.75, 0.0)
	add_child(table)

	# Raised felt deck the tiles sit on.
	var deck := MeshInstance3D.new()
	var deck_mesh := BoxMesh.new()
	deck_mesh.size = Vector3(12.6, 0.10, 12.6)
	deck.mesh = deck_mesh
	deck.material_override = _material(COLOR_DECK, 0.85)
	deck.position = Vector3(0.0, -0.05, 0.0)
	add_child(deck)

	# Gold rim around the deck.
	_build_rim()

	# Recessed centre panel.
	var inner := MeshInstance3D.new()
	var inner_mesh := BoxMesh.new()
	inner_mesh.size = Vector3(9.1, 0.04, 9.1)
	inner.mesh = inner_mesh
	inner.material_override = _material(COLOR_INNER, 0.90)
	inner.position = Vector3(0.0, 0.0, 0.0)
	add_child(inner)

	_build_board_face()
	_build_center_emblem()

func _build_rim() -> void:
	var span := 6.42
	var bar_size := Vector3(span * 2.0, 0.05, 0.10)
	for side in 4:
		var bar := MeshInstance3D.new()
		var bar_mesh := BoxMesh.new()
		bar_mesh.size = bar_size
		bar.mesh = bar_mesh
		bar.material_override = _material(COLOR_GOLD, 0.30, 0.85, 0.10)
		if side == 0:
			bar.position = Vector3(0.0, 0.0, -span)
		elif side == 1:
			bar.position = Vector3(0.0, 0.0, span)
		else:
			bar.position = Vector3(-span if side == 2 else span, 0.0, 0.0)
			bar.rotation_degrees = Vector3(0.0, 90.0, 0.0)
		add_child(bar)

func _build_center_emblem() -> void:
	var title := Label3D.new()
	title.text = "BUSINESS BOARD"
	title.font_size = 120
	title.pixel_size = 0.0072
	title.modulate = COLOR_GOLD
	title.outline_size = 0
	title.double_sided = true
	title.alpha_cut = Label3D.ALPHA_CUT_DISCARD
	title.basis = Basis(Vector3.RIGHT, Vector3(0.0, 0.0, -1.0), Vector3.UP)
	title.position = Vector3(0.0, BOARD_FACE_Y + 0.03, -0.62)
	add_child(title)

	var subtitle := Label3D.new()
	subtitle.text = "ROLL    BUY    BUILD    WIN"
	subtitle.font_size = 62
	subtitle.pixel_size = 0.0055
	subtitle.modulate = Color(0.62, 0.68, 0.80)
	subtitle.outline_size = 0
	subtitle.double_sided = true
	subtitle.alpha_cut = Label3D.ALPHA_CUT_DISCARD
	subtitle.basis = Basis(Vector3.RIGHT, Vector3(0.0, 0.0, -1.0), Vector3.UP)
	subtitle.position = Vector3(0.0, BOARD_FACE_Y + 0.03, 0.62)
	add_child(subtitle)

## The painted board face: a flat square plane carrying the board artwork.
##
## A PlaneMesh faces +Y and its texture-space top edge (-UV.y) lies along world
## -Z, so with the default camera looking from +Z the image reads the right way
## up, and the artwork's bottom-right corner lands on the board's +X/+Z corner,
## which is index 0 (GO).
func _build_board_face() -> void:
	var texture := board_face_texture
	if texture == null and ResourceLoader.exists(BOARD_FACE_PATH):
		texture = load(BOARD_FACE_PATH)
	if texture == null:
		push_warning("Board face art missing at %s; the felt deck will show instead." % BOARD_FACE_PATH)
		return

	var face := MeshInstance3D.new()
	face.name = "BoardFace"
	var plane := PlaneMesh.new()
	plane.size = Vector2(board_face_span, board_face_span)
	face.mesh = plane

	var mat := StandardMaterial3D.new()
	mat.albedo_texture = texture
	# The artwork is already a lit illustration, so leave it unshaded. Shading it
	# under the room lights would dim and wash out the printed colours.
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	face.material_override = mat

	face.position = Vector3(0.0, BOARD_FACE_Y, 0.0)
	add_child(face)

func _build_tile(index: int) -> Node3D:
	# Anchor only. The painted board face already carries the spaces, colour
	# groups and labels, so no per-tile geometry is drawn here. The anchor keeps
	# the tile_nodes lookup and keeps movement resolving through tile_position().
	var node := Node3D.new()
	node.name = "Tile%02d" % index
	node.position = tile_position(index)
	add_child(node)
	return node

func _base_color(type: String) -> Color:
	match type:
		"property":
			return COLOR_PROPERTY
		"card":
			return COLOR_CARD
		"tax":
			return COLOR_TAX
		"transit":
			return COLOR_TRANSIT
		"utility":
			return COLOR_UTILITY
		"go":
			return COLOR_GO
		"jail":
			return COLOR_JAIL
		"free_parking":
			return COLOR_PARKING
		"go_to_jail":
			return COLOR_GO_JAIL
	return COLOR_CORNER

func _text_color(background: Color) -> Color:
	if background.get_luminance() < 0.5:
		return Color(0.96, 0.96, 0.98)
	return Color(0.09, 0.09, 0.12)

func _material(color: Color, roughness: float, metallic := 0.0, emission := 0.0) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = metallic
	if emission > 0.0:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = emission
	return mat
