type SocialIconProps = {
  name: string;
};

export function SocialIcon({ name }: SocialIconProps) {
  const normalized = name.toLowerCase();
  const label = normalized === 'instagram'
    ? 'Instagram'
    : normalized === 'linkedin'
      ? 'LinkedIn'
      : normalized === 'tiktok'
        ? 'TikTok'
        : normalized === 'youtube'
          ? 'YouTube'
          : 'Canal';

  if (normalized === 'instagram') {
    return (
      <span className="social-icon" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="4" />
          <circle cx="12" cy="12" r="3.2" />
          <circle cx="16.7" cy="7.3" r="1" />
        </svg>
      </span>
    );
  }

  if (normalized === 'linkedin') {
    return (
      <span className="social-icon" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 10v8" />
          <path d="M6.5 6.5v.1" />
          <path d="M11 18v-8" />
          <path d="M11 13.6c0-2.2 1.3-3.7 3.2-3.7 2 0 3.3 1.4 3.3 3.9V18" />
        </svg>
      </span>
    );
  }

  if (normalized === 'tiktok') {
    return (
      <span className="social-icon" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5 5v9.2a3.4 3.4 0 1 1-3.4-3.4" />
          <path d="M13.5 5c.5 2.6 2 4.1 4.5 4.5" />
        </svg>
      </span>
    );
  }

  if (normalized === 'youtube') {
    return (
      <span className="social-icon" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="7" width="15" height="10" rx="3" />
          <path d="m11 10 4 2-4 2z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="social-icon" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14" />
        <path d="M12 5c2 2.2 3 4.6 3 7s-1 4.8-3 7" />
        <path d="M12 5c-2 2.2-3 4.6-3 7s1 4.8 3 7" />
      </svg>
    </span>
  );
}

export function SocialIconRow({ channels }: { channels: string[] }) {
  return (
    <span className="social-icon-row">
      {channels.length > 0 ? channels.map((channel) => <SocialIcon name={channel} key={channel} />) : <SocialIcon name="web" />}
    </span>
  );
}
