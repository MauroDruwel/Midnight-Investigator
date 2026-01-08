const HARDWARE_IP = "http://192.168.20.223";

export enum HardwareMode {
    STILL = 0,
    PULSE = 1,
    SPINNER = 2,
    RAINBOW = 3,
}

// Fire and forget fetch to avoid awaiting hardware response
const sendCommand = (params: URLSearchParams) => {
    const url = `${HARDWARE_IP}/set?${params.toString()}`;
    // mode: 'no-cors' is crucial because the hardware likely doesn't send CORS headers,
    // and we don't care about reading the response, just sending the command.
    fetch(url, { mode: "no-cors" }).catch((e) =>
        console.warn("Hardware sync failed:", e)
    );
};

export const setHardwareState = (
    r: number,
    g: number,
    b: number,
    mode: HardwareMode
) => {
    const params = new URLSearchParams({
        r: r.toString(),
        g: g.toString(),
        b: b.toString(),
        mode: mode.toString(),
    });
    sendCommand(params);
};

export const setHardwareIdle = () => {
    // Midnight Emerald Pulse
    setHardwareState(0, 255, 150, HardwareMode.PULSE);
};

export const setHardwareProcessing = () => {
    // Deep Blue Spinner
    setHardwareState(0, 100, 255, HardwareMode.SPINNER);
};

export const setHardwareGuilt = (guiltLevel: number) => {
    // Interpolate from Green (0) to Red (100)
    // 0 -> 0, 255, 0
    // 50 -> 255, 255, 0 (Yellowish)
    // 100 -> 255, 0, 0

    // Simple mapping
    const r = Math.min(255, (guiltLevel / 50) * 255);
    const g = Math.min(255, ((100 - guiltLevel) / 50) * 255);

    // Use STILL mode for specific suspect focus
    setHardwareState(Math.floor(r), Math.floor(g), 0, HardwareMode.STILL);
};
