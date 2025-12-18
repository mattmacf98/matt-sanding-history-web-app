import React, { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import { useViamClients } from './lib/contexts/ViamClientContext';
import VideoShareButtons from './components/VideoShareButtons';

function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const { locationId, machineName, organizationId, viamClient } = useViamClients();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileName = searchParams.get('name');
  const videoStartingLocation = searchParams.get('loc');

  useEffect(() => {
    const fetchSignedUrl = async () => {
      try {
        if (!videoId) {
          setError('Video ID is required');
          return;
        }
        setLoading(true);
        const urlPath = `${organizationId}/${locationId}/${videoId}`;
        const url = await viamClient.dataClient.createBinaryDataSignedURL(urlPath, 60);
        setSignedUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
        console.error('Error fetching signed URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [viamClient, videoId, locationId, organizationId]);

  const setVideoStartingLocation = () => {
    if (videoStartingLocation && videoRef.current) {
      const timestamp = parseFloat(videoStartingLocation);
      if (!isNaN(timestamp)) {
        videoRef.current.currentTime = timestamp;
      }
    }
  };

  useEffect(setVideoStartingLocation, [videoStartingLocation]);

  return (
    <div style={{ padding: '20px', width: '100%', height: '100%' }}>
      <Link to="/" style={{ color: '#3b82f6' }}>Go to sanding history</Link>

      <h2 className="font-semibold text-zinc-900">Sanding video</h2>
      <p><span className="font-semibold text-zinc-900">Location:</span> {locationId}</p>
      <p><span className="font-semibold text-zinc-900">Machine:</span> {machineName}</p>
      {fileName
        ? <p><span className="font-semibold text-zinc-900">File name:</span> {fileName}</p>
        : <p><span className="font-semibold text-zinc-900">File ID:</span> {videoId}</p>
      }

      {loading && <p>Loading video...</p>}
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

      {signedUrl && !loading && !error && (
        <React.Fragment>
          <video
            ref={videoRef}
            src={signedUrl}
            controls
            style={{
              width: '100%',
              maxWidth: '1000px',
              aspectRatio: '16/9',
              borderRadius: '8px'
            }}
            onLoadedMetadata={setVideoStartingLocation}
          />

          <div className="video-modal-buttons">
            <VideoShareButtons
              baseUrl={window.location.href}
              videoRef={videoRef}
            />
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

export default VideoDetailPage;
