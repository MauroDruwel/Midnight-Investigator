// Utility to play a sound effect
export function playSound(src) {
  const audio = new window.Audio(src);
  audio.volume = 0.5; // Set volume as needed
  audio.play();
}
