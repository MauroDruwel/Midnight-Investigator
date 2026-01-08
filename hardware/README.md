# Midnight Investigator - Hardware Terminal API

This folder contains the firmware for the ESP32-based LED hardware terminal. The terminal syncs physical room lighting with the digital investigation state.

## 📡 API Endpoint: `/set`

The terminal hosts a web server on its local IP. Use the `/set` endpoint to update colors and animations.

### 🛠 Parameters

| Parameter | Type | Range | Description |
| :--- | :--- | :--- | :--- |
| `r` | int | 0–255 | Red component |
| `g` | int | 0–255 | Green component |
| `b` | int | 0–255 | Blue component |
| `mode` | int | 0–3 | Animation selection (see below) |

### 🎬 Animation Modes

| ID | Name | Description |
| :--- | :--- | :--- |
| `0` | **STILL** | Solid color, no movement. |
| `1` | **PULSE** | Smooth breathing effect (Idle state). |
| `2` | **SPINNER** | Circular comet tail (Processing state). |
| `3` | **RAINBOW** | Cycling gradient (Vibe state). |

## 🚀 Usage Examples

Replace `[IP_ADDRESS]` with the terminal's IP (found in Serial Monitor during boot).

### Set to Pulse Emerald (Idle)
```bash
curl "http://[IP_ADDRESS]/set?r=0&g=255&b=150&mode=1"
```

### Set to Blue Spinner (Processing)
```bash
curl "http://[IP_ADDRESS]/set?r=0&g=100&b=255&mode=2"
```

### Set to Static Crimson
```bash
curl "http://[IP_ADDRESS]/set?r=255&g=0&b=0&mode=0"
```
