import React, { useState, useEffect, useRef } from 'react';

interface FormattedResponseProps {
  content: string;
  typingSpeed?: 'slow' | 'medium' | 'fast';
  enableAnimations?: boolean;
}

const FormattedResponse: React.FC<FormattedResponseProps> = ({ 
  content, 
  typingSpeed = 'medium', 
  enableAnimations = false
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const typingRef = useRef<number | null>(null);
  
  // Function to get typing speed value in ms based on preference
  const getTypingSpeedValue = (): number => {
    switch (typingSpeed) {
      case 'slow': return 40;
      case 'fast': return 8;
      default: return 20;
    }
  };
  
  // Setup typing animation effect
  useEffect(() => {
    // Clean up any existing typing animation
    if (typingRef.current) {
      clearTimeout(typingRef.current);
    }
    
    if (!enableAnimations) {
      setDisplayedContent(content);
      setIsComplete(true);
      return;
    }
    
    let currentIndex = 0;
    const speed = getTypingSpeedValue();
    setIsComplete(false);
    setDisplayedContent('');
    
    const typeNextCharacter = () => {
      if (currentIndex < content.length) {
        // Add one character at a time, rather than duplicating characters
        setDisplayedContent(content.substring(0, currentIndex + 1));
        currentIndex++;
        
        // Add slightly longer pauses at punctuation for more natural reading
        const nextChar = content.charAt(currentIndex - 1);
        const delay = ['.', '!', '?', ':'].includes(nextChar) ? speed * 6 : 
                      [',', ';'].includes(nextChar) ? speed * 3 : speed;
        
        typingRef.current = window.setTimeout(typeNextCharacter, delay);
      } else {
        setIsComplete(true);
        typingRef.current = null;
      }
    };
    
    // Start typing effect with a small initial delay
    typingRef.current = window.setTimeout(typeNextCharacter, 100);
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (typingRef.current) {
        clearTimeout(typingRef.current);
      }
      setIsComplete(true);
    };
  }, [content, enableAnimations, typingSpeed]);
  
  // Function to format the content with proper styling
  const formatContent = (text: string) => {
    // Split the content by newlines
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Skip empty lines
      if (!line.trim()) {
        return <div key={index} className="h-2"></div>;
      }
      
      // Check if the line is a heading with double asterisks
      if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
        const headingText = line.trim().replace(/\*\*/g, '');
        return <h2 key={index} className="text-lg font-bold mb-2 text-purple-700">{headingText}</h2>;
      }
      
      // Check if the line is a heading
      if (line.trim().startsWith('##')) {
        return <h2 key={index} className="text-lg font-bold mb-2 text-purple-700">{line.trim().substring(2).trim()}</h2>;
      }
      
      // Check if the line is a subheading
      if (line.trim().startsWith('#')) {
        return <h3 key={index} className="text-md font-semibold mb-2 text-purple-600">{line.trim().substring(1).trim()}</h3>;
      }
      
      // Check if the line is a numbered list item
      const numberedItemMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedItemMatch) {
        return (
          <div key={index} className="flex mb-3">
            <span className="font-bold mr-2 text-purple-600">{numberedItemMatch[1]}.</span>
            <span className="flex-1">{numberedItemMatch[2]}</span>
          </div>
        );
      }
      
      // Check if the line is a bullet point
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        return (
          <div key={index} className="flex mb-2">
            <span className="mr-2 text-purple-600">•</span>
            <span className="flex-1">{line.trim().substring(1).trim()}</span>
          </div>
        );
      }
      
      // Check if the line contains a link
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const beforeLink = line.substring(0, line.indexOf('['));
        const afterLink = line.substring(line.indexOf(']') + 1);
        return (
          <p key={index} className="mb-2">
            {beforeLink}
            <a href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">
              {linkMatch[1]}
            </a>
            {afterLink}
          </p>
        );
      }
      
      // Check if the line contains bold text with single asterisks
      if (line.includes('*')) {
        const parts = line.split(/(\*[^*]+\*)/g);
        return (
          <p key={index} className="mb-2">
            {parts.map((part, i) => {
              if (part.startsWith('*') && part.endsWith('*')) {
                return <span key={i} className="font-bold">{part.substring(1, part.length - 1)}</span>;
              }
              return part;
            })}
          </p>
        );
      }
      
      // Regular paragraph
      return <p key={index} className="mb-2">{line}</p>;
    });
  };

  return (
    <div className="formatted-response">
      {formatContent(displayedContent)}
      
      {/* Skip animation button */}
      {enableAnimations && !isComplete && (
        <button 
          onClick={() => {
            if (typingRef.current) {
              clearTimeout(typingRef.current);
            }
            setDisplayedContent(content);
            setIsComplete(true);
          }}
          className="text-xs text-purple-500 mt-2 hover:underline focus:outline-none"
          aria-label="Skip typing animation"
        >
          Skip typing
        </button>
      )}
    </div>
  );
};

export default FormattedResponse; 