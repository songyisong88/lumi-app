const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  cart: 'M3 4h2.2l2.3 11h10.7l2.3-8H7M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  play: 'M8 5.5v13l10.5-6.5z',
  bolt: 'M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z',
  star: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.1 6.6 20l1.1-6.1-4.5-4.3 6.1-.8z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  redo: 'M20 11a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  target: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4',
  chat: 'M4 5h16v11H9l-5 4z',
  robot: 'M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM12 4v4M9 13h.01M15 13h.01M9.5 16.5h5',
  flow: 'M5 4h5v5H5zM14 15h5v5h-5zM7.5 9v3.5a2 2 0 0 0 2 2h7v.5',
  game: 'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6H9A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  puzzle: 'M10 4a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4h2a2 2 0 0 0 0-4H6V6h4z',
  ext: 'M5 5h6v6H5zM13 13h6v6h-6zM16 5a3 3 0 1 0 0 .01M5 16l3-3 3 3-3 3z',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  sparkle: 'M10.5 3l1.9 5.6L18 10.5l-5.6 1.9L10.5 18l-1.9-5.6L3 10.5l5.6-1.9zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z',
}

export type IconName = keyof typeof P

interface Props {
  name: IconName | string
  size?: number
  color?: string
  stroke?: number
  fill?: string
  className?: string
}

export function Icon({ name, size = 18, color = 'currentColor', stroke = 2, fill = 'none', className }: Props) {
  return (
    <svg className={className ? `ic ${className}` : 'ic'} width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  )
}
