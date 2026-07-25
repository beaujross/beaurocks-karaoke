import React from 'react';
import { getContentSourceMeta } from '../lib/playbackSelection';

const ContentSourceBadge = ({
  source = '',
  label = '',
  title = '',
  compact = false,
  className = '',
}) => {
  const sourceMeta = getContentSourceMeta(source);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border font-black uppercase ${
        compact
          ? 'min-h-[20px] gap-1 px-1.5 py-0.5 text-[8px] tracking-[0.1em]'
          : 'min-h-[24px] gap-1.5 px-2 py-1 text-[9px] tracking-[0.12em]'
      } ${sourceMeta.className} ${className}`}
      title={title || `${sourceMeta.label} playback source`}
      data-content-source={sourceMeta.id}
    >
      <i className={`${sourceMeta.iconClass}`} aria-hidden="true"></i>
      <span>{label || sourceMeta.label}</span>
    </span>
  );
};

export default ContentSourceBadge;
