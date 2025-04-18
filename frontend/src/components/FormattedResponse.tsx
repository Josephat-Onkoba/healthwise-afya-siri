import React, { useState, useEffect, useRef } from 'react';
import { FiCheckCircle } from 'react-icons/fi';

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
      
      // Check if the line is a heading
      if (line.trim().startsWith('##')) {
        return (
          <h2 key={index} className="text-lg font-bold mb-2 text-purple-700">
            {line.trim().substring(2).trim()}
          </h2>
        );
      }
      
      // Check if the line is a subheading
      if (line.trim().startsWith('#')) {
        return (
          <h3 key={index} className="text-md font-semibold mb-2 text-purple-600">
            {line.trim().substring(1).trim()}
          </h3>
        );
      }
      
      // Check for numbered headings like "1. Health-Related Aspects"
      const numberedHeadingMatch = line.match(/^(\*\*)?(\d+)\.\s+([A-Z].*?:)(\*\*)?/);
      if (numberedHeadingMatch) {
        const headingNumber = numberedHeadingMatch[2];
        const headingText = numberedHeadingMatch[3].replace(':', '');
        return (
          <h2 key={index} className="text-xl font-bold mb-4 mt-5 text-purple-700">
            {headingNumber}. {headingText}:
          </h2>
        );
      }
      
      // Check for Recommendation section
      const recommendationMatch = line.match(/^(\*\*)?Recommendation:(\*\*)?\s+(.*)/i);
      if (recommendationMatch) {
        const recommendationText = recommendationMatch[3];
        return (
          <div key={index} className="mb-3 mt-4">
            <span className="font-bold text-purple-700 text-lg">Recommendation: </span>
            <span>{formatInlineMarkdown(recommendationText)}</span>
          </div>
        );
      }
      
      // Check if the line is a numbered list item
      const numberedItemMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedItemMatch && !numberedHeadingMatch) {
        return (
          <div key={index} className="flex mb-2">
            <span className="font-bold mr-2 text-purple-600">{numberedItemMatch[1]}.</span>
            <span className="flex-1">{formatInlineMarkdown(numberedItemMatch[2])}</span>
          </div>
        );
      }
      
      // Check if the line is a bullet point
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        const bulletContent = line.trim().substring(1).trim();
        
        // Check if there's a colon or dash separating the main statement from description
        const mainStatementMatch = bulletContent.match(/^(.*?)(?::|—|–|-)\s*(.*)/);
        
        if (mainStatementMatch) {
          // If there's a separator, format the main statement and description differently
          const [_, mainStatement, description] = mainStatementMatch;
          return (
            <div key={index} className="flex mb-2">
              <span className="mr-2 text-purple-600">•</span>
              <span className="flex-1">
                <span className="font-bold italic">{formatInlineMarkdown(mainStatement.trim())}</span>
                {mainStatementMatch[0].includes(':') ? ': ' : ' - '}
                <span className="text-gray-800">{formatInlineMarkdown(description.trim())}</span>
              </span>
            </div>
          );
        } else {
          // If there's no clear separator, style the whole line as a main statement
          return (
            <div key={index} className="flex mb-2">
              <span className="mr-2 text-purple-600">•</span>
              <span className="flex-1 font-bold italic">{formatInlineMarkdown(bulletContent)}</span>
            </div>
          );
        }
      }
      
      // Regular paragraph with inline formatting
      return (
        <p key={index} className="mb-2">
          {formatInlineMarkdown(line)}
        </p>
      );
    });
  };

  // Helper function to handle inline markdown like bold and italics
  const formatInlineMarkdown = (text: string) => {
    if (!text) return text;
    
    // Process the text to replace markdown with JSX elements
    // First, handle bold text (double asterisks)
    const boldRegex = /\*\*(.*?)\*\*/g;
    const boldParts = text.split(boldRegex);
    
    if (boldParts.length > 1) {
      const result = [];
      for (let i = 0; i < boldParts.length; i++) {
        if (i % 2 === 0) {
          // Even indices are regular text or might contain other formatting
          if (boldParts[i]) {
            result.push(formatItalics(boldParts[i]));
          }
        } else {
          // Odd indices are the content between ** ** that should be bold
          result.push(
            <span key={`bold-${i}`} className="font-bold text-purple-800">{formatItalics(boldParts[i])}</span>
          );
        }
      }
      return <>{result}</>;
    }
    
    // If no bold formatting, check for italics
    return formatItalics(text);
  };

  // Helper function to handle italic formatting
  const formatItalics = (text: string) => {
    if (!text) return text;
    
    // Handle italic text (single asterisks)
    const italicRegex = /\*(.*?)\*/g;
    const italicParts = text.split(italicRegex);
    
    if (italicParts.length > 1) {
      const result = [];
      for (let i = 0; i < italicParts.length; i++) {
        if (i % 2 === 0) {
          // Even indices are regular text
          if (italicParts[i]) {
            result.push(formatLinks(italicParts[i]));
          }
        } else {
          // Odd indices are the content between * * that should be italic
          result.push(
            <span key={`italic-${i}`} className="italic text-purple-600">{formatLinks(italicParts[i])}</span>
          );
        }
      }
      return <>{result}</>;
    }
    
    // If no italic formatting, check for links
    return formatLinks(text);
  };

  // Helper function to handle links
  const formatLinks = (text: string) => {
    if (!text) return text;
    
    // Check for links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = Array.from(text.matchAll(linkRegex));
    
    if (matches.length > 0) {
      const result = [];
      let lastIndex = 0;
      
      matches.forEach((match, idx) => {
        const [fullMatch, linkText, linkUrl] = match;
        const matchIndex = match.index || 0;
        
        // Add text before the link
        if (matchIndex > lastIndex) {
          result.push(text.substring(lastIndex, matchIndex));
        }
        
        // Add the link
        result.push(
          <a 
            key={`link-${idx}`} 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-purple-600 underline"
          >
            {linkText}
          </a>
        );
        
        lastIndex = matchIndex + fullMatch.length;
      });
      
      // Add any remaining text after the last link
      if (lastIndex < text.length) {
        result.push(text.substring(lastIndex));
      }
      
      return <>{result}</>;
    }
    
    // No special formatting needed
    return text;
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
          <FiCheckCircle className="inline mr-1" />
          Skip typing
        </button>
      )}
    </div>
  );
};

export default FormattedResponse; 