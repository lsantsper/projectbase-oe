import { useLayoutEffect, useRef, useState } from 'react'

interface Position {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export function useSmartPosition(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement>(null)
  const popoverRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<Position>({})

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !popoverRef.current)
      return

    const trigger = triggerRef.current.getBoundingClientRect()
    const popover = popoverRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = 4

    const pos: Position = {}

    const spaceBelow = vh - trigger.bottom
    const spaceAbove = trigger.top
    if (spaceBelow >= popover.height + GAP || spaceBelow >= spaceAbove) {
      pos.top = trigger.bottom + GAP
    } else {
      pos.bottom = vh - trigger.top + GAP
    }

    const leftAligned = trigger.left
    if (leftAligned + popover.width <= vw - 8) {
      pos.left = leftAligned
    } else {
      pos.left = Math.max(8, vw - popover.width - 8)
    }

    setPosition(pos)
  }, [isOpen])

  return { triggerRef, popoverRef, position }
}
