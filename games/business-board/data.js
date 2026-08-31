/* ============================================
   PBG Business Board Game — Game Data
   Classic Indian Business Board (40 spaces)
   Exact replica of the classic Indian Business Board
   ============================================ */

// ── Currency symbol ──
const CURRENCY = '₹';

// ── Starting cash & salaries ──
const STARTING_CASH = 1500;
const GO_SALARY = 200;

// ── Color groups (8 groups matching the image) ──
const COLOR_GROUPS = {
  brown:     { name: 'Brown',      color: '#8B4513', headerBg: '#795548', buildCost: 50,  properties: [1, 3] },
  lightblue: { name: 'Light Blue', color: '#38bdf8', headerBg: '#0284c7', buildCost: 50,  properties: [6, 8, 9] },
  pink:      { name: 'Pink',       color: '#ec4899', headerBg: '#db2777', buildCost: 100, properties: [11, 13, 14] },
  orange:    { name: 'Orange',     color: '#f97316', headerBg: '#ea580c', buildCost: 100, properties: [16, 18, 19] },
  red:       { name: 'Red',        color: '#ef4444', headerBg: '#dc2626', buildCost: 150, properties: [21, 23, 24] },
  yellow:    { name: 'Yellow',     color: '#eab308', headerBg: '#ca8a04', buildCost: 150, properties: [26, 27, 29] },
  green:     { name: 'Green',      color: '#22c55e', headerBg: '#16a34a', buildCost: 200, properties: [31, 32, 34] },
  darkblue:  { name: 'Dark Blue',  color: '#3b82f6', headerBg: '#1d4ed8', buildCost: 200, properties: [37, 39] },
};

// ── Board Spaces (40 total) — Exact names & values from the image ──
const BOARD_SPACES = [
  // ── Position 0: GO (Bottom-Right corner) ──
  { id: 0, type: 'corner', name: 'GO', icon: '➡️', description: 'Collect ₹200 salary as you pass' },

  // ── Bottom row (GO → JAIL, right to left) ──
  { id: 1, type: 'property', name: 'GUWAHATI', group: 'brown', price: 60,
    rent: [2, 10, 30, 90, 160, 250], icon: '🏠' },
  { id: 2, type: 'community', name: 'CHEST', icon: '📦', description: 'Draw a Community Chest card' },
  { id: 3, type: 'property', name: 'BHUBANESWAR', group: 'brown', price: 60,
    rent: [4, 20, 60, 180, 320, 450], icon: '🏠' },
  { id: 4, type: 'tax', name: 'INCOME TAX', amount: 200, icon: '💸', description: 'Pay ₹200' },
  { id: 5, type: 'station', name: 'NEW DELHI STATION', price: 200, icon: '🚂',
    description: 'Rent: 1 Station = ₹25, 2 = ₹50, 3 = ₹100, 4 = ₹200' },
  { id: 6, type: 'property', name: 'PANAJI', group: 'lightblue', price: 100,
    rent: [6, 30, 90, 270, 400, 550], icon: '🏠' },
  { id: 7, type: 'chance', name: 'CHANCE', icon: '❓', description: 'Draw a Chance card' },
  { id: 8, type: 'property', name: 'AGRA', group: 'lightblue', price: 100,
    rent: [6, 30, 90, 270, 400, 550], icon: '🏠' },
  { id: 9, type: 'property', name: 'VADODARA', group: 'lightblue', price: 120,
    rent: [8, 40, 100, 300, 450, 600], icon: '🏠' },

  // ── Position 10: JAIL / JUST VISITING (Bottom-Left corner) ──
  { id: 10, type: 'corner', name: 'JAIL', icon: '🔒', description: 'Just Visiting / In Jail' },

  // ── Left column (JAIL → FREE PARKING, bottom to top) ──
  { id: 11, type: 'property', name: 'LUDHIANA', group: 'pink', price: 140,
    rent: [10, 50, 150, 450, 625, 750], icon: '🏠' },
  { id: 12, type: 'utility', name: 'ELECTRIC COMPANY', price: 150, icon: '⚡',
    description: 'Rent = 4× dice if 1 utility owned, 10× dice if both owned' },
  { id: 13, type: 'property', name: 'PATNA', group: 'pink', price: 140,
    rent: [10, 50, 150, 450, 625, 750], icon: '🏠' },
  { id: 14, type: 'property', name: 'BHOPAL', group: 'pink', price: 160,
    rent: [12, 60, 180, 500, 700, 900], icon: '🏠' },
  { id: 15, type: 'station', name: 'HOWRAH STATION', price: 200, icon: '🚂',
    description: 'Rent: 1 Station = ₹25, 2 = ₹50, 3 = ₹100, 4 = ₹200' },
  { id: 16, type: 'property', name: 'INDORE', group: 'orange', price: 160,
    rent: [12, 60, 180, 500, 700, 900], icon: '🏠' },
  { id: 17, type: 'community', name: 'CHEST', icon: '📦', description: 'Draw a Community Chest card' },
  { id: 18, type: 'property', name: 'NAGPUR', group: 'orange', price: 180,
    rent: [14, 70, 200, 550, 750, 950], icon: '🏠' },
  { id: 19, type: 'property', name: 'KOCHI', group: 'orange', price: 200,
    rent: [16, 80, 220, 600, 800, 1000], icon: '🏠' },

  // ── Position 20: FREE PARKING (Top-Left corner) ──
  { id: 20, type: 'corner', name: 'FREE PARKING', icon: '🅿️', description: 'Resting space — no rent' },

  // ── Top row (FREE PARKING → GO TO JAIL, left to right) ──
  { id: 21, type: 'property', name: 'LUCKNOW', group: 'red', price: 220,
    rent: [18, 90, 250, 700, 875, 1050], icon: '🏠' },
  { id: 22, type: 'chance', name: 'CHANCE', icon: '❓', description: 'Draw a Chance card' },
  { id: 23, type: 'property', name: 'CHANDIGARH', group: 'red', price: 220,
    rent: [18, 90, 250, 700, 875, 1050], icon: '🏠' },
  { id: 24, type: 'property', name: 'JAIPUR', group: 'red', price: 240,
    rent: [20, 100, 300, 750, 925, 1100], icon: '🏠' },
  { id: 25, type: 'station', name: 'CHENNAI STATION', price: 200, icon: '🚂',
    description: 'Rent: 1 Station = ₹25, 2 = ₹50, 3 = ₹100, 4 = ₹200' },
  { id: 26, type: 'property', name: 'PUNE', group: 'yellow', price: 260,
    rent: [22, 110, 330, 800, 975, 1150], icon: '🏠' },
  { id: 27, type: 'property', name: 'HYDERABAD', group: 'yellow', price: 260,
    rent: [22, 110, 330, 800, 975, 1150], icon: '🏠' },
  { id: 28, type: 'utility', name: 'WATER WORKS', price: 150, icon: '💧',
    description: 'Rent = 4× dice if 1 utility owned, 10× dice if both owned' },
  { id: 29, type: 'property', name: 'AHMEDABAD', group: 'yellow', price: 280,
    rent: [24, 120, 360, 850, 1025, 1200], icon: '🏠' },

  // ── Position 30: GO TO JAIL (Top-Right corner) ──
  { id: 30, type: 'corner', name: 'GO TO JAIL', icon: '🚔', description: 'Go directly to Jail! Do not pass GO' },

  // ── Right column (GO TO JAIL → GO, top to bottom) ──
  { id: 31, type: 'property', name: 'KOLKATA', group: 'green', price: 300,
    rent: [26, 130, 390, 900, 1100, 1275], icon: '🏠' },
  { id: 32, type: 'property', name: 'CHENNAI', group: 'green', price: 300,
    rent: [26, 130, 390, 900, 1100, 1275], icon: '🏠' },
  { id: 33, type: 'community', name: 'CHEST', icon: '📦', description: 'Draw a Community Chest card' },
  { id: 34, type: 'property', name: 'BENGALURU', group: 'green', price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400], icon: '🏠' },
  { id: 35, type: 'station', name: 'MUMBAI STATION', price: 200, icon: '🚂',
    description: 'Rent: 1 Station = ₹25, 2 = ₹50, 3 = ₹100, 4 = ₹200' },
  { id: 36, type: 'chance', name: 'CHANCE', icon: '❓', description: 'Draw a Chance card' },
  { id: 37, type: 'property', name: 'DELHI', group: 'darkblue', price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500], icon: '🏠' },
  { id: 38, type: 'tax', name: 'SUPER TAX', amount: 100, icon: '💎', description: 'Pay ₹100' },
  { id: 39, type: 'property', name: 'MUMBAI', group: 'darkblue', price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000], icon: '🏠' },
];

// ── 11×11 Grid Coordinates for each space ──
const GRID_POSITIONS = {
  // Bottom Row (Right → Left): row 11
  0:  { row: 11, col: 11 }, // GO (Bottom Right)
  1:  { row: 11, col: 10 },
  2:  { row: 11, col: 9 },
  3:  { row: 11, col: 8 },
  4:  { row: 11, col: 7 },
  5:  { row: 11, col: 6 },
  6:  { row: 11, col: 5 },
  7:  { row: 11, col: 4 },
  8:  { row: 11, col: 3 },
  9:  { row: 11, col: 2 },
  10: { row: 11, col: 1 },  // JAIL (Bottom Left)

  // Left Column (Bottom → Top): col 1
  11: { row: 10, col: 1 },
  12: { row: 9,  col: 1 },
  13: { row: 8,  col: 1 },
  14: { row: 7,  col: 1 },
  15: { row: 6,  col: 1 },
  16: { row: 5,  col: 1 },
  17: { row: 4,  col: 1 },
  18: { row: 3,  col: 1 },
  19: { row: 2,  col: 1 },
  20: { row: 1,  col: 1 },  // FREE PARKING (Top Left)

  // Top Row (Left → Right): row 1
  21: { row: 1,  col: 2 },
  22: { row: 1,  col: 3 },
  23: { row: 1,  col: 4 },
  24: { row: 1,  col: 5 },
  25: { row: 1,  col: 6 },
  26: { row: 1,  col: 7 },
  27: { row: 1,  col: 8 },
  28: { row: 1,  col: 9 },
  29: { row: 1,  col: 10 },
  30: { row: 1,  col: 11 }, // GO TO JAIL (Top Right)

  // Right Column (Top → Bottom): col 11
  31: { row: 2,  col: 11 },
  32: { row: 3,  col: 11 },
  33: { row: 4,  col: 11 },
  34: { row: 5,  col: 11 },
  35: { row: 6,  col: 11 },
  36: { row: 7,  col: 11 },
  37: { row: 8,  col: 11 },
  38: { row: 9,  col: 11 },
  39: { row: 10, col: 11 },
};

// ── Space Orientation (side of board) ──
const SPACE_SIDES = {};
for (let i = 0; i <= 10; i++) SPACE_SIDES[i] = 'bottom';
for (let i = 11; i <= 20; i++) SPACE_SIDES[i] = 'left';
for (let i = 21; i <= 30; i++) SPACE_SIDES[i] = 'top';
for (let i = 31; i <= 39; i++) SPACE_SIDES[i] = 'right';

// ── Station rent table ──
const STATION_RENT = [0, 25, 50, 100, 200]; // 1, 2, 3, 4 stations owned

// ── Building system — Houses & Hotels ──
const UPGRADE_NAMES = ['Site Only', '1 House', '2 Houses', '3 Houses', '4 Houses', 'HOTEL'];
const MAX_UPGRADES = 5; // 0=site, 1-4=houses, 5=hotel

// ── Jail constants ──
const JAIL_POSITION = 10;
const GOTO_JAIL_POSITION = 30;
const JAIL_BAIL = 50;
const MAX_JAIL_TURNS = 3;

// ── Chance Cards ──
const CHANCE_CARDS = [
  { text: '➡️ Advance to GO. Collect ₹200.', action: 'goto', target: 0 },
  { text: '🚔 Go directly to Jail. Do not pass GO, do not collect ₹200.', action: 'jail' },
  { text: '🏙️ Advance to MUMBAI. If you pass GO, collect ₹200.', action: 'goto', target: 39 },
  { text: '💰 Bank pays you dividend of ₹50.', action: 'collect', amount: 50 },
  { text: '⬅️ Go back 3 spaces.', action: 'moveBack', spaces: 3 },
  { text: '💸 Pay poor tax of ₹15.', action: 'pay', amount: 15 },
  { text: '📈 Your building loan matures. Collect ₹150.', action: 'collect', amount: 150 },
  { text: '🚂 Advance to nearest Station. If unowned, you may buy it.', action: 'nearestStation' },
  { text: '🎯 Advance to JAIPUR. If you pass GO, collect ₹200.', action: 'goto', target: 24 },
  { text: '🏆 You have won a crossword competition! Collect ₹100.', action: 'collect', amount: 100 },
  { text: '🔧 Make general repairs on all your properties: Pay ₹25 per house and ₹100 per hotel.', action: 'repairs', houseRate: 25, hotelRate: 100 },
  { text: '🎉 You have been elected Chairman of the Board. Pay each player ₹50.', action: 'payAll', amount: 50 },
  { text: '⚡ Advance to ELECTRIC COMPANY. If unowned, you may buy it.', action: 'goto', target: 12 },
  { text: '✈️ Take a trip to NEW DELHI STATION. If you pass GO, collect ₹200.', action: 'goto', target: 5 },
];

// ── Community Chest Cards ──
const COMMUNITY_CHEST_CARDS = [
  { text: '➡️ Advance to GO. Collect ₹200.', action: 'goto', target: 0 },
  { text: '🏦 Bank error in your favor. Collect ₹200.', action: 'collect', amount: 200 },
  { text: '🩺 Doctor\'s fee. Pay ₹50.', action: 'pay', amount: 50 },
  { text: '🚔 Go to Jail. Do not pass GO, do not collect ₹200.', action: 'jail' },
  { text: '🎂 It is your birthday! Collect ₹10 from every player.', action: 'collectFromAll', amount: 10 },
  { text: '💵 Income tax refund. Collect ₹20.', action: 'collect', amount: 20 },
  { text: '🏥 Hospital Fees. Pay ₹100.', action: 'pay', amount: 100 },
  { text: '🎓 School Fees. Pay ₹150.', action: 'pay', amount: 150 },
  { text: '💼 Receive ₹25 consultancy fee.', action: 'collect', amount: 25 },
  { text: '📊 Life insurance matures. Collect ₹100.', action: 'collect', amount: 100 },
  { text: '🔧 You are assessed for street repairs: Pay ₹40 per house and ₹115 per hotel.', action: 'repairs', houseRate: 40, hotelRate: 115 },
  { text: '🎖️ You have won second prize in a beauty contest. Collect ₹10.', action: 'collect', amount: 10 },
  { text: '📦 From sale of stock you get ₹50.', action: 'collect', amount: 50 },
  { text: '🎁 Holiday fund matures. Receive ₹100.', action: 'collect', amount: 100 },
];

// ── Player Profiles & Pin Tokens ──
const PLAYER_TOKENS = [
  { id: 0, name: 'Guddu', emoji: '🧑‍💼', color: '#ef4444', pinColor: '#ef4444', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Guddu&backgroundColor=ef4444' },
  { id: 1, name: 'Iava', emoji: '👩‍💼', color: '#22c55e', pinColor: '#22c55e', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Iava&backgroundColor=22c55e' },
  { id: 2, name: 'Raj', emoji: '👨‍💼', color: '#3b82f6', pinColor: '#3b82f6', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Raj&backgroundColor=3b82f6' },
  { id: 3, name: 'Priya', emoji: '👩‍💻', color: '#eab308', pinColor: '#eab308', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Priya&backgroundColor=eab308' },
];

// ── AI Difficulty presets ──
const AI_DIFFICULTY = {
  easy:   { buyThreshold: 0.4, buildThreshold: 0.3, name: 'Easy',   description: 'Random decisions' },
  normal: { buyThreshold: 0.75, buildThreshold: 0.6, name: 'Normal', description: 'Strategic buying & building' },
  hard:   { buyThreshold: 0.95, buildThreshold: 0.85, name: 'Hard',   description: 'Aggressive & optimal' },
};
