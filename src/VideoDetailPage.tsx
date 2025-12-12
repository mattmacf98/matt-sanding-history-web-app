import React, { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useViamClients } from './ViamClientContext';
import { Link } from 'react-router-dom';

function VideoDetailPage() {
  const { machineInfo, videoId } = useParams<{ machineInfo: string, videoId: string }>();
  const [searchParams] = useSearchParams();
  const { locationId, machineName, organizationId, viamClient } = useViamClients();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoShared, setVideoShared] = useState(false);
  const [videoSharedFromCurrentLocation, setVideoSharedFromCurrentLocation] = useState(false);

  const fileName = searchParams.get('name');

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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);

    setVideoShared(true);
    setTimeout(() => {
      setVideoShared(false);
    }, 2000);
  };

  const handleShareFromCurrentLocation = () => {
    if (!videoRef.current) {
      return;
    }

    const currentTime = videoRef.current.currentTime;

    const url = new URL(window.location.href);
    url.searchParams.set('loc', currentTime.toString());
    navigator.clipboard.writeText(url.toString());

    setVideoSharedFromCurrentLocation(true);
    setTimeout(() => {
      setVideoSharedFromCurrentLocation(false);
    }, 2000);
  };

  return (
    <div style={{ padding: '20px', width: '100%', height: '100%' }}>
      <Link to={`/machine/${machineInfo}`} style={{ color: '#3b82f6' }}>Go to sanding history</Link>

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
            onLoadedMetadata={() => {
              const loc = searchParams.get('loc');
              if (loc && videoRef.current) {
                const timestamp = parseFloat(loc);
                if (!isNaN(timestamp)) {
                  videoRef.current.currentTime = timestamp;
                }
              }
            }}
          />

          <div className="video-modal-buttons">
            <button
              title="Share a link to this page"
              className="video-modal-button primary"
              style={{
                width: '90px'
              }}
              onClick={handleShare}
            >
              {videoShared ? 'Link copied!' : 'Share link'}
            </button>
            <button
              title="Share link to this page from the current location within the video"
              className="video-modal-button secondary"
              style={{
                width: '190px'
              }}
              onClick={handleShareFromCurrentLocation}
            >
              {videoSharedFromCurrentLocation ? 'Link copied!' : 'Share link from current location'}
            </button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

export default VideoDetailPage;
