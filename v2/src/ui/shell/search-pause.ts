/**
 * How long the top search waits after the last letter typed before it asks the server (Landing 52, FIX-13): long
 * enough that a word typed at an ordinary pace is one request, short enough that the answer still feels immediate.
 */
export const SEARCH_PAUSE_MS = 250;
