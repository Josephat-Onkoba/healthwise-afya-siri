import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import MediaUpload from './MediaUpload';
import AudioResponse from './AudioResponse';
import FormattedResponse from './FormattedResponse';
import HealthInfoResponse from './HealthInfoResponse';
import { 
  FiSend, FiMic, FiImage, FiVideo, FiLoader, FiAlertCircle, 
  FiRefreshCw, FiTrash2, FiMicOff, FiSettings, FiX, 
  FiShare2, FiCopy, FiDownload, FiBookmark, FiCheck 
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  mediaUrl?: string;
  status?: 'sending' | 'sent' | 'error';
  error?: string;
  retryFn?: () => void; // Function to retry a failed message
}

interface ChatInterfaceProps {
  targetLanguage: string;
}

// Error type definition for better error handling
type ErrorWithMessage = {
  message: string;
  status?: number;
  details?: string;
};

// Add speech recognition type declaration
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Interface for user preferences
interface UserPreferences {
  typingSpeed: 'slow' | 'medium' | 'fast';
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  enableVoiceInput: boolean;
  enableAnimations: boolean;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  typingSpeed: 'medium',
  theme: 'light',
  fontSize: 'medium',
  enableVoiceInput: true,
  enableAnimations: false
};

// Simple list of inappropriate words to filter (can be expanded)
const INAPPROPRIATE_TERMS = [
  // Add inappropriate terms here if needed
];

const ChatInterface = forwardRef<{ clearChatHistory: () => void }, ChatInterfaceProps>(({ targetLanguage }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(defaultPreferences);
  const [bookmarkedResponses, setBookmarkedResponses] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Load messages from localStorage on initial load
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert string timestamps back to Date objects
        const messagesWithDateObjects = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDateObjects);
      } catch (error) {
        console.error('Error parsing saved chat history:', error);
        // If there's an error parsing, start with empty chat
      }
    } else {
      // Add welcome message for new users
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: 'Hello! I\'m Afya Siri, your private health companion. How can I help you today?',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages));
    }
  }, [messages]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial status
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up any ongoing requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Format error message to make it user-friendly
  const formatErrorMessage = (error: any): ErrorWithMessage => {
    if (typeof error === 'string') {
      return { message: error };
    }
    
    if (error instanceof Error) {
      if ('status' in error) {
        // Network error
        const status = (error as any).status;
        if (status === 429) {
          return { 
            message: 'Too many requests, please try again later',
            status: status 
          };
        }
        return { 
          message: error.message || 'Server error',
          status: status,
          details: error.stack
        };
      }
      return { 
        message: error.message,
        details: error.stack
      };
    }
    
    if (error && typeof error === 'object' && 'error' in error) {
      return { 
        message: (error as any).error,
        details: JSON.stringify(error)
      };
    }
    
    // Default for unknown error types
    return { message: 'An unexpected error occurred' };
  };

  // Create a retry function
  const createRetryFunction = useCallback((
    content: string | File,
    type: 'text' | 'image' | 'video' | 'audio',
    mediaUrl?: string
  ) => {
    return () => handleSendMessage(content, type, mediaUrl);
  }, []);

  // Function to check if content contains inappropriate terms
  const containsInappropriateContent = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    
    // Check for obvious inappropriate terms
    return INAPPROPRIATE_TERMS.some(term => lowerContent.includes(term.toLowerCase()));
  };

  // Function to filter/sanitize content before sending
  const sanitizeContent = (content: string): string => {
    let sanitized = content;
    
    // Replace inappropriate terms with asterisks
    INAPPROPRIATE_TERMS.forEach(term => {
      if (term.length > 3) { // Only replace terms longer than 3 characters to avoid false positives
        const regex = new RegExp(term, 'gi');
        sanitized = sanitized.replace(regex, '*'.repeat(term.length));
      }
    });
    
    return sanitized;
  };

  // Modify the handleSendMessage function to include content moderation
  const handleSendMessage = async (content: string | File, type: 'text' | 'image' | 'video' | 'audio' = 'text', mediaUrl?: string) => {
    if (!content && !mediaUrl) return;
    
    // For text content, check for inappropriate content
    if (type === 'text' && typeof content === 'string') {
      if (containsInappropriateContent(content)) {
        // Show warning
        toast.error('Your message may contain inappropriate content. Please revise it.');
        
        // Option 1: Block the message completely
        // return;
        
        // Option 2: Sanitize the content (replace inappropriate terms)
        content = sanitizeContent(content);
        
        // For healthcare context, we might want to allow the message with a warning
        toast('Some terms in your message have been filtered for appropriateness.', {
          icon: '🔔',
          style: {
            background: '#EFF6FF',
            color: '#3B82F6'
          }
        });
      }
    }
    
    // Check network status
    if (networkStatus === 'offline') {
      const errorMsg = "You're offline. Please check your internet connection and try again.";
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: errorMsg,
        sender: 'bot',
        timestamp: new Date(),
        status: 'error',
        error: errorMsg
      };
      
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    console.log('Sending message:', { 
      type, 
      hasContent: !!content, 
      hasMediaUrl: !!mediaUrl,
      contentType: typeof content,
      isFile: content instanceof File
    });
    
    // Abort any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const messageId = Date.now().toString();
    const newMessage: Message = {
      id: messageId,
      type,
      content: typeof content === 'string' ? content : content.name,
      sender: 'user',
      timestamp: new Date(),
      mediaUrl,
      status: 'sending'
    };

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    try {
      let response;
      const formData = new FormData();
      
      if (type === 'text') {
        console.log('Sending text query:', content);
        response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, target_language: targetLanguage }),
          signal
        });
      } else {
        const file = content as File;
        console.log('Sending media:', { 
          type, 
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        formData.append('file', file);
        formData.append('target_language', targetLanguage);
        
        const endpoint = type === 'image' ? '/api/upload/image' : 
                        type === 'video' ? '/api/upload/video' : '/api/upload/voice';
        
        console.log(`Sending ${type} to endpoint: ${endpoint}`);
        
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            signal
          });
        } catch (error) {
          throw error;
        }
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // If we can't parse error as JSON, use status text
          errorData = { error: response.statusText || `Error: ${response.status}` };
        }
        
        console.error('Server error response:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received response:', data);
      
      // Update user message status
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'sent' } : msg
      ));

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: data.response || data.translated_text || data.description || 'No response received',
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      // Don't show error if request was aborted (user initiated)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Request aborted by user');
        return;
      }
      
      console.error('Error sending message:', error);
      
      // Create a retry function
      const retryFn = createRetryFunction(content, type, mediaUrl);
      
      // Format the error message
      const formattedError = formatErrorMessage(error);
      
      // Update user message with error
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { 
          ...msg, 
          status: 'error',
          error: formattedError.message,
          retryFn
        } : msg
      ));

      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: formattedError.status === 429 
          ? 'The service is currently busy. Please try again in a moment.'
          : 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        status: 'error',
        error: formattedError.message,
        retryFn
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleMediaUpload = async (file: File, type: 'image' | 'video' | 'audio') => {
    console.log('Handling media upload:', { 
      fileName: file.name, 
      type, 
      size: file.size,
      mimeType: file.type
    });
    
    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: `File is too large. Maximum size is 10MB.`,
        sender: 'bot',
        timestamp: new Date(),
        status: 'error',
        error: 'File size exceeds limit'
      };
      
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    try {
      // Create a preview URL for the media
      const mediaUrl = URL.createObjectURL(file);
      setMediaPreview(mediaUrl);
      
      // Add a temporary message to show the media is being processed
      const tempMessageId = Date.now().toString();
      const tempMessage: Message = {
        id: tempMessageId,
        type,
        content: `Processing ${type}...`,
        sender: 'user',
        timestamp: new Date(),
        mediaUrl,
        status: 'sending'
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Send the media to the backend
      console.log('Sending media to backend:', { type, fileName: file.name });
      await handleSendMessage(file, type, mediaUrl);
      
      // Clear the preview after successful upload
      setMediaPreview(null);
      
      // Update the temporary message status
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId ? { ...msg, status: 'sent' } : msg
      ));
    } catch (error) {
      console.error('Error in handleMediaUpload:', error);
      
      // Clear the preview on error
      setMediaPreview(null);
      
      // Format the error message
      const formattedError = formatErrorMessage(error);
      
      // Create a retry function
      const retryFn = createRetryFunction(file, type);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: `Failed to upload ${type}. ${formattedError.message}`,
        sender: 'bot',
        timestamp: new Date(),
        status: 'error',
        error: formattedError.message,
        retryFn
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const getMessageStatus = (message: Message) => {
    if (message.status === 'sending') {
      return <FiLoader className="animate-spin text-blue-500" />;
    }
    
    if (message.status === 'error') {
      return (
        <div className="flex flex-col items-start">
          <div className="flex items-center text-red-500">
            <FiAlertCircle className="mr-1" />
            <span className="text-xs">{message.error}</span>
          </div>
          {message.retryFn && (
            <button 
              onClick={message.retryFn}
              className="flex items-center text-xs text-blue-500 hover:text-blue-700 mt-1"
              aria-label="Retry"
            >
              <FiRefreshCw className="mr-1" /> Retry
            </button>
          )}
        </div>
      );
    }
    
    return null;
  };

  // Handle network status banner
  const renderNetworkStatusBanner = () => {
    if (networkStatus === 'offline') {
      return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-2 mb-4" role="alert">
          <div className="flex items-center">
            <FiAlertCircle className="mr-2" />
            <p>You're offline. Please check your internet connection.</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Function to clear chat history
  const clearChatHistory = () => {
    // Show confirmation dialog
    if (window.confirm('Are you sure you want to clear chat history? This cannot be undone.')) {
      // Keep only the welcome message
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: 'Hello! I\'m Afya Siri, your private health companion. How can I help you today?',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      localStorage.removeItem('chatHistory');
      toast.success('Chat history cleared');
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = targetLanguage === 'en' ? 'en-US' : 
                        targetLanguage === 'sw' ? 'sw-KE' : 
                        targetLanguage === 'ha' ? 'ha' : 
                        targetLanguage === 'yo' ? 'yo' : 
                        targetLanguage === 'ig' ? 'ig' : 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setInputText(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      speechRecognitionRef.current = recognition;
    }
  }, [targetLanguage]);
  
  // Toggle speech recognition
  const toggleSpeechRecognition = () => {
    if (!speechRecognitionRef.current) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }
    
    if (isRecording) {
      speechRecognitionRef.current.stop();
      setIsRecording(false);
    } else {
      speechRecognitionRef.current.start();
      setIsRecording(true);
      toast.success('Listening... Speak your question');
    }
  };

  // Load user preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      try {
        const parsedPreferences = JSON.parse(savedPreferences);
        setUserPreferences(parsedPreferences);
      } catch (error) {
        console.error('Error parsing saved preferences:', error);
        // If there's an error parsing, use default preferences
      }
    }
  }, []);
  
  // Save preferences whenever they change
  useEffect(() => {
    localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
  }, [userPreferences]);
  
  // Handle preference changes
  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setUserPreferences(prev => ({ ...prev, [key]: value }));
    
    // Apply theme immediately
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
  };
  
  // Get font size class based on preference
  const getFontSizeClass = () => {
    switch (userPreferences.fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };

  // Load bookmarked responses from localStorage
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('bookmarkedResponses');
    if (savedBookmarks) {
      try {
        const parsedBookmarks = JSON.parse(savedBookmarks);
        setBookmarkedResponses(parsedBookmarks);
      } catch (error) {
        console.error('Error parsing bookmarked responses:', error);
      }
    }
  }, []);
  
  // Save bookmarked responses whenever they change
  useEffect(() => {
    localStorage.setItem('bookmarkedResponses', JSON.stringify(bookmarkedResponses));
  }, [bookmarkedResponses]);
  
  // Function to toggle bookmark for a message
  const toggleBookmark = (messageId: string, content: string) => {
    if (bookmarkedResponses.includes(content)) {
      setBookmarkedResponses(prev => prev.filter(msg => msg !== content));
      toast.success('Bookmark removed');
    } else {
      setBookmarkedResponses(prev => [...prev, content]);
      toast.success('Response bookmarked');
    }
  };
  
  // Function to copy message content to clipboard
  const copyToClipboard = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        setCopiedMessageId(messageId);
        toast.success('Copied to clipboard');
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
        toast.error('Failed to copy text');
      });
  };
  
  // Function to download message content as text file
  const downloadAsTextFile = (content: string, fileName = 'health-information.txt') => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Downloaded as text file');
  };
  
  // Function to share content if Web Share API is available
  const shareContent = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Health Information from Afya Siri',
          text: content,
        });
        toast.success('Content shared successfully');
      } catch (error) {
        console.error('Error sharing content:', error);
        if ((error as any)?.name !== 'AbortError') {
          toast.error('Could not share content');
        }
      }
    } else {
      toast.error('Web Share API not supported in your browser');
      // Fallback to copy
      navigator.clipboard.writeText(content)
        .then(() => toast.success('Content copied to clipboard instead'))
        .catch(err => toast.error('Could not copy content'));
    }
  };

  // Message sharing options component
  const MessageActions = ({ message }: { message: Message }) => {
    if (message.sender !== 'bot') return null;
    
    const isBookmarked = bookmarkedResponses.includes(message.content);
    const isCopied = copiedMessageId === message.id;
    
    return (
      <div className="flex items-center space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => toggleBookmark(message.id, message.content)}
          className={`p-1 rounded-full ${isBookmarked ? 'text-yellow-500 hover:bg-yellow-100' : 'text-gray-500 hover:bg-gray-100'} focus:outline-none transition-colors`}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this information"}
          title={isBookmarked ? "Remove bookmark" : "Bookmark this information"}
        >
          <FiBookmark className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => copyToClipboard(message.id, message.content)}
          className={`p-1 rounded-full ${isCopied ? 'text-green-500 hover:bg-green-100' : 'text-gray-500 hover:bg-gray-100'} focus:outline-none transition-colors`}
          aria-label="Copy to clipboard"
          title="Copy to clipboard"
        >
          {isCopied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
        </button>
        
        <button
          onClick={() => downloadAsTextFile(message.content)}
          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors"
          aria-label="Download as text file"
          title="Download as text file"
        >
          <FiDownload className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => shareContent(message.content)}
          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none transition-colors"
          aria-label="Share content"
          title="Share content"
        >
          <FiShare2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Settings modal component
  const SettingsModal = () => {
    if (!showSettings) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-purple-700">Settings</h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close settings"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Typing Speed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Typing Speed
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['slow', 'medium', 'fast'] as const).map(speed => (
                  <button
                    key={speed}
                    className={`py-2 px-4 border rounded-md ${
                      userPreferences.typingSpeed === speed 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handlePreferenceChange('typingSpeed', speed)}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['light', 'dark'] as const).map(theme => (
                  <button
                    key={theme}
                    className={`py-2 px-4 border rounded-md ${
                      userPreferences.theme === theme 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handlePreferenceChange('theme', theme)}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map(size => (
                  <button
                    key={size}
                    className={`py-2 px-4 border rounded-md ${
                      userPreferences.fontSize === size 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handlePreferenceChange('fontSize', size)}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Toggle Switches */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Enable Voice Input</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={userPreferences.enableVoiceInput}
                    onChange={e => handlePreferenceChange('enableVoiceInput', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Enable Animations</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={userPreferences.enableAnimations}
                    onChange={e => handlePreferenceChange('enableAnimations', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
            
            {/* Bookmarked Content Section */}
            {bookmarkedResponses.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-md font-medium text-purple-700 mb-3">Bookmarked Information</h3>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {bookmarkedResponses.map((content, index) => (
                    <div key={index} className="bg-purple-50 p-3 rounded-md relative pr-12">
                      <p className="text-sm text-gray-800">{content.length > 150 ? content.substring(0, 150) + '...' : content}</p>
                      <div className="absolute right-2 top-2 flex space-x-1">
                        <button
                          onClick={() => copyToClipboard(`bookmark-${index}`, content)}
                          className="p-1 rounded-full text-purple-600 hover:bg-purple-100 focus:outline-none transition-colors"
                          aria-label="Copy bookmarked content"
                          title="Copy"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setBookmarkedResponses(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 rounded-full text-red-500 hover:bg-red-100 focus:outline-none transition-colors"
                          aria-label="Remove bookmark"
                          title="Remove"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Reset Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setUserPreferences(defaultPreferences);
                  toast.success('Settings reset to default');
                }}
                className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    clearChatHistory
  }));

  return (
    <>
      <div className={`flex flex-col h-full w-full ${getFontSizeClass()} ${userPreferences.theme === 'dark' ? 'dark:bg-gray-800 dark:text-white' : 'bg-gradient-to-br from-purple-50 via-white to-pink-50'}`}>
        {/* Network status banner */}
        {renderNetworkStatusBanner()}
        
        {/* Chat message area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`relative max-w-[90%] sm:max-w-[80%] rounded-lg p-3 group ${
                  message.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-br-none' 
                    : userPreferences.theme === 'dark'
                      ? 'bg-gray-700 text-white rounded-bl-none'
                      : 'bg-white border border-gray-200 rounded-bl-none shadow-sm'
                }`}
              >
                {/* Message content */}
                <div className={message.type === 'text' ? userPreferences.fontSize : ''}>
                  {message.type === 'text' && (
                    <FormattedResponse 
                      content={message.content} 
                      typingSpeed={userPreferences.typingSpeed}
                      enableAnimations={userPreferences.enableAnimations}
                    />
                  )}
                  {message.type === 'image' && message.mediaUrl && (
                    <div className="mt-2">
                      <img
                        src={message.mediaUrl}
                        alt="Uploaded"
                        className="max-w-full rounded"
                      />
                    </div>
                  )}
                  {message.type === 'video' && message.mediaUrl && (
                    <div className="mt-2">
                      <video
                        src={message.mediaUrl}
                        controls
                        className="max-w-full rounded"
                      />
                    </div>
                  )}
                  {message.type === 'audio' && message.mediaUrl && (
                    <div className="mt-2">
                      <audio
                        src={message.mediaUrl}
                        controls
                        className="max-w-full"
                      />
                    </div>
                  )}
                </div>
                
                {/* Message sharing options */}
                <MessageActions message={message} />
                
                {getMessageStatus(message)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Chat input area */}
        <div className="border-t border-gray-200 p-3 sm:p-4 bg-white">
          <div className="flex items-start space-x-2">
            <div className="flex-1 relative overflow-hidden transition-all">
              <textarea
                className="w-full p-3 pb-10 focus:outline-none resize-none bg-white text-gray-700 placeholder-gray-400 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100 shadow-sm"
                placeholder={isRecording ? "Listening..." : "Type your health question here..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim()) {
                      handleSendMessage(inputText);
                      setInputText('');
                    }
                  }
                }}
                rows={1}
                aria-label="Message input"
                style={{ minHeight: '50px', maxHeight: '150px' }}
              />
              
              {/* Controls inside textarea */}
              <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'image')}
                  accept="image/*"
                  icon={<FiImage className="w-5 h-5 text-purple-500" />}
                  buttonAriaLabel="Upload image"
                />
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'video')}
                  accept="video/*"
                  icon={<FiVideo className="w-5 h-5 text-purple-500" />}
                  buttonAriaLabel="Upload video"
                />
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'audio')}
                  accept="audio/*"
                  icon={<FiMic className="w-5 h-5 text-purple-500" />}
                  buttonAriaLabel="Upload audio"
                />
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-full hover:bg-purple-50 text-purple-500 transition-colors"
                  aria-label="Settings"
                  title="Settings"
                >
                  <FiSettings className="w-5 h-5" />
                </button>
              </div>
              
              {isLoading && (
                <div className="absolute bottom-2 right-4 text-purple-500">
                  <FiLoader className="animate-spin" />
                </div>
              )}
            </div>
            
            <button
              onClick={toggleSpeechRecognition}
              className={`p-3 rounded-xl ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-500 border-2 border-purple-100'
              } focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all shadow-sm`}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              title={isRecording ? "Stop recording" : "Speak your question"}
            >
              {isRecording ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
            </button>
            
            <button
              className={`p-3 rounded-xl ${
                inputText.trim() 
                  ? 'bg-purple-600 text-white hover:bg-purple-700 border-2 border-purple-600' 
                  : 'bg-purple-200 text-white cursor-not-allowed border-2 border-purple-200'
              } focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all shadow-sm`}
              onClick={() => {
                if (inputText.trim()) {
                  handleSendMessage(inputText);
                  setInputText('');
                }
              }}
              disabled={isLoading || !inputText.trim()}
              aria-label="Send message"
            >
              <FiSend className="w-5 h-5" />
            </button>
          </div>
          
          {/* Typing indicator */}
          {isLoading && (
            <div className="text-xs text-gray-500 mt-2 flex items-center">
              <div className="mr-2">Afya Siri is typing</div>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Render settings modal */}
      <SettingsModal />
    </>
  );
});

export default ChatInterface; 