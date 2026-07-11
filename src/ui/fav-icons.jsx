// =====================================================================
// src/ui/fav-icons.jsx  (FAV — shared icon map + premium card)
// One lucide icon per favoritable section (keys = registry `icon` field)
// and the PremiumFavCard used by both the Home strip and the manage
// screen, so the "premium" treatment stays identical everywhere:
// hue-tinted gradient fill, soft hue glow, icon bubble, spring press.
// =====================================================================
import React from 'react';
import {
  Activity, BarChart3, Bookmark, BookOpen, Calculator, Compass, Crosshair, FileText, FlaskConical,
  Flag, GraduationCap, HeartPulse, HelpCircle, Layers, ListOrdered, MapPin, Moon, Recycle, Scale,
  ScanSearch, ScrollText, Sigma, Syringe, Target, Timer, Trophy, Zap,
} from 'lucide-react';

const ICONS = {
  zap: Zap, target: Target, timer: Timer, flask: FlaskConical,
  syringe: Syringe, scroll: ScrollText, grad: GraduationCap,
  chart: BarChart3, trophy: Trophy, bookmark: Bookmark, flag: Flag,
  layers: Layers, help: HelpCircle, sigma: Sigma, mappin: MapPin,
  book: BookOpen, file: FileText, compass: Compass, calculator: Calculator,
  // new interactive drill modes
  listordered: ListOrdered, activity: Activity, recycle: Recycle,
  scan: ScanSearch, crosshair: Crosshair, scale: Scale, moon: Moon, heartpulse: HeartPulse,
};

export function FavIcon({ name, size = 18, color = '#FFF' }) {
  const C = ICONS[name] || Zap;
  return <C size={size} style={{ color }} />;
}

// surface = theme card colour so the gradient blends with light AND dark themes.
export function PremiumFavCard({ section, surface, ink, muted, onClick, compact = false, children, style = {}, className = '' }) {
  const hue = section.hue;
  return (
    <div role="button" tabIndex={0}
         onClick={onClick}
         onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
         className={"no-tap-highlight pressable cursor-pointer rounded-2xl overflow-hidden relative " + className}
         style={{
           background: `linear-gradient(140deg, ${hue}1F 0%, ${surface} 55%)`,
           border: `1.5px solid ${hue}45`,
           boxShadow: `0 4px 16px ${hue}22`,
           ...style,
         }}>
      {/* hue glow in the corner — the "premium" accent */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${hue}30, transparent 70%)` }} aria-hidden="true" />
      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-3">
          <div className={(compact ? 'w-9 h-9' : 'w-10 h-10') + ' rounded-xl flex items-center justify-center flex-shrink-0'}
               style={{ background: `linear-gradient(135deg, ${hue}, ${hue}B3)`, boxShadow: `0 3px 10px ${hue}55` }}>
            <FavIcon name={section.icon} size={compact ? 16 : 18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={(compact ? 'text-[13px]' : 'text-sm') + ' font-display font-semibold truncate'} style={{ color: ink }}>
              {section.label}
            </div>
            {!compact && (
              <div className="text-[11px] mt-0.5 truncate" style={{ color: muted }}>{section.blurb}</div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
