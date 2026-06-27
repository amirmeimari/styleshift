// Typed message protocol exchanged between extension pages, the background
// service worker, and content scripts.

export type ReinjectMessage = {
  type: "STYLESHIFT_REINJECT";
};

export type StyleShiftMessage = ReinjectMessage;

export function isReinjectMessage(
  message: unknown,
): message is ReinjectMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "STYLESHIFT_REINJECT"
  );
}
