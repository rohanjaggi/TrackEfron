/**
 * Shared by the server layout and the client mode provider, so this file must
 * NOT be a client module: a "use client" export would reach the server as an
 * opaque reference instead of a string.
 */
export const MODE_STORAGE_KEY = "trackefron-mode";

/**
 * Inline script for <head>. Runs before first paint so the accent colour and
 * surface character are right from the first frame for music-mode users.
 */
export const MODE_BOOT_SCRIPT = `try{var m=localStorage.getItem("${MODE_STORAGE_KEY}");document.documentElement.setAttribute("data-mode",m==="music"?"music":"film")}catch(e){document.documentElement.setAttribute("data-mode","film")}`;
