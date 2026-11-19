import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

let mediaQueryList: MediaQueryList | null = null
const listeners = new Set<() => void>()

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }
  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia(MOBILE_QUERY)
    mediaQueryList.addEventListener("change", () => {
      listeners.forEach((listener) => listener())
    })
  }
  return mediaQueryList
}

function subscribe(listener: () => void) {
  getMediaQueryList()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return getMediaQueryList()?.matches ?? false
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
