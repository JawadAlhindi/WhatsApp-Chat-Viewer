import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Paperclip, File } from 'lucide-react';
import './index.css'; // Assuming you have Tailwind directives in this file

const parseTimestamp = (line) => {
  try {
    const match = line.match(/^\[?(.+?)\]?\s*-\s*/);
    return match ? { timestamp: match[1], rest: line.slice(match[0].length) } : null;
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return null;
  }
};

const parseSender = (content) => {
  try {
    const match = content.match(/^([^:]+):\s*/);
    return match ? { sender: match[1], message: content.slice(match[0].length) } : null;
  } catch (error) {
    console.error('Error parsing sender:', error);
    return null;
  }
};

const getMediaType = (fileName) => {
  if (!fileName) return 'file';
  const lower = fileName.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif)$/i)) return 'image';
  if (lower.match(/\.(mp4|webm)$/i)) return 'video';
  if (lower.match(/\.(opus|mp3|m4a|ogg)$/i)) return 'audio';
  return 'file';
};

const MediaPreview = React.memo(({ fileName, mediaUrl, type }) => {
  const [error, setError] = useState(false);
  const commonClasses = "rounded-lg max-w-full mt-2";

  const handleError = () => {
    console.error(`Error loading media: ${fileName}`);
    setError(true);
  };

  if (error) {
    return (
      <div className="text-red-500 text-sm mt-2">
        Failed to load media: {fileName}
      </div>
    );
  }

  switch (type) {
    case 'image':
      return (
        <img 
          src={mediaUrl} 
          alt={fileName} 
          className={`${commonClasses} max-h-60 object-contain`}
          loading="lazy"
          onError={handleError}
        />
      );
    case 'video':
      return (
        <video 
          src={mediaUrl} 
          controls 
          className={commonClasses}
          onError={handleError}
        />
      );
    case 'audio':
      return (
        <audio 
          src={mediaUrl} 
          controls 
          className="w-full mt-2"
          onError={handleError}
        />
      );
    default:
      return (
        <a 
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mt-2"
        >
          <File size={16} />
          {fileName}
        </a>
      );
  }
});

const Message = React.memo(({ data, mediaFiles }) => {
  const { timestamp, sender, content, isSent } = data;
  const mediaMatch = content.match(/<attached:\s*([^>]+)>/);
  const fileName = mediaMatch ? mediaMatch[1].trim().toLowerCase() : null;
  const mediaUrl = fileName ? mediaFiles.get(fileName) : null;
  const mediaType = fileName ? getMediaType(fileName) : null;

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[70%] rounded-lg p-3 relative ${
          isSent 
            ? 'bg-[#d9fdd3] text-right rounded-br-none'  // WhatsApp-like sent message bubble
            : 'bg-white text-left rounded-bl-none'       // WhatsApp-like received message bubble
        } shadow-sm`}
      >
        {!isSent && (
          <div className="text-sm font-medium text-gray-800 mb-1">
            {sender}
          </div>
        )}
        <div className="text-sm text-gray-700 break-words whitespace-pre-wrap">
          {content}
        </div>
        {mediaMatch && (
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {fileName}
            </div>
            {mediaUrl ? (
              <MediaPreview 
                fileName={fileName}
                mediaUrl={mediaUrl}
                type={mediaType}
              />
            ) : (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Paperclip size={16} />
                Media not available
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-2">
          {timestamp}
        </div>
      </div>
    </div>
  );
});

const VirtualizedChat = React.memo(({ messages, mediaFiles }) => {
  const scrollRef = useRef(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAutoScroll]);

  const handleScroll = useCallback((e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
    setIsAutoScroll(isAtBottom);
  }, []);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#efeae2]"  // WhatsApp chat background color
      onScroll={handleScroll}
    >
      {messages.map((message, index) => (
        <Message 
          key={`${message.timestamp}-${index}`}
          data={message}
          mediaFiles={mediaFiles}
        />
      ))}
    </div>
  );
});

export default function App() {
  const [messages, setMessages] = useState([]);
  const [mediaFiles, setMediaFiles] = useState(new Map());
  const [status, setStatus] = useState({ chat: 'No chat loaded', media: 'No media loaded' });
  const [error, setError] = useState(null);

  const handleMediaUpload = useCallback((e) => {
    try {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        setStatus(prev => ({ ...prev, media: 'No media files selected' }));
        return;
      }

      setStatus(prev => ({ ...prev, media: `Loading ${files.length} media files...` }));
      
      const newMediaFiles = new Map(mediaFiles);
      files.forEach(file => {
        const fileName = file.name.toLowerCase();
        newMediaFiles.set(fileName, URL.createObjectURL(file));
      });

      setMediaFiles(newMediaFiles);
      setStatus(prev => ({ ...prev, media: `Loaded ${files.length} media files` }));
      setError(null);
    } catch (error) {
      console.error('Error handling media upload:', error);
      setError('Failed to load media files. Please try again.');
      setStatus(prev => ({ ...prev, media: 'Error loading media files' }));
    }
  }, [mediaFiles]);

  const handleChatUpload = useCallback((e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) {
        setStatus(prev => ({ ...prev, chat: 'No chat file selected' }));
        return;
      }

      setStatus(prev => ({ ...prev, chat: 'Loading chat...' }));

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const lines = event.target.result.split('\n');
          const parsedMessages = lines
            .filter(line => line.trim())
            .map(line => {
              const timestampData = parseTimestamp(line);
              if (!timestampData) return null;

              const senderData = parseSender(timestampData.rest);
              if (!senderData) return null;

              return {
                timestamp: timestampData.timestamp,
                sender: senderData.sender,
                content: senderData.message,
                isSent: senderData.sender.includes('Ala\'aldeen')
              };
            })
            .filter(Boolean);

          setMessages(parsedMessages);
          setStatus(prev => ({ 
            ...prev, 
            chat: `Loaded ${parsedMessages.length} messages` 
          }));
          setError(null);
        } catch (error) {
          console.error('Error parsing chat file:', error);
          setError('Failed to parse chat file. Please try again.');
          setStatus(prev => ({ ...prev, chat: 'Error parsing chat file' }));
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading chat file:', error);
      setError('Failed to load chat file. Please try again.');
      setStatus(prev => ({ ...prev, chat: 'Error loading chat file' }));
    }
  }, []);

  useEffect(() => {
    return () => {
      mediaFiles.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaFiles]);

  return (
    <div className="flex flex-col h-screen bg-[#e5ddd5]"> {/* WhatsApp background color */}
      <header className="p-4 bg-[#075E54] text-white flex justify-between items-center"> {/* WhatsApp header color */}
        <h1 className="text-lg font-semibold">WhatsApp Chat Viewer</h1>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer flex items-center gap-2">
            <MessageSquare />
            <input 
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleChatUpload}
            />
            Load Chat
          </label>
          <label className="cursor-pointer flex items-center gap-2">
            <Paperclip />
            <input 
              type="file"
              multiple
              onChange={handleMediaUpload}
              className="hidden"
            />
            Upload Media
          </label>
        </div>
      </header>
      <main className="flex flex-col flex-1 overflow-hidden">
        <VirtualizedChat messages={messages} mediaFiles={mediaFiles} />
      </main>
      <footer className="p-4 bg-gray-200 text-gray-600 text-sm">
        {status.chat} | {status.media}
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </footer>
    </div>
  );
}
