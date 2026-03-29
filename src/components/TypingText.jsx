import { useEffect, useState } from 'react'

export default function TypingText({ text, className = '', speedMs = 26 }) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    let id
    const start = window.setTimeout(() => {
      setShown('')
      if (!text) return
      let i = 0
      id = window.setInterval(() => {
        i += 1
        setShown(text.slice(0, i))
        if (i >= text.length) window.clearInterval(id)
      }, speedMs)
    }, 0)
    return () => {
      window.clearTimeout(start)
      if (id) window.clearInterval(id)
    }
  }, [text, speedMs])

  return <span className={className}>{shown}</span>
}
