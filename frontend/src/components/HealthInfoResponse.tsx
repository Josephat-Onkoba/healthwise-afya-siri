import React, { useState, useEffect, useMemo } from 'react';

interface HealthInfoResponseProps {
  content: string;
  typingSpeed?: number; // Speed in milliseconds per character
}

const HealthInfoResponse: React.FC<HealthInfoResponseProps> = ({ 
  content,
  typingSpeed = 100 // Default speed - lower is faster
}) => {
  const [displayContent, setDisplayContent] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [typingIndex, setTypingIndex] = useState(0);
  const [skipAnimation, setSkipAnimation] = useState(false);
  
  // Process the full content once when it changes
  const processedContent = useMemo(() => {
    // Pre-process the content to handle edge cases with ** markers
    let processed = content;
    
    // Replace all escaped double asterisks with a placeholder
    processed = processed.replace(/\\\*/g, '{{ASTERISK}}');
    
    return processed;
  }, [content]);
  
  // Implement the typing effect
  useEffect(() => {
    if (!processedContent) return;
    
    // If user wants to skip animation, show full content immediately
    if (skipAnimation) {
      setDisplayContent(processedContent);
      setIsTyping(false);
      return;
    }
    
    // Reset state when content changes
    setDisplayContent('');
    setTypingIndex(0);
    setIsTyping(true);
    
    // Calculate actual typing speed - add randomness for natural feel
    const getTypingDelay = () => {
      // Add variation to typing speed (70% to 130% of base speed)
      const randomFactor = 0.7 + Math.random() * 0.6;
      return typingSpeed * randomFactor;
    };
    
    // Typing effect with setTimeout for variable timing
    let timer: NodeJS.Timeout;
    
    const typeNextCharacter = () => {
      if (typingIndex < processedContent.length) {
        const char = processedContent[typingIndex];
        
        setDisplayContent(prev => prev + char);
        setTypingIndex(prev => prev + 1);
        
        // Add longer pauses at natural breaks
        let delay = getTypingDelay();
        
        // Longer pause at end of sentences
        if (/[.!?]/.test(char) && (typingIndex + 1 >= processedContent.length || processedContent[typingIndex + 1] === ' ' || processedContent[typingIndex + 1] === '\n')) {
          delay = getTypingDelay() * 15; // Much longer pause at end of sentences
        }
        // Medium pause at commas, semicolons, and colons
        else if (/[,;:]/.test(char)) {
          delay = getTypingDelay() * 8;
        }
        // Small pause at spaces and hyphens
        else if (/[\s-]/.test(char)) {
          delay = getTypingDelay() * 2;
        }
        // Extra long pause at paragraph breaks
        else if (char === '\n' && typingIndex + 1 < processedContent.length && processedContent[typingIndex + 1] === '\n') {
          delay = getTypingDelay() * 20;
        }
        
        timer = setTimeout(typeNextCharacter, delay);
      } else {
        setIsTyping(false);
      }
    };
    
    // Add an initial delay before starting to type
    timer = setTimeout(typeNextCharacter, 500);
    
    return () => clearTimeout(timer);
  }, [processedContent, typingSpeed, skipAnimation]);

  // Improved function to render bold text reliably
  const renderBoldText = (text: string) => {
    // Edge case: empty text
    if (!text) return null;
    
    const segments = [];
    let lastIndex = 0;
    let boldStartIndex = -1;
    let key = 0;
    
    // Scan through the text character by character to find ** pairs
    for (let i = 0; i < text.length; i++) {
      // Check for ** sequence (but not escaped \**)
      if (text[i] === '*' && i + 1 < text.length && text[i + 1] === '*' && (i === 0 || text[i - 1] !== '\\')) {
        // If we're not already in a bold section, start one
        if (boldStartIndex === -1) {
          // Add text before the bold marker
          if (i > lastIndex) {
            segments.push(
              <span key={key++}>
                {text.substring(lastIndex, i).replace(/{{ASTERISK}}/g, '*')}
              </span>
            );
          }
          boldStartIndex = i;
          i++; // Skip the second *
          lastIndex = i + 1; // Start after the **
        } 
        // If we are in a bold section, end it
        else {
          segments.push(
            <span key={key++} className="font-bold text-blue-700">
              {text.substring(lastIndex, i).replace(/{{ASTERISK}}/g, '*')}
            </span>
          );
          boldStartIndex = -1;
          i++; // Skip the second *
          lastIndex = i + 1; // Start after the **
        }
      }
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      // If we're still in a bold section (unclosed ** marker)
      if (boldStartIndex !== -1) {
        // Add the ** marker as literal text
        segments.push(
          <span key={key++}>
            {"**" + text.substring(lastIndex).replace(/{{ASTERISK}}/g, '*')}
          </span>
        );
      } else {
        segments.push(
          <span key={key++}>
            {text.substring(lastIndex).replace(/{{ASTERISK}}/g, '*')}
          </span>
        );
      }
    }
    
    return segments;
  };

  // Simple markdown renderer
  const renderMarkdown = () => {
    if (!displayContent) return <div></div>;
    
    // Split content by lines
    const lines = displayContent.split('\n');
    
    return (
      <div className="health-info">
        {lines.map((line, lineIndex) => {
          // Empty line - render a space
          if (!line.trim()) {
            return <div key={`line-${lineIndex}`} className="h-4"></div>;
          }
          
          // Heading - starts with '#'
          if (line.trim().startsWith('# ')) {
            const headingText = line.trim().substring(2);
            return <h1 key={`line-${lineIndex}`} className="text-xl font-bold mb-3 text-blue-700">{renderBoldText(headingText)}</h1>;
          }
          
          if (line.trim().startsWith('## ')) {
            const headingText = line.trim().substring(3);
            return <h2 key={`line-${lineIndex}`} className="text-lg font-bold mb-2 text-blue-700">{renderBoldText(headingText)}</h2>;
          }
          
          // Bullet point - starts with '*' or '-'
          if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            const bulletText = line.trim().substring(2);
            return (
              <div key={`line-${lineIndex}`} className="flex mb-2">
                <span className="mr-2 text-blue-600 ml-6">•</span>
                <span className="flex-1">{renderBoldText(bulletText)}</span>
              </div>
            );
          }
          
          // Numbered list - starts with a number and period
          const numberedMatch = line.trim().match(/^(\d+)\.\s+(.+)$/);
          if (numberedMatch) {
            return (
              <div key={`line-${lineIndex}`} className="flex mb-2">
                <span className="mr-2 font-bold text-blue-600 ml-6">{numberedMatch[1]}.</span>
                <span className="flex-1">{renderBoldText(numberedMatch[2])}</span>
              </div>
            );
          }
          
          // Regular paragraph
          return <p key={`line-${lineIndex}`} className="mb-3">{renderBoldText(line)}</p>;
        })}
        {isTyping && (
          <span className="typing-cursor inline-block h-5 w-[2px] bg-blue-600 ml-1 animate-blink"></span>
        )}
      </div>
    );
  };
  
  // Handle user click to skip animation
  const handleSkipAnimation = () => {
    setSkipAnimation(true);
    setDisplayContent(processedContent);
    setIsTyping(false);
  };
  
  return (
    <div className="health-info-response">
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .typing-cursor {
          animation: blink 0.7s infinite;
        }
      `}</style>
      
      {renderMarkdown()}
      
      {isTyping && (
        <button 
          onClick={handleSkipAnimation}
          className="text-xs text-blue-500 hover:text-blue-700 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-2 py-1"
          aria-label="Skip typing animation"
        >
          Skip typing
        </button>
      )}
    </div>
  );
};

export default HealthInfoResponse;
