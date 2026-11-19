import { useContext } from "react"
import { createPortal } from "react-dom"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { ThemeContext } from "@/contexts/ThemeContext"
import { useSystemTheme } from "@/hooks/useSystemTheme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { appearance } = useContext(ThemeContext)
  const resolvedAppearance = useSystemTheme(appearance)

  return (
    createPortal(
      <div className="km-toaster-portal" data-km-toaster-portal="">
        <Sonner
          theme={resolvedAppearance as ToasterProps["theme"]}
          className="toaster group km-ui-toaster"
          style={
            {
              "--normal-bg": "var(--popover)",
              "--normal-text": "var(--popover-foreground)",
              "--normal-border": "var(--border)",
            } as React.CSSProperties
          }
          {...props}
        />
      </div>,
      document.body,
    )
  )
}

export { Toaster }
