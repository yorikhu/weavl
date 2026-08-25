/**
 * Weavl 织光 · 星芒徽标（Starburst Mark）
 * 极简四芒星光梭 —— 干净、锐利、无内点装饰。
 * 亮色主题下自动反色。
 */
export function StarburstLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-[var(--foreground)] transition-transform duration-200 group-hover:scale-105`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 0.5C12 7.8 8.2 12 0.5 12C8.2 12 12 16.2 12 23.5C12 16.2 15.8 12 23.5 12C15.8 12 12 7.8 12 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
