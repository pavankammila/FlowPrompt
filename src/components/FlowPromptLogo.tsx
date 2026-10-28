import React, { useId } from 'react';

export type LogoVariant = 'full' | 'icon' | 'monochrome' | 'app-icon';

interface FlowPromptLogoProps {
  /**
   * - 'full': Orange flowing F symbol + theme-aware FLOWPROMPT wordmark
   * - 'icon': Orange flowing F symbol only (for compact mobile headers)
   * - 'monochrome': Single-color symbol + wordmark using currentColor
   * - 'app-icon': Rounded squircle badge with orange gradient and white F symbol
   */
  variant?: LogoVariant;
  /** Height of the icon in pixels (default 28) */
  size?: number;
  /** Optional className for container */
  className?: string;
  /** Responsive mode: shows icon-only on xs screens, full wordmark on sm+ */
  responsiveWordmark?: boolean;
}

/**
 * Exact vector recreation of the FLOWPROMPT brand mark:
 * Two forward-moving, aerodynamic ribbons forming a stylized letter "F",
 * paired with a bold geometric uppercase FLOWPROMPT wordmark.
 */
export const FlowPromptLogo: React.FC<FlowPromptLogoProps> = ({
  variant = 'full',
  size = 28,
  className = '',
  responsiveWordmark = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const topGradId = `fp-top-grad-${uid}`;
  const botGradId = `fp-bot-grad-${uid}`;
  const badgeGradId = `fp-badge-grad-${uid}`;

  // Exact proportions from the brand board: viewBox 0 0 176 132 (aspect ratio ~1.333:1)
  const iconWidth = Math.round(size * (176 / 132));

  // Upper flowing ribbon path (traced 1:1 from brand reference)
  const topRibbonPath =
    'M 65 0 H 171.5 C 174.8 0 176.2 2.2 174.5 5.2 L 162.2 27.2 C 155.8 36.8 146.5 40.5 133.5 40.5 H 57.5 C 38.5 40.5 23.2 48.2 12.6 62.4 C 11.3 64.1 10.1 63.1 10.7 61 L 19.6 34.2 C 27.6 12.2 44.2 0 65 0 Z';

  // Lower flowing ribbon + stem path (traced 1:1 from brand reference)
  const bottomRibbonPath =
    'M 56.5 56 H 132 C 134.8 56 136.2 58.2 134.8 61 L 124.2 81.2 C 118.4 90.4 109.5 94.2 97.5 94.2 H 71.5 C 56.5 94.2 49.2 100.8 43.2 115.5 L 38.2 127.2 C 36.8 130.4 34.2 131.5 30.2 131.5 H 2.8 C 0.2 131.5 -0.8 129.6 0.2 126.8 L 19.8 78.5 C 26.8 62.5 39.2 56 56.5 56 Z';

  if (variant === 'app-icon') {
    return (
      <span
        className={`inline-flex items-center justify-center select-none shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={badgeGradId}
              x1="0"
              y1="0"
              x2="160"
              y2="160"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FF8A32" />
              <stop offset="50%" stopColor="#FF6A00" />
              <stop offset="100%" stopColor="#D95300" />
            </linearGradient>
          </defs>
          <rect
            x="2"
            y="2"
            width="156"
            height="156"
            rx="36"
            fill={`url(#${badgeGradId})`}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />
          <g transform="translate(22, 34) scale(0.66)">
            <path d={topRibbonPath} fill="#FFFFFF" />
            <path d={bottomRibbonPath} fill="#FFFFFF" />
          </g>
        </svg>
      </span>
    );
  }

  const isMonochrome = variant === 'monochrome';

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}
    >
      <svg
        width={iconWidth}
        height={size}
        viewBox="0 0 176 132"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {!isMonochrome && (
          <defs>
            {/* Subtle brand orange gradient matching the uploaded identity board */}
            <linearGradient
              id={topGradId}
              x1="10"
              y1="58"
              x2="174"
              y2="4"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FF6A00" />
              <stop offset="65%" stopColor="#FF7A1A" />
              <stop offset="100%" stopColor="#FF8A32" />
            </linearGradient>
            <linearGradient
              id={botGradId}
              x1="0"
              y1="128"
              x2="135"
              y2="58"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FF8A32" />
              <stop offset="45%" stopColor="#FF6A00" />
              <stop offset="100%" stopColor="#E65800" />
            </linearGradient>
          </defs>
        )}
        <path
          d={topRibbonPath}
          fill={isMonochrome ? 'currentColor' : `url(#${topGradId})`}
        />
        <path
          d={bottomRibbonPath}
          fill={isMonochrome ? 'currentColor' : `url(#${botGradId})`}
        />
      </svg>

      {variant !== 'icon' && (
        <span
          style={{
            fontSize: `${Math.round(size * 0.68)}px`,
            letterSpacing: '0.02em',
          }}
          className={`font-extrabold uppercase leading-none tracking-[0.02em] text-[var(--logo-wordmark)] transition-colors duration-250 ease-in-out ${
            responsiveWordmark ? 'hidden sm:inline-block' : 'inline-block'
          }`}
        >
          FLOWPROMPT
        </span>
      )}
    </span>
  );
};
