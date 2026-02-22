interface EmbedProps {
  url: string;
  title?: string;
}

export function Embed({ url, title }: EmbedProps) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      );
    }
  }

  if (url.endsWith('.mp4') || url.endsWith('.webm')) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg">
        <video controls className="w-full" preload="metadata">
          <source src={url} type={url.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} />
        </video>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
      <iframe
        src={url}
        title={title || 'Embedded content'}
        className="absolute inset-0 h-full w-full"
        allowFullScreen
      />
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/embed\/)([^?&]+)/,
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
