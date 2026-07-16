/**
 * Brand SVG icons — Lucide (in shared/ui) covers UI glyphs, but has no brand
 * marks, so search-engine logos are stored here as inline SVG components
 * (themeable size, no external asset request, CSP-safe).
 */
import type { ComponentType, SVGProps } from "react";

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  role: "img" as const,
  "aria-hidden": true,
});

export function GoogleIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function BingIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        fill="#008373"
        d="M5.2 2 9 3.34v12.2l4.53-2.62-1.9-.9-1.2-3 6.37 2.24V15L9 20.66 5.2 18.5V2z"
      />
    </svg>
  );
}

export function DuckDuckGoIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="12" cy="12" r="11" fill="#DE5833" />
      <path
        fill="#fff"
        d="M12.6 18.9c-.3-1.5-.9-3.6-.6-5.3.1-.6.5-1 .5-1.3 0-.4-.5-.6-.8-.7-.4-.2-.9-.3-1.3-.3.3-.3.9-.4 1.3-.4-.4-.3-1-.3-1.5-.2.2-.2.5-.3.8-.4-.5-.2-1.1-.1-1.6.1.3-1.1 1.4-1.9 2.6-1.7-.2-.3-.6-.5-.9-.6.9-.3 1.9.1 2.4.9.5.9.4 2 .1 3-.2.7-.5 1.4-.5 2.1 0 1.4.5 3.2.9 4.6-.6.3-1.2.5-1.6.6z"
      />
      <path
        fill="#4C4C4C"
        d="M11.1 9.2c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5z"
      />
      <path fill="#FDD20A" d="M13 13.6c.9-.4 2.3-.5 3.1-.1-.2.4-.6.6-1 .7.3.1.6.1.9.3-.6.4-1.4.4-2 .1-.4-.2-.8-.6-1-1z" />
    </svg>
  );
}

export function YouTubeIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        fill="#FF0000"
        d="M23 12s0-3.7-.5-5.5c-.2-1-1-1.8-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5c-1 .3-1.8 1-2 2C1 8.3 1 12 1 12s0 3.7.5 5.5c.2 1 1 1.8 2 2 1.8.5 8.5.5 8.5.5s6.7 0 8.5-.5c1-.3 1.8-1 2-2C23 15.7 23 12 23 12z"
      />
      <path fill="#fff" d="M9.8 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  );
}

/** Generic globe fallback for custom engines. */
export function CustomEngineIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth={2} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  );
}

export const brandIcons: Record<string, ComponentType<IconProps>> = {
  google: GoogleIcon,
  bing: BingIcon,
  duckduckgo: DuckDuckGoIcon,
  youtube: YouTubeIcon,
  custom: CustomEngineIcon,
};
