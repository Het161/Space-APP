/** The orbitWx logomark: a planet crossed by an inclined orbit. */
export function OrbitMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      <circle
        cx="16"
        cy="16"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
        opacity="0.9"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6"
        transform="rotate(-28 16 16)"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.5"
      />
      <circle cx="27" cy="10" r="2.1" fill="currentColor" />
    </svg>
  );
}
