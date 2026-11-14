export function PartArt({ variant = 0 }: { variant?: number }) {
  if (variant === 1)
    return (
      <svg viewBox="0 0 320 240" aria-hidden="true">
        <defs>
          <linearGradient id="tube" x2="1" y2="1">
            <stop stopColor="#deb7ec" />
            <stop offset="1" stopColor="#9a79b7" />
          </linearGradient>
        </defs>
        <ellipse cx="165" cy="192" rx="82" ry="20" fill="#26382b" opacity=".07" />
        <path d="M85 88v74c0 28 150 28 150 0V88Z" fill="url(#tube)" />
        <ellipse cx="160" cy="88" rx="75" ry="35" fill="#dfc1eb" />
        <ellipse cx="160" cy="88" rx="34" ry="16" fill="#644978" />
        <path d="M126 88v35c17 11 51 11 68 0V88" fill="#8a689f" />
        {[105, 113, 121, 129, 137, 145, 153, 161].map((y) => (
          <path
            key={y}
            d={`M86 ${y}c6 31 141 31 148 0`}
            fill="none"
            stroke="#654f7b"
            opacity=".13"
          />
        ))}
      </svg>
    );
  if (variant === 2)
    return (
      <svg viewBox="0 0 320 240" aria-hidden="true">
        <ellipse cx="165" cy="194" rx="83" ry="19" fill="#26382b" opacity=".07" />
        <path d="m80 79 80-42 80 42-80 44Z" fill="#f3cd9b" />
        <path d="m80 79 80 44v83l-80-44Z" fill="#dca86b" />
        <path d="m160 123 80-44v83l-80 44Z" fill="#edbd85" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`m80 ${87 + i * 6} 80 44 80-44`}
            fill="none"
            stroke="#a47846"
            opacity=".17"
          />
        ))}
        <path d="m110 95 21-11 22 11-22 12z" fill="none" stroke="#9f794b" strokeWidth="2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 320 240" aria-hidden="true">
      <defs>
        <linearGradient id="plate" x2="0" y2="1">
          <stop stopColor="#badac8" />
          <stop offset="1" stopColor="#79ac94" />
        </linearGradient>
      </defs>
      <ellipse cx="164" cy="190" rx="110" ry="18" fill="#26382b" opacity=".07" />
      <path d="m44 116 145-77 94 52v26l-144 78-95-52Z" fill="#78a68d" />
      <path d="m44 116 145-77 94 52-144 78Z" fill="url(#plate)" />
      <path d="m44 116 95 53v26l-95-52Z" fill="#99c4ac" />
      <ellipse cx="164" cy="106" rx="30" ry="16" fill="#537c68" />
      <path d="M134 105c8-18 53-18 60 0v5c-6-17-53-16-60 0Z" fill="#3c6450" />
      {[124, 129, 134, 139].map((y) => (
        <path key={y} d={`m44 ${y} 95 53 144-78`} fill="none" stroke="#365f49" opacity=".13" />
      ))}
      <path d="m139 169 144-78" stroke="#d2e8da" fill="none" />
    </svg>
  );
}
export function HeroArt() {
  return (
    <svg viewBox="0 0 520 390" className="hero-art" aria-hidden="true">
      <defs>
        <pattern
          id="grid"
          width="26"
          height="26"
          patternUnits="userSpaceOnUse"
          patternTransform="matrix(1 .5 -1 .5 260 20)"
        >
          <path d="M26 0H0V26" fill="none" stroke="#a4bdad" strokeWidth=".7" />
        </pattern>
        <linearGradient id="block" x2="0" y2="1">
          <stop stopColor="#b0d3bc" />
          <stop offset="1" stopColor="#6c9e81" />
        </linearGradient>
      </defs>
      <rect width="520" height="390" fill="url(#grid)" />
      <ellipse cx="276" cy="309" rx="150" ry="31" fill="#48674f" opacity=".08" />
      <path d="m107 184 173-92 144 77v66L251 328l-144-78Z" fill="#86b092" />
      <path d="m107 184 144 77v67l-144-78Z" fill="#9bc5a7" />
      <path d="m107 184 173-92 144 77-173 92Z" fill="url(#block)" />
      <ellipse cx="266" cy="179" rx="54" ry="29" fill="#426b50" />
      <path d="M212 179c10-36 96-35 108 0v24c-9-35-99-35-108 0Z" fill="#537e60" />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`m107 ${190 + i * 5} 144 77 173-92`}
          fill="none"
          stroke="#416c4e"
          strokeWidth="1"
          opacity=".15"
        />
      ))}
      <path
        d="m100 266 150 80 181-96M95 267v-15M250 346v-17M431 250v-18"
        stroke="#77927d"
        fill="none"
        strokeWidth="1"
      />
      <text
        x="325"
        y="311"
        fill="#4b6a54"
        fontFamily="monospace"
        fontSize="12"
        transform="rotate(-28 325 311)"
      >
        70.00 mm
      </text>
      <path d="m88 177 173-94M88 177v-15M261 83V68" stroke="#77927d" fill="none" />
      <text
        x="145"
        y="130"
        fill="#4b6a54"
        fontFamily="monospace"
        fontSize="12"
        transform="rotate(-28 145 130)"
      >
        45.00 mm
      </text>
      <circle cx="423" cy="73" r="5" fill="#325c42" />
      <path d="M423 73h40v41" stroke="#799b82" fill="none" />
      <text x="397" y="137" fill="#476b50" fontFamily="monospace" fontSize="10">
        PETG / FDM
      </text>
      <text x="100" y="365" fill="#7d9783" fontFamily="monospace" fontSize="10">
        OPENPRINT — MADE TO BE MADE.
      </text>
    </svg>
  );
}
