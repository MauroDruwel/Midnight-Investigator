import { useEffect, type RefObject } from "react";

export const useOutsideClick = (
  ref: RefObject<HTMLElement | null>,
  callback: (event: Event) => void
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      // DO NOTHING if the element being clicked is the target element or their children
      if (!ref.current || !(event.target instanceof Node) || ref.current.contains(event.target)) {
        return;
      }
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
};
