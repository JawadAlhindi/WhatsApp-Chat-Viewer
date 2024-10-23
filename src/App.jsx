import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Paperclip, File, Trash2, AlertCircle } from 'lucide-react';

// Custom Alert Component
const Alert = ({ children, className = "" }) => (
  <div className={`bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative ${className}`}>
    {children}
  </div>
);

// Predefined colors for senders with better contrast and accessibility
const SENDER_COLORS = [
  '#2563eb', // Blue
  '#16a34a', // Green
  '#ea580c', // Orange
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#be123c', // Rose
  '#854d0e', // Amber
];

const parseTimestamp = (line) => {
  const match = line.match(/^\[(.+?)\]\s*/);
  return match ? { timestamp: match[1], rest: line.slice(match[0].length) } : null;
};

const parseSender = (content) => {
  const match = content.match(/^([^:]+):\s*/);
  return match ? { sender: match[1].trim(), message: content.slice(match[0].length) } : null;
};

const getMediaType = (fileName) => {
  const ext = fileName.toLowerCase().split('.').pop();
  const mediaTypes = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    video: ['mp4', 'webm', 'mov'],
    audio: ['mp3', 'ogg', 'm4a', 'wav'],
  };
  
  return Object.entries(mediaTypes).find(([_, exts]) => exts.includes(ext))?.[0] || 'file';
};

const MediaPreview = React.memo(({ fileName, mediaUrl, type }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const handleLoad = () => setLoading(false);
  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const commonClasses = "rounded-lg max-w-full mt-2 transition-opacity duration-200";
  const loadingClasses = loading ? "opacity-0" : "opacity-100";

  if (error) {
    return (
      <Alert className="mt-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load media: {fileName}</span>
        </div>
      </Alert>
    );
  }

  const mediaElements = {
    image: (
      <img 
        src={mediaUrl} 
        alt={fileName} 
        className={`${commonClasses} ${loadingClasses} max-h-60 object-contain`}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    ),
    video: (
      <video 
        src={mediaUrl} 
        controls 
        className={`${commonClasses} ${loadingClasses}`}
        onLoadedData={handleLoad}
        onError={handleError}
      />
    ),
    audio: (
      <audio 
        src={mediaUrl} 
        controls 
        className={`w-full mt-2 ${loadingClasses}`}
        onLoadedData={handleLoad}
        onError={handleError}
      />
    ),
    file: (
      <a 
        href={mediaUrl}
        download={fileName}
        className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mt-2"
      >
        <File size={16} />
        {fileName}
      </a>
    )
  };

  return (
    <div className="relative">
      {loading && type !== 'file' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {mediaElements[type]}
    </div>
  );
});

const Message = React.memo(({ data, mediaFiles, colorMap }) => {
  const { timestamp, sender, content } = data;
  const mediaMatch = content.match(/<attached:\s*([^>]+)>/);
  const fileName = mediaMatch ? mediaMatch[1].trim().toLowerCase() : null;
  const mediaUrl = fileName ? mediaFiles.get(fileName) : null;
  const mediaType = fileName ? getMediaType(fileName) : null;

  // Get or assign a consistent color for the sender
  const senderColor = useCallback(() => {
    if (!colorMap.has(sender)) {
      const existingColors = new Set(Array.from(colorMap.values()));
      const availableColors = SENDER_COLORS.filter(color => !existingColors.has(color));
      const newColor = availableColors.length > 0 
        ? availableColors[0] 
        : SENDER_COLORS[colorMap.size % SENDER_COLORS.length];
      colorMap.set(sender, newColor);
    }
    return colorMap.get(sender);
  }, [sender, colorMap])();

  return (
    <div className="mb-4 animate-fadeIn">
      <div className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div className="font-bold" style={{ color: senderColor }}>
            {sender}
          </div>
          <div className="text-xs text-gray-500">{timestamp}</div>
        </div>
        <div className="mt-2 mb-2 break-words whitespace-pre-wrap">
          {mediaMatch ? content.replace(mediaMatch[0], '').trim() : content}
        </div>
        {mediaMatch && mediaUrl && (
          <MediaPreview fileName={fileName} mediaUrl={mediaUrl} type={mediaType} />
        )}
      </div>
    </div>
  );
});

const VirtualizedChat = React.memo(({ messages, mediaFiles }) => {
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const colorMap = useRef(new Map()).current;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback((e) => {
    const { scrollHeight, scrollTop, clientHeight } = e.target;
    setAutoScroll(Math.abs(scrollHeight - scrollTop - clientHeight) < 10);
  }, []);

  return (
    <div 
      ref={scrollRef} 
      className="overflow-y-auto p-4 bg-[#efeae2] h-full scroll-smooth"
      onScroll={handleScroll}
    >
      {messages.map((msg, idx) => (
        <Message 
          key={`${msg.timestamp}-${idx}`} 
          data={msg} 
          mediaFiles={mediaFiles} 
          colorMap={colorMap} 
        />
      ))}
    </div>
  );
});

export default function App() {
  const [messages, setMessages] = useState([]);
  const [mediaFiles, setMediaFiles] = useState(new Map());
  const [status, setStatus] = useState({ chat: 'No chat loaded', media: 'No media loaded' });

  const handleMediaUpload = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (!files.length) {
      setStatus(prev => ({ ...prev, media: 'No media files selected' }));
      return;
    }

    setMediaFiles(prev => {
      const newMap = new Map(prev);
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        newMap.set(file.name.toLowerCase(), url);
      });
      return newMap;
    });

    setStatus(prev => ({ ...prev, media: `Loaded ${files.length} media files` }));
  }, []);

  const handleChatUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setStatus(prev => ({ ...prev, chat: 'No chat file selected' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = event.target.result.split('\n');
      const parsedMessages = lines
        .map(line => {
          const timestampData = parseTimestamp(line);
          if (!timestampData) return null;

          const senderData = parseSender(timestampData.rest);
          if (!senderData) return null;

          return {
            timestamp: timestampData.timestamp,
            sender: senderData.sender,
            content: senderData.message,
          };
        })
        .filter(Boolean);

      setMessages(parsedMessages);
      setStatus(prev => ({ ...prev, chat: `Loaded ${parsedMessages.length} messages` }));
    };

    reader.readAsText(file);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    mediaFiles.forEach(url => URL.revokeObjectURL(url));
    setMediaFiles(new Map());
    setStatus({ chat: 'No chat loaded', media: 'No media loaded' });
  }, [mediaFiles]);

  useEffect(() => {
    return () => {
      mediaFiles.forEach(url => URL.revokeObjectURL(url));
    };
  }, [mediaFiles]);

  return (
    <div className="flex flex-col h-screen bg-[#e5ddd5]">
      <header className="p-4 bg-[#075E54] text-white flex justify-between items-center">
        <h1 className="text-lg font-semibold">WhatsApp Chat Viewer</h1>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer flex items-center gap-2 hover:bg-[#054c44] p-2 rounded transition-colors">
            <MessageSquare className="h-5 w-5" />
            <span>Load Chat</span>
            <input 
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleChatUpload}
            />
          </label>
          {/* <label className="cursor-pointer flex items-center gap-2 hover:bg-[#054c44] p-2 rounded transition-colors">
            <Paperclip className="h-5 w-5" />
            <span>Upload Media</span>
            <input 
              type="file"
              multiple
              className="hidden"
              onChange={handleMediaUpload}
            />
          </label> */}
          <button 
            onClick={clearChat}
            className="flex items-center gap-2 hover:bg-[#054c44] p-2 rounded transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            <span>Clear Chat</span>
          </button>
        </div>
      </header>
      <VirtualizedChat messages={messages} mediaFiles={mediaFiles} />
      <footer className="p-4 text-center text-sm text-gray-500 bg-white border-t">
        {status.chat} | {status.media}
      </footer>
    </div>
  );
}