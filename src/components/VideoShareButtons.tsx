import React from 'react';
import { useClipboardCopy } from '../lib/hooks/useClipboardCopy';

interface VideoShareButtonsProps {
  /** Base URL to share */
  baseUrl: string;
  /** (Optional)Additional buttons to render before the share buttons */
  children?: React.ReactNode;
  /** Ref to video element */
  videoRef?: React.RefObject<HTMLVideoElement>;
}

/**
 * Reusable component for video sharing buttons.
 * Provides two buttons: one to share the video link, and one to share with a timestamp.
 */
const VideoShareButtons: React.FC<VideoShareButtonsProps> = ({
  baseUrl,
  videoRef,
  children,
}) => {
  const { copied: videoShared, copyToClipboard: copyVideoLink } = useClipboardCopy();
  const { copied: videoSharedFromCurrentLocation, copyToClipboard: copyVideoLinkFromLocation } = useClipboardCopy();

  const handleShare = () => {
    copyVideoLink(baseUrl);
  };

  const handleShareFromCurrentLocation = () => {
    const videoElement = videoRef?.current;
    if (!videoElement) {
      return;
    }

    const currentTime = videoElement.currentTime;
    
    const [urlWithoutQuery, queryString] = baseUrl.split('?');
    const params = new URLSearchParams(queryString || '');
    params.set('loc', currentTime.toString());
    const url = `${urlWithoutQuery}?${params.toString()}`;

    copyVideoLinkFromLocation(url);
  };

  return (
    <div className="video-modal-buttons">
      {children}

      <button
        title="Share a link to the video's detail page"
        className="video-modal-button primary"
        style={{
          width: '90px'
        }}
        onClick={handleShare}
      >
        {videoShared ? 'Link copied!' : 'Share link'}
      </button>
      <button
        title="Share link to the video's detail page from the current location within the video"
        className="video-modal-button secondary"
        style={{
          width: '190px'
        }}
        onClick={handleShareFromCurrentLocation}
      >
        {videoSharedFromCurrentLocation ? 'Link copied!' : 'Share link from current location'}
      </button>
    </div>
  );
};

export default VideoShareButtons;

