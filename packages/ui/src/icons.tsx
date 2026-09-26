// Stroke icons drawn from the canvas. They inherit currentColor and hide
// themselves from assistive tech; label the control that holds them.
import type { ReactNode, SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; strokeWidth?: number };

function make(paths: ReactNode, defaults: { strokeWidth?: number } = {}) {
  return function Icon({ size = 16, strokeWidth, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth ?? defaults.strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7" />, { strokeWidth: 2.4 });
export const MinusIcon = make(<path d="M5 12h14" />);
export const DashIcon = make(<path d="M6 12h12" />, { strokeWidth: 2.4 });
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const ChevronDownIcon = make(<path d="m6 9 6 6 6-6" />);
export const ChevronLeftIcon = make(<path d="M15 5 8 12l7 7" />, { strokeWidth: 1.9 });
export const ChevronRightIcon = make(<path d="m9 5 7 7-7 7" />, { strokeWidth: 1.9 });
export const ArrowUpIcon = make(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>);
export const ArrowDownIcon = make(<><path d="M12 5v14" /><path d="m5 12 7 7 7-7" /></>);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>, { strokeWidth: 1.9 });
export const LockIcon = make(<><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>, { strokeWidth: 1.8 });
export const AlertIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></>, { strokeWidth: 2.2 });
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, { strokeWidth: 2 });
export const BookmarkIcon = make(<path d="M6 4h12v17l-6-4.5L6 21z" />, { strokeWidth: 1.8 });
export const FiltersIcon = make(<><path d="M4 7h16" /><path d="M7 12h10" /><path d="M10 17h4" /></>, { strokeWidth: 1.8 });
export const GlobeIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" /></>, { strokeWidth: 1.6 });
export const CityIcon = make(<><path d="M4 21V8l7-4v17" /><path d="M11 10h6a2 2 0 0 1 2 2v9" /><path d="M2 21h20" /></>, { strokeWidth: 1.6 });
export const HouseIcon = make(<><path d="M3 18h18" /><path d="M5 18V9l7-4 7 4v9" /><path d="M10 18v-5h4v5" /></>, { strokeWidth: 1.6 });
export const BeachIcon = make(<><path d="M3 17c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" /><path d="M3 21c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" /><circle cx="12" cy="7" r="4" /></>, { strokeWidth: 1.6 });
export const MountainIcon = make(<path d="m3 19 6-11 4 7 2.5-4L21 19z" />, { strokeWidth: 1.6 });
export const PlaneIcon = make(<path d="M10.5 13.5 3 11l1.5-1.5 7.5 1 4-4.5a2.1 2.1 0 0 1 3 3l-4.5 4 1 7.5L14 22l-2.5-7.5z" />, { strokeWidth: 1.7 });
export const SendIcon = make(<><path d="M4 12 20 4l-6 16-3-7z" /><path d="m11 13 9-9" /></>, { strokeWidth: 1.8 });
export const StopIcon = make(<rect x="6" y="6" width="12" height="12" rx="2" />, { strokeWidth: 2 });
export const CloseIcon = make(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>, { strokeWidth: 2 });
export const HeartIcon = make(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />, { strokeWidth: 1.8 });
export const ExternalIcon = make(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, { strokeWidth: 1.8 });
export const MenuIcon = make(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>, { strokeWidth: 1.9 });
export const TrophyIcon = make(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></>, { strokeWidth: 1.8 });
