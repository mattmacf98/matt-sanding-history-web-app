import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";

interface VideoModalProps {
  selectedVideo: VIAM.dataApi.BinaryData | null;
  onClose: () => void;
  viamClient: VIAM.ViamClient;
}

const VideoModal: React.FC<VideoModalProps> = ({ 
  selectedVideo, 
  onClose, 
  viamClient
}) => {
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [loadingModalVideo, setLoadingModalVideo] = useState(false);

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
