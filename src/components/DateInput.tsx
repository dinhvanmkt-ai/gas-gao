'use client'
import { useRef, useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'

interface DateInputProps {
  value: string
  onChange: (val: string) => void
  className?: string
  placeholder?: string
  id?: string
}

export default function DateInput({
  value,
  onChange,
  className = 'input',
  placeholder = 'dd/mm/yyyy',
  id,
}: DateInputProps) {
  const [display, setDisplay] = useState('')
  const hiddenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-')
      setDisplay(`${d}/${m}/${y}`)
    } else {
      setDisplay('')
    }
  }, [value])

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value
    raw = raw.replace(/[^\d/]/g, '')
    if (raw.length === 2 && display.length === 1) raw += '/'
    if (raw.length === 5 && display.length === 4) raw += '/'
    if (raw.length > 10) raw = raw.slice(0, 10)
    setDisplay(raw)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/')
      const iso = `${y}-${m}-${d}`
      const date = new Date(iso)
      if (!isNaN(date.getTime())) {
        onChange(iso)
      }
    }
  }

  function handleCalendarChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  function openPicker() {
    try {
      hiddenRef.current?.showPicker()
    } catch {
      hiddenRef.current?.click()
    }
  }

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        value={display}
        onChange={handleTextChange}
        className={`${className} pr-8`}
        placeholder={placeholder}
        maxLength={10}
        inputMode="numeric"
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 text-slate-400 hover:text-orange-400 transition-colors"
        tabIndex={-1}
        aria-label="Chon ngay tu lich"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleCalendarChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
