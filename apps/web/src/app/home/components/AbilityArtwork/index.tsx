export type AbilityArtworkKind = "agent" | "canvas" | "skill" | "workflow" | "assets";

export function AbilityArtwork({ kind }: { kind: AbilityArtworkKind }) {
  return (
    <svg viewBox="0 0 220 150" fill="none" aria-hidden="true" focusable="false">
      {kind === "agent" && (
        <>
          <rect x="31" y="25" width="158" height="108" rx="13" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <rect x="44" y="39" width="132" height="35" rx="8" fill="var(--visual-soft)" />
          <rect x="55" y="49" width="15" height="15" rx="4" fill="var(--visual-panel)" />
          <path d="M80 51h80M80 60h55" stroke="var(--visual-ink)" strokeOpacity=".56" strokeLinecap="round" />
          <rect x="44" y="84" width="132" height="35" rx="8" fill="var(--visual-panel)" stroke="var(--visual-line)" />
          <rect x="55" y="94" width="15" height="15" rx="4" fill="var(--visual-soft)" />
          <path d="M80 96h80M80 105h55" stroke="var(--visual-ink)" strokeOpacity=".56" strokeLinecap="round" />
        </>
      )}
      {kind === "canvas" && (
        <>
          <rect x="25" y="22" width="170" height="110" rx="11" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <path d="M25 42h170M39 33h35" stroke="var(--visual-line)" strokeLinecap="round" />
          <rect x="40" y="54" width="63" height="60" rx="6" fill="var(--visual-soft)" stroke="var(--visual-line)" />
          <path d="M51 67h41M51 77h32M51 94h41M51 102h27" stroke="var(--visual-ink)" strokeOpacity=".54" strokeLinecap="round" />
          <path d="M103 84h14" stroke="var(--visual-accent)" strokeWidth="1.4" />
          <rect x="117" y="54" width="63" height="60" rx="6" fill="var(--visual-panel)" stroke="var(--visual-line)" />
          <rect x="128" y="65" width="41" height="27" rx="3" fill="var(--visual-soft)" />
          <path d="m132 87 9-9 7 5 8-10 9 14M128 101h41" stroke="var(--visual-ink)" strokeOpacity=".56" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === "skill" && (
        <>
          <rect x="48" y="22" width="110" height="108" rx="10" fill="var(--visual-soft)" stroke="var(--visual-line)" transform="rotate(-8 48 22)" />
          <rect x="67" y="27" width="112" height="105" rx="10" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <rect x="81" y="42" width="48" height="16" rx="4" fill="var(--visual-panel)" />
          <text x="90" y="53" fill="var(--visual-ink)" fontSize="7" letterSpacing="1.4">SKILL</text>
          <path d="M83 73h75M83 84h62M83 95h69" stroke="var(--visual-ink)" strokeOpacity=".54" strokeLinecap="round" />
          <circle cx="155" cy="48" r="12" fill="var(--visual-soft)" />
          <path d="m155 41 1.8 5.2L162 48l-5.2 1.8L155 55l-1.8-5.2L148 48l5.2-1.8L155 41Z" fill="var(--visual-accent)" />
          <path d="M85 111h24m5 0h23" stroke="var(--visual-accent)" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {kind === "workflow" && (
        <>
          <path d="M76 79h8m52 0h8" stroke="var(--visual-accent)" strokeWidth="1.5" />
          <rect x="24" y="39" width="52" height="81" rx="8" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <rect x="84" y="39" width="52" height="81" rx="8" fill="var(--visual-panel)" stroke="var(--visual-line)" />
          <rect x="144" y="39" width="52" height="81" rx="8" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <rect x="35" y="52" width="30" height="30" rx="5" fill="var(--visual-soft)" />
          <rect x="95" y="52" width="30" height="30" rx="5" fill="var(--visual-soft)" />
          <rect x="155" y="52" width="30" height="30" rx="5" fill="var(--visual-soft)" />
          <rect x="43" y="58" width="14" height="18" rx="2" stroke="var(--visual-accent)" strokeWidth="1.3" />
          <path d="M46 63h8m-8 4h8m-8 4h5" stroke="var(--visual-accent)" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="99" y="57" width="9" height="9" rx="1.5" stroke="var(--visual-accent)" strokeWidth="1.2" />
          <rect x="114" y="57" width="9" height="9" rx="1.5" stroke="var(--visual-accent)" strokeWidth="1.2" />
          <rect x="114" y="70" width="9" height="9" rx="1.5" stroke="var(--visual-accent)" strokeWidth="1.2" />
          <path d="M108 61.5h6m-6 0h3v13h3" stroke="var(--visual-accent)" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="m162 67 6 6 11-13" stroke="var(--visual-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M35 94h30m-30 9h21m39-9h30m-30 9h21m39-9h30m-30 9h21" stroke="var(--visual-ink)" strokeOpacity=".5" strokeLinecap="round" />
        </>
      )}
      {kind === "assets" && (
        <>
          <rect x="51" y="25" width="50" height="66" rx="5" fill="var(--visual-soft)" stroke="var(--visual-line)" />
          <rect x="119" y="25" width="50" height="66" rx="5" fill="var(--visual-paper)" stroke="var(--visual-line)" />
          <path d="M61 41h30M61 49h23M129 41h30M129 49h23" stroke="var(--visual-ink)" strokeOpacity=".5" strokeLinecap="round" />
          <path d="M39 76v-9a8 8 0 0 1 8-8h40l10 10h76a8 8 0 0 1 8 8v9H39Z" fill="var(--visual-soft)" stroke="var(--visual-line)" strokeLinejoin="round" />
          <rect x="39" y="76" width="142" height="52" rx="8" fill="var(--visual-panel)" stroke="var(--visual-line)" />
          <path d="M39 90h142" stroke="var(--visual-line)" />
          <rect x="53" y="101" width="54" height="15" rx="3" fill="var(--visual-soft)" />
          <path d="M63 108.5h34M123 104h42M123 113h31" stroke="var(--visual-ink)" strokeOpacity=".56" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
