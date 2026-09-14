extends Camera3D

## Free board camera. Left-drag orbits, the wheel zooms, right-drag (or middle-drag)
## slides the board, WASD slides it too, and R returns to the starting view.
##
## The mouse is never captured, so the cursor stays free for the HUD at all times.
## The board is nudged left by half of the space reserved for the side panel, so the
## panel never sits on top of the far side of the board.

const MIN_PITCH := -86.0
const MAX_PITCH := -8.0
const MIN_DISTANCE := 3.5
const MAX_DISTANCE := 32.0
const FOCUS_LIMIT := 13.0
const KEY_ORBIT_SPEED := 80.0
const CLICK_NUDGE_DEGREES := 6.0

@export var start_yaw := -15.0
@export var start_pitch := -46.0
@export var start_distance := 17.0
@export var orbit_sensitivity := 0.30
@export var pan_sensitivity := 0.0030
@export var zoom_step := 1.12
@export var smoothing := 14.0
@export var key_pan_speed := 10.0

## Pixels reserved on the right for the HUD panel. Set by the HUD when the panel
## is hidden so the board recentres.
var panel_reserve_px := 300.0

var _yaw := 0.0
var _pitch := -46.0
var _distance := 17.0
var _focus := Vector3.ZERO

var _target_yaw := 0.0
var _target_pitch := -46.0
var _target_distance := 17.0
var _target_focus := Vector3.ZERO

## Direction held by the on-screen turn buttons: -1 is left, 0 released, 1 is right.
var _button_turn := 0.0

var _orbiting := false
var _panning := false

func _ready() -> void:
	_yaw = start_yaw
	_pitch = start_pitch
	_distance = start_distance
	_target_yaw = _yaw
	_target_pitch = _pitch
	_target_distance = _distance
	_focus = Vector3.ZERO
	_target_focus = _focus
	_apply_transform()

func _process(delta: float) -> void:
	_release_stale_drag()
	_apply_turn_input(delta)
	_process_key_pan(delta)
	var weight := 1.0 - exp(-smoothing * delta)
	_yaw = lerp_angle(_yaw, _target_yaw, weight)
	_pitch = lerpf(_pitch, _target_pitch, weight)
	_distance = lerpf(_distance, _target_distance, weight)
	_focus = _focus.lerp(_target_focus, weight)
	_apply_transform()

func reset_view() -> void:
	_target_yaw = start_yaw
	_target_pitch = start_pitch
	_target_distance = start_distance
	_target_focus = Vector3.ZERO

func set_panel_reserve(px: float) -> void:
	panel_reserve_px = px

## Start a held turn from an on-screen button. A short nudge is applied straight
## away so a quick click still visibly turns the view, then the hold turns at a
## constant rate in _apply_turn_input.
func begin_turn(direction: int) -> void:
	_button_turn = float(clampi(direction, -1, 1))
	_target_yaw += _button_turn * CLICK_NUDGE_DEGREES

func end_turn() -> void:
	_button_turn = 0.0

## Turn the view by a fixed number of degrees in one step.
func orbit_step(degrees: float) -> void:
	_target_yaw += degrees

## Drag motion is read here rather than in _unhandled_input. A press that starts a
## drag is still only accepted when no HUD control wants it, but once a drag is
## live it must keep tracking even if the cursor crosses a panel. A panel swallows
## mouse motion, which froze the rotation part way through a drag.
func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var motion := event as InputEventMouseMotion
		if _orbiting:
			_rotate_mouse(motion.relative.x, motion.relative.y)
		elif _panning:
			_slide(-motion.relative.x, motion.relative.y, pan_sensitivity)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		match button.button_index:
			MOUSE_BUTTON_LEFT:
				_orbiting = button.pressed
			MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE:
				_panning = button.pressed
			MOUSE_BUTTON_WHEEL_UP:
				if button.pressed:
					_target_distance = clampf(_target_distance / zoom_step, MIN_DISTANCE, MAX_DISTANCE)
			MOUSE_BUTTON_WHEEL_DOWN:
				if button.pressed:
					_target_distance = clampf(_target_distance * zoom_step, MIN_DISTANCE, MAX_DISTANCE)
	elif event is InputEventKey:
		var key := event as InputEventKey
		if key.pressed and not key.echo and key.physical_keycode == KEY_R:
			reset_view()

## Move the view focus across the ground plane. Direction is taken from the current
## yaw only, so sliding always stays flat no matter how far the camera is tilted.
func _slide(dx: float, dy: float, sensitivity: float) -> void:
	var scale := sensitivity * (_distance / start_distance)
	_target_focus -= _horizontal_right() * dx * scale
	_target_focus += _horizontal_forward() * dy * scale
	_clamp_focus()

## Mouse look is applied 1:1 with no easing. Easing a drag reads as rubber-banding:
## the view trails the cursor and keeps gliding after the mouse stops, which is
## what makes a mouse turn feel rough next to the constant-rate key/button turn.
func _rotate_mouse(dx: float, dy: float) -> void:
	var yaw_delta := -dx * orbit_sensitivity
	var pitch_delta := -dy * orbit_sensitivity
	_target_yaw += yaw_delta
	_yaw += yaw_delta
	_target_pitch = clampf(_target_pitch + pitch_delta, MIN_PITCH, MAX_PITCH)
	_pitch = clampf(_pitch + pitch_delta, MIN_PITCH, MAX_PITCH)
	_wrap_yaw()

## Keep yaw inside a single turn. lerp_angle takes the shortest path between two
## angles, so an unbounded yaw would eventually read as a backwards spin.
func _wrap_yaw() -> void:
	_yaw = wrapf(_yaw, -180.0, 180.0)
	_target_yaw = wrapf(_target_yaw, -180.0, 180.0)

## A drag ends when the physical button comes up. Waiting only for the release
## event leaves the view stuck spinning if a HUD control consumed that release.
func _release_stale_drag() -> void:
	if _orbiting and not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_orbiting = false
	if _panning and not (Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) or Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE)):
		_panning = false

## Turn the view at a constant rate while a turn input is held. The step is applied
## to the smoothed yaw as well as the target, so an active turn has no lag and no
## settle-in crawl; releasing simply leaves nothing left to ease.
##
## Left arrow, Q and the "< Turn Left" button all turn the same way (negative yaw).
func _apply_turn_input(delta: float) -> void:
	var turn := _button_turn
	if Input.is_physical_key_pressed(KEY_LEFT) or Input.is_physical_key_pressed(KEY_Q):
		turn -= 1.0
	if Input.is_physical_key_pressed(KEY_RIGHT) or Input.is_physical_key_pressed(KEY_E):
		turn += 1.0
	turn = clampf(turn, -1.0, 1.0)
	if is_zero_approx(turn):
		return
	var step := turn * KEY_ORBIT_SPEED * delta
	_target_yaw += step
	_yaw += step
	_wrap_yaw()

func _process_key_pan(delta: float) -> void:
	var move_x := 0.0
	var move_z := 0.0
	if Input.is_physical_key_pressed(KEY_W):
		move_z += 1.0
	if Input.is_physical_key_pressed(KEY_S):
		move_z -= 1.0
	if Input.is_physical_key_pressed(KEY_A):
		move_x -= 1.0
	if Input.is_physical_key_pressed(KEY_D):
		move_x += 1.0
	if is_zero_approx(move_x) and is_zero_approx(move_z):
		return
	var speed := key_pan_speed * (_distance / start_distance) * delta
	_target_focus += _horizontal_right() * move_x * speed
	_target_focus += _horizontal_forward() * move_z * speed
	_clamp_focus()

func _clamp_focus() -> void:
	_target_focus.x = clampf(_target_focus.x, -FOCUS_LIMIT, FOCUS_LIMIT)
	_target_focus.z = clampf(_target_focus.z, -FOCUS_LIMIT, FOCUS_LIMIT)
	_target_focus.y = 0.0

func _horizontal_right() -> Vector3:
	var y := deg_to_rad(_yaw)
	return Vector3(cos(y), 0.0, -sin(y))

func _horizontal_forward() -> Vector3:
	var y := deg_to_rad(_yaw)
	return Vector3(-sin(y), 0.0, -cos(y))

func _apply_transform() -> void:
	var pitch_rad := deg_to_rad(_pitch)
	var yaw_rad := deg_to_rad(_yaw)
	var cp := cos(pitch_rad)
	var offset := Vector3(
		_distance * cp * sin(yaw_rad),
		-_distance * sin(pitch_rad),
		_distance * cp * cos(yaw_rad)
	)
	global_position = _focus + offset

	var look_target := _focus
	var viewport := get_viewport()
	if viewport != null and panel_reserve_px > 0.0:
		var view_size := viewport.get_visible_rect().size
		if view_size.x > 1.0 and view_size.y > 1.0:
			var aspect := view_size.x / view_size.y
			var visible_width := 2.0 * _distance * tan(deg_to_rad(fov * 0.5)) * aspect
			var reserve := clampf(panel_reserve_px / view_size.x, 0.0, 0.5)
			look_target += _horizontal_right() * visible_width * reserve * 0.5

	if look_target.distance_squared_to(global_position) > 0.01:
		look_at(look_target, Vector3.UP)
