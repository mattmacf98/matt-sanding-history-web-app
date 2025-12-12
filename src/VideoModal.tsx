import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";

import { useViamClients } from './ViamClientContext';

interface VideoModalProps {
  selectedVideo: VIAM.dataApi.BinaryData | null;
  onClose: () => void;
}

const VideoModal: React.FC<VideoModalProps> = ({ 
  selectedVideo, 
  onClose,
}) => {
  const { viamClient } = useViamClients();

  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [loadingModalVideo, setLoadingModalVideo] = useState(false);
  const [videoShared, setVideoShared] = useState(false);
  const [videoSharedFromCurrentLocation, setVideoSharedFromCurrentLocation] = useState(false);

  const videoPageURL  = selectedVideo
    ? `${window.location.href}/videos/${selectedVideo.metadata!.binaryDataId.split('/').pop()}?name=${selectedVideo.metadata!.fileName}`
    : '';

  const closeVideoModal = () => {
    setModalVideoUrl(null);
    onClose();
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeVideoModal();
      }
    };

    if (selectedVideo) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedVideo]);

  // Fetch video when selectedVideo changes
  useEffect(() => {
    if (selectedVideo) {
      const fetchVideoURL = async () => {
        setLoadingModalVideo(true);
        try {
          console.log("creating signed URL for video", selectedVideo.metadata!.binaryDataId);
          const url = await viamClient.dataClient.createBinaryDataSignedURL(selectedVideo.metadata!.binaryDataId, 60);
          setModalVideoUrl(url);
        } catch (error) {
          console.error("Error creating signed URL for video:", error);
        } finally {
          setLoadingModalVideo(false);
        }
      };

      fetchVideoURL();
    }
  }, [selectedVideo, viamClient]);

  const handleShare = () => {
    if (!selectedVideo) {
      return;
    }

    navigator.clipboard.writeText(videoPageURL);

    setVideoShared(true);
    setTimeout(() => {
      setVideoShared(false);
    }, 2000);
  };

  const handleShareFromCurrentLocation = () => {
    if (!selectedVideo) {
      return;
    }

    const videoPlayer = document.getElementById('video-player') as HTMLVideoElement;
    if (!videoPlayer) {
      return;
    }

    const currentTime = videoPlayer.currentTime;

    const url = `${videoPageURL}&loc=${currentTime}`;
    navigator.clipboard.writeText(url);

    setVideoSharedFromCurrentLocation(true);
    setTimeout(() => {
      setVideoSharedFromCurrentLocation(false);
    }, 2000);
  };

  if (!selectedVideo) {
    return null;
  }

  return (
    <div className="video-modal-overlay" onClick={closeVideoModal}>
      <div className="video-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-modal-header">
          <button className="video-modal-close" onClick={closeVideoModal}>×</button>
        </div>

        <div className="video-modal-content">
          <div className="video-modal-player">
            {loadingModalVideo ? (
              <>
                <div className="loading-spinner">⏳</div>
                <p>Loading video...</p>
              </>
            ) : modalVideoUrl ? (
              <video
                id="video-player"
                controls 
                autoPlay
                src={modalVideoUrl}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  borderRadius: '8px'
                }}
                onError={(e) => {
                  console.error("Video playback error:", e);
                  alert("Error playing video");
                }}
              />
            ) : (
              <>
                <div className="loading-spinner">⏳</div>
                <p>Loading video...</p>
              </>
            )}
          </div>

          <div className="video-modal-info">
            <div className="video-modal-buttons">
              <a
                href={videoPageURL}
                style={{ color: '#3b82f6' }}
                target="_blank"
                title="Go to the video's detail page"
              >
                Go to video
              </a>
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
                title="Share link from the current location within the video"
                className="video-modal-button secondary"
                style={{
                  width: '190px'
                }}
                onClick={handleShareFromCurrentLocation}
              >
                {videoSharedFromCurrentLocation ? 'Link copied!' : 'Share link from current location'}
              </button>
            </div>

            <p>
              <strong>File:</strong>{' '}
              {selectedVideo.metadata?.uri ? (
                <a
                  href={selectedVideo.metadata.uri}
                  download={selectedVideo.metadata?.fileName?.split('/').pop() || 'video.mp4'}
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#3b82f6';
                  }}
                >
                  {selectedVideo.metadata?.fileName || 'Unknown'}
                </a>
              ) : (
                selectedVideo.metadata?.fileName || 'Unknown'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;
