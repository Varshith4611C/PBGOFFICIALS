class_name BoardData
extends RefCounted

## Static definition of the 40 tile business board.
## Index 0 is GO in the bottom-right corner. Indices run counter-clockwise:
## 0-10 along the bottom, 10-20 up the left, 20-30 across the top, 30-40 down the right.
##
## All property names here are original. Do not copy names from a commercial board game.

const BOARD_SIZE := 40

## Corner the player is sent to by the "go_to_jail" tile.
const JAIL_INDEX := 10

const START_MONEY := 1500
const GO_SALARY := 200

const GROUP_COLORS := {
	"brown": Color(0.47, 0.29, 0.16),
	"light_blue": Color(0.40, 0.75, 0.96),
	"pink": Color(0.91, 0.29, 0.62),
	"orange": Color(0.98, 0.55, 0.11),
	"red": Color(0.89, 0.19, 0.22),
	"yellow": Color(0.98, 0.84, 0.17),
	"green": Color(0.18, 0.69, 0.36),
	"dark_blue": Color(0.26, 0.36, 0.90),
}

## rent is [base, 1 house, 2 houses, 3 houses, 4 houses, hotel]
const TILES := [
	{"name": "GO", "short": "GO", "type": "go"},
	{"name": "Old Mill Road", "short": "OLD MILL", "type": "property", "group": "brown", "price": 60, "house_cost": 50, "rent": [2, 10, 30, 90, 160, 250]},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Cobble Lane", "short": "COBBLE", "type": "property", "group": "brown", "price": 60, "house_cost": 50, "rent": [4, 20, 60, 180, 320, 450]},
	{"name": "City Tax", "short": "CITY TAX", "type": "tax", "amount": 200},
	{"name": "North Station", "short": "N STATION", "type": "transit", "price": 200},
	{"name": "Harbor Street", "short": "HARBOR", "type": "property", "group": "light_blue", "price": 100, "house_cost": 50, "rent": [6, 30, 90, 270, 400, 550]},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Fisherman's Wharf", "short": "WHARF", "type": "property", "group": "light_blue", "price": 100, "house_cost": 50, "rent": [6, 30, 90, 270, 400, 550]},
	{"name": "Lakeside Drive", "short": "LAKESIDE", "type": "property", "group": "light_blue", "price": 120, "house_cost": 50, "rent": [8, 40, 100, 300, 450, 600]},
	{"name": "Jail", "short": "JAIL", "type": "jail"},
	{"name": "Rose Avenue", "short": "ROSE AVE", "type": "property", "group": "pink", "price": 140, "house_cost": 100, "rent": [10, 50, 150, 450, 625, 750]},
	{"name": "Power Grid", "short": "POWER", "type": "utility", "price": 150},
	{"name": "Velvet Boulevard", "short": "VELVET", "type": "property", "group": "pink", "price": 140, "house_cost": 100, "rent": [10, 50, 150, 450, 625, 750]},
	{"name": "Amber Court", "short": "AMBER", "type": "property", "group": "pink", "price": 160, "house_cost": 100, "rent": [12, 60, 180, 500, 700, 900]},
	{"name": "Central Station", "short": "C STATION", "type": "transit", "price": 200},
	{"name": "Market Square", "short": "MARKET", "type": "property", "group": "orange", "price": 180, "house_cost": 100, "rent": [14, 70, 200, 550, 750, 950]},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Copper Row", "short": "COPPER", "type": "property", "group": "orange", "price": 180, "house_cost": 100, "rent": [14, 70, 200, 550, 750, 950]},
	{"name": "Sunset Terrace", "short": "SUNSET", "type": "property", "group": "orange", "price": 200, "house_cost": 100, "rent": [16, 80, 220, 600, 800, 1000]},
	{"name": "Free Parking", "short": "PARKING", "type": "free_parking"},
	{"name": "Crimson Street", "short": "CRIMSON", "type": "property", "group": "red", "price": 220, "house_cost": 150, "rent": [18, 90, 250, 700, 875, 1050]},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Ruby Heights", "short": "RUBY", "type": "property", "group": "red", "price": 220, "house_cost": 150, "rent": [18, 90, 250, 700, 875, 1050]},
	{"name": "Scarlet Plaza", "short": "SCARLET", "type": "property", "group": "red", "price": 240, "house_cost": 150, "rent": [20, 100, 300, 750, 925, 1100]},
	{"name": "East Station", "short": "E STATION", "type": "transit", "price": 200},
	{"name": "Golden Mile", "short": "GOLDEN", "type": "property", "group": "yellow", "price": 260, "house_cost": 150, "rent": [22, 110, 330, 800, 975, 1150]},
	{"name": "Lucky Lane", "short": "LUCKY", "type": "property", "group": "yellow", "price": 260, "house_cost": 150, "rent": [22, 110, 330, 800, 975, 1150]},
	{"name": "Water Works", "short": "WATER", "type": "utility", "price": 150},
	{"name": "Harvest Way", "short": "HARVEST", "type": "property", "group": "yellow", "price": 280, "house_cost": 150, "rent": [24, 120, 360, 850, 1025, 1200]},
	{"name": "Go To Jail", "short": "GO JAIL", "type": "go_to_jail"},
	{"name": "Evergreen Park", "short": "EVERGREEN", "type": "property", "group": "green", "price": 300, "house_cost": 200, "rent": [26, 130, 390, 900, 1100, 1275]},
	{"name": "Cedar Grove", "short": "CEDAR", "type": "property", "group": "green", "price": 300, "house_cost": 200, "rent": [26, 130, 390, 900, 1100, 1275]},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Emerald Estate", "short": "EMERALD", "type": "property", "group": "green", "price": 320, "house_cost": 200, "rent": [28, 150, 450, 1000, 1200, 1400]},
	{"name": "West Station", "short": "W STATION", "type": "transit", "price": 200},
	{"name": "Fortune Card", "short": "CARD", "type": "card"},
	{"name": "Summit Tower", "short": "SUMMIT", "type": "property", "group": "dark_blue", "price": 350, "house_cost": 200, "rent": [35, 175, 500, 1100, 1300, 1500]},
	{"name": "Luxury Tax", "short": "LUX TAX", "type": "tax", "amount": 100},
	{"name": "Crown Plaza", "short": "CROWN", "type": "property", "group": "dark_blue", "price": 400, "house_cost": 200, "rent": [50, 200, 600, 1400, 1700, 2000]},
]

## Fortune card effects. delta is money gained (positive) or lost (negative).
const CARDS := [
	{"text": "Bank dividend. Collect $50.", "delta": 50},
	{"text": "Business trip. Pay $100.", "delta": -100},
	{"text": "Your shop had a great week. Collect $150.", "delta": 150},
	{"text": "Marketing spend. Pay $75.", "delta": -75},
	{"text": "Tax refund. Collect $25.", "delta": 25},
	{"text": "Building repairs. Pay $120.", "delta": -120},
	{"text": "A supplier paid early. Collect $200.", "delta": 200},
	{"text": "Legal fees. Pay $150.", "delta": -150},
]

static func tile(index: int) -> Dictionary:
	return TILES[posmod(index, BOARD_SIZE)]

static func tile_type(index: int) -> String:
	return str(TILES[posmod(index, BOARD_SIZE)].get("type", ""))

static func is_ownable(index: int) -> bool:
	var t := tile_type(index)
	return t == "property" or t == "transit" or t == "utility"

## All board indices that share a colour group (used for monopoly double rent).
static func group_indices(group: String) -> Array:
	var out: Array = []
	for i in TILES.size():
		if str(TILES[i].get("group", "")) == group:
			out.append(i)
	return out
