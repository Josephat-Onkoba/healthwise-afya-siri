import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import MediaUpload from './MediaUpload';
import AudioResponse from './AudioResponse';
import FormattedResponse from './FormattedResponse';
import HealthInfoResponse from './HealthInfoResponse';
import { 
  FiSend, FiMic, FiImage, FiVideo, FiLoader, FiAlertCircle, 
  FiRefreshCw, FiTrash2, FiMicOff, FiSettings, FiX, 
  FiShare2, FiCopy, FiDownload, FiBookmark, FiCheck,
  FiHeadphones, FiMusic
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import apiFetch from '../utils/apiMapping'; // Import the API mapping utility

interface Message {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  mediaUrl?: string;
  status?: 'sending' | 'sent' | 'error' | 'pending';
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

const ChatInterface = forwardRef<{ clearChatHistory: () => void; openSettings: () => void }, ChatInterfaceProps>(({ targetLanguage }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [isRecording, setIsRecording] = useState(false);
  const [speechText, setSpeechText] = useState(''); // Store speech text separately
  const [listeningTimeout, setListeningTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasSentMessage, setHasSentMessage] = useState(false); // Track if a message has been sent
  const [cooldownActive, setCooldownActive] = useState(false); // Add cooldown to prevent rapid sending
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(defaultPreferences);
  const [bookmarkedResponses, setBookmarkedResponses] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [videoProcessingType, setVideoProcessingType] = useState<'auto' | 'frames' | 'audio'>('auto');
  const [showVideoOptions, setShowVideoOptions] = useState<boolean>(false);
  const [pendingVideoUpload, setPendingVideoUpload] = useState<File | null>(null);
  const [showListeningIndicator, setShowListeningIndicator] = useState(false);

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
        response = await apiFetch('/api/query', {
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
        
        // Add the correct parameters based on media type
        if (type === 'image') {
          // For image uploads, add a default query parameter
          formData.append('query', 'Analyze this health-related image');
        } else {
          // For other media types, include language
          formData.append('language', targetLanguage);
        }
        
        const endpoint = type === 'image' ? '/api/upload/image' : 
                        type === 'video' ? '/api/upload/video/comprehensive' : '/api/upload/voice';
        
        console.log(`Sending ${type} to endpoint: ${endpoint}`);
        
        try {
          // For video, we should use our polling mechanism instead
          if (type === 'video') {
            // Generate a unique ID for this processing request
            const requestId = messageId;
            
            // Update the message to show progress initially
            const updateProgress = (progress: string) => {
              setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, content: progress } : msg
              ));
            };
            
            updateProgress("Processing video. This may take a minute or two...");
            
            // Initial API call to start processing
            const initialResponse = await apiFetch(endpoint, {
              method: 'POST',
              body: formData
            });
            
            if (!initialResponse.ok) {
              throw new Error(`HTTP error! status: ${initialResponse.status}`);
            }
            
            // Get initial data
            const initialData = await initialResponse.json();
            
            // Use our polling mechanism to check status until complete
            const pollingFn = createVideoPolling('auto', requestId, updateProgress);
            const data = await pollingFn(initialData);
            
            // Once polling is complete, handle the response like any other
            if (data.status === 'completed') {
              // Update user message status
              setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, status: 'sent' } : msg
              ));
              
              // For comprehensive video response, include both visual and audio analysis
              let botContent = '';
              if (data.has_audio) {
                const audioTranscript = data.audio_transcript || '';
                const audioAnalysis = data.audio_analysis || '';
                const visualAnalysis = data.visual_analysis || '';
                
                botContent = `## Video Analysis\n\n`;
                botContent += `### Visual Content\n${visualAnalysis}\n\n`;
                
                if (audioTranscript) {
                  botContent += `### Audio Transcript\n"${audioTranscript}"\n\n`;
                }
                
                if (audioAnalysis) {
                  botContent += `### Audio Analysis\n${audioAnalysis}`;
                }
              } else {
                // Handle case with no audio
                botContent = data.visual_analysis || 
                            data.description || 
                            data.error || 
                            'Sorry, I could not analyze this video.';
                
                if (data.audio_error) {
                  botContent += `\n\n**Note on audio**: ${data.audio_error}`;
                }
              }
              
              // Add bot response
              const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'text',
                content: botContent,
                sender: 'bot',
                timestamp: new Date(),
              };
              
              setMessages(prev => [...prev, botMessage]);
              setIsLoading(false);
              return; // Exit early since we've handled the video response
            } else {
              throw new Error("Video processing failed");
            }
          } else {
            // Regular file upload processing for non-video files
          response = await apiFetch(endpoint, {
            method: 'POST',
            body: formData,
            signal
          });
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('Request was aborted');
          }
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
      
      // For debugging image analysis issues
      if (type === 'image') {
        console.log('Image analysis response details:', {
          hasResult: !!data.result,
          resultValue: data.result,
          responseKeys: Object.keys(data),
          fullResponseData: data
        });
      }
      
      // Update user message status
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'sent' } : msg
      ));
      
      // Add the bot's response
      let botContent = '';
      
      if (type === 'text') {
        botContent = data.response || 'Sorry, I could not generate a response.';
      } else if (type === 'image') {
        // Check for different response structures and common error patterns
        if (data.result) {
          botContent = data.result;
        } else if (data.error) {
          botContent = `Sorry, I could not analyze this image. Error: ${data.error}`;
        } else if (data.message) {
          botContent = `Sorry, I could not analyze this image. Message: ${data.message}`;
        } else if (typeof data === 'object' && Object.keys(data).length === 0) {
          botContent = 'Sorry, I received an empty response from the image analysis service.';
        } else {
          // For unexpected response formats
          console.error('Unexpected image analysis response format:', data);
          botContent = 'Sorry, I could not analyze this image. The response format was unexpected.';
        }
      } else if (type === 'audio') {
        botContent = data.transcription || 'Sorry, I could not transcribe this audio.';
      }

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: botContent,
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

  // Add a utility function for retrying failed requests
  const retryRequest = async (fn: () => Promise<any>, maxRetries = 3, delay = 2000): Promise<any> => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);
        lastError = error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  };

  // Handle audio upload specifically
  const handleAudioUpload = async (file: File, mediaUrl: string): Promise<void> => {
    const tempMessageId = Date.now().toString();
    
    // Create a message for the audio upload
    const audioMessage: Message = {
      id: tempMessageId,
      type: 'audio',
      content: 'Processing audio...',
      sender: 'user',
      timestamp: new Date(),
      mediaUrl: mediaUrl,
      status: 'sending'
    };
    
    setMessages(prev => [...prev, audioMessage]);
    
    // Create FormData for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', targetLanguage);
    
    // Log upload details
    console.log('Audio upload details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      language: targetLanguage
    });
    
    // Update message to show we're uploading
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessageId ? { 
        ...msg, 
        content: 'Uploading audio...',
        status: 'sending' 
      } : msg
    ));
    
    // Handler for successful upload
    const handleSuccess = (responseText: string) => {
      console.log('Successfully processed audio');
      
      // Update user message
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId ? { 
          ...msg, 
          content: file.name || 'Audio recording',
          status: 'sent' 
        } : msg
      ));
      
      // Add bot response
      const botContent = responseText && responseText.trim() 
        ? responseText 
        : "I've processed your audio. What would you like to know about it?";
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: botContent,
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botMessage]);
    };
    
    // Handler for upload errors
    const handleError = (error: any) => {
      console.error('Audio upload error:', error);
      
      // Update user message with error
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId ? { 
          ...msg, 
          content: 'Audio upload failed',
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          retryFn: () => handleAudioUpload(file, mediaUrl)
        } : msg
      ));
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: `Failed to upload audio. ${error instanceof Error ? error.message : String(error)}. Try a shorter audio clip or different format.`,
        sender: 'bot',
        timestamp: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        retryFn: () => handleAudioUpload(file, mediaUrl)
      };
      
      setMessages(prev => [...prev, errorMessage]);
    };
    
    try {
      // Using apiFetch instead of XMLHttpRequest
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Update progress indicator
      let lastProgressUpdate = 0;
      const progressHandler = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          
          // Only update UI every 5% to avoid excessive renders
          if (percentComplete >= lastProgressUpdate + 5 || percentComplete === 100) {
            lastProgressUpdate = percentComplete;
            console.log(`Upload progress: ${percentComplete}%`);
            
            // Update message with progress
            if (percentComplete < 100) {
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId ? { 
                  ...msg, 
                  content: `Uploading audio... ${percentComplete}%`,
                  status: 'sending' 
                } : msg
              ));
            } else {
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId ? { 
                  ...msg, 
                  content: 'Processing audio...',
                  status: 'sending' 
                } : msg
              ));
            }
          }
        }
      };

      // Create a fetch implementation that supports progress
      const response = await apiFetch('/api/upload/audio', {
        method: 'POST',
        body: formData,
        signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      handleSuccess(responseText);
      
    } catch (error) {
      console.error('API Fetch Error:', error);
      handleError(error);
    } finally {
      setMediaPreview(null);
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
      
      // For video files, show the processing options and don't create a message yet
      if ((type as 'image' | 'video' | 'audio') === 'video') {
        setPendingVideoUpload(file);
        setShowVideoOptions(true);
        return; // Exit early, we'll handle this after selecting options
      }
      
      // For audio files, use the specialized handler
      if ((type as 'image' | 'video' | 'audio') === 'audio') {
        await handleAudioUpload(file, mediaUrl);
        return;
      }
      
      // For other file types, proceed as normal
      const tempMessageId = Date.now().toString();
      
      // Send the media to the backend - handleSendMessage will create the message
      console.log('Sending media to backend:', { type, fileName: file.name });
      
      // Only handle the message for non-video types
      // We'll handle videos separately in processVideoWithOption
      await handleSendMessage(file, type, mediaUrl);
      
      // Clear the preview after successful upload
      setMediaPreview(null);
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
    let recognitionInstance: any = null;
    // Flag to track if we've already processed this recognition session
    let hasProcessedSpeech = false;
    
    const setupRecognition = () => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionInstance = new SpeechRecognition();
        
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.maxAlternatives = 1;
        recognitionInstance.lang = targetLanguage === 'en' ? 'en-US' : 
                        targetLanguage === 'sw' ? 'sw-KE' : 
                        targetLanguage === 'ha' ? 'ha' : 
                        targetLanguage === 'yo' ? 'yo' : 
                        targetLanguage === 'ig' ? 'ig' : 'en-US';
      
        // Clear all previous event listeners
        recognitionInstance.onresult = null;
        recognitionInstance.onerror = null;
        recognitionInstance.onend = null;
        
        // Accumulate speech while listening
        let accumulatedTranscript = '';
        let finalTranscriptTimeout: NodeJS.Timeout | null = null;
        
        recognitionInstance.onresult = (event: any) => {
          if (hasSentMessage || hasProcessedSpeech) return;
          
          // Get the current transcript
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          // Add any final transcript parts to our accumulated text
          if (finalTranscript) {
            accumulatedTranscript += ' ' + finalTranscript;
            accumulatedTranscript = accumulatedTranscript.trim();
          }
          
          // Show what we're hearing
          setSpeechText(accumulatedTranscript + (interimTranscript ? ' ' + interimTranscript : ''));
          
          // Reset the timeout each time we get more speech
          if (finalTranscriptTimeout) {
            clearTimeout(finalTranscriptTimeout);
          }
          
          // Set a timeout to send message after a pause in speech (5 seconds)
          finalTranscriptTimeout = setTimeout(() => {
            if (hasSentMessage || hasProcessedSpeech) return;
            
            if (accumulatedTranscript.trim()) {
              console.log('Sending message from pause timeout');
              hasProcessedSpeech = true;
              setHasSentMessage(true);
              
              // Stop recognition first to prevent additional events
              try {
                recognitionInstance.stop();
              } catch (e) {
                console.error('Error stopping recognition in timeout', e);
              }
              
              // Send message with a slight delay to ensure recognition has stopped
              setTimeout(() => {
                handleSendMessage(accumulatedTranscript.trim());
                cleanupRecognition();
              }, 100);
            }
          }, 5000); // 5 second pause to consider speech complete
        };
        
        recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
          // Only clean up for fatal errors, not no-speech
          if (event.error !== 'no-speech') {
            cleanupRecognition();
          }
        };
        
        // If recognition ends before we've sent the message, send what we have
        recognitionInstance.onend = () => {
          // Only process if we haven't already sent a message and haven't processed speech
          if (accumulatedTranscript.trim() && !hasSentMessage && !hasProcessedSpeech) {
            console.log('Sending message from onend event');
            hasProcessedSpeech = true;
            setHasSentMessage(true);
            
            // Use setTimeout to ensure we're outside the event handling context
            setTimeout(() => {
              handleSendMessage(accumulatedTranscript.trim());
              cleanupRecognition();
            }, 100);
          } else {
            // Just clean up without sending
            cleanupRecognition();
          }
        };
        
        speechRecognitionRef.current = recognitionInstance;
      }
    };
    
    // Setup clean function for recognition
    const cleanupRecognition = () => {
        setIsRecording(false);
      setShowListeningIndicator(false);
      setSpeechText('');
      
      // Clear any existing timeouts
      if (listeningTimeout) {
        clearTimeout(listeningTimeout);
        setListeningTimeout(null);
      }
      
      // Set a cooldown to prevent immediate restart
      if (!cooldownActive) {
        setCooldownActive(true);
        setTimeout(() => {
          setCooldownActive(false);
        }, 1000); // 1 second cooldown
      }
    };
    
    // Initial setup
    setupRecognition();
    
    // Cleanup on component unmount
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch (e) {
          console.error('Error stopping speech recognition', e);
        }
      }
      
      if (listeningTimeout) {
        clearTimeout(listeningTimeout);
      }
    };
  }, [targetLanguage, cooldownActive, hasSentMessage]);
  
  // Add back the stopListening function
  const stopListening = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping speech recognition', e);
      }
    }
    
    setIsRecording(false);
    setShowListeningIndicator(false);
    
    if (listeningTimeout) {
      clearTimeout(listeningTimeout);
      setListeningTimeout(null);
    }
  };
  
  // Toggle speech recognition
  const toggleSpeechRecognition = () => {
    if (!speechRecognitionRef.current) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }
    
    if (isRecording) {
      stopListening();
      // If stopping manually, send the message immediately if we have something
      if (speechText.trim() && !hasSentMessage) {
        console.log('Sending message from manual stop');
        setHasSentMessage(true);
        // Slight delay to ensure stopListening has completed
        setTimeout(() => {
          handleSendMessage(speechText.trim());
        }, 100);
      }
    } else {
      // Don't start if cooldown is active
      if (cooldownActive) {
        toast.error('Please wait a moment before using voice input again');
        return;
      }
      
      setSpeechText('');
      setHasSentMessage(false);
      setIsRecording(true);
      setShowListeningIndicator(true);
      
      try {
        // Start a new recognition session
        speechRecognitionRef.current.start();
        toast.success('Listening... Speak your question (will auto-send after 5s pause)');
        
        // Set a maximum listening time of 30 seconds
        if (listeningTimeout) {
          clearTimeout(listeningTimeout);
        }
        
        const timeout = setTimeout(() => {
          if (isRecording && !hasSentMessage) {
            console.log('Sending message from max timeout');
            if (speechText.trim()) {
              setHasSentMessage(true);
              stopListening();
              
              // Slight delay to ensure stopListening has completed
              setTimeout(() => {
                handleSendMessage(speechText.trim());
              }, 100);
            } else {
              stopListening();
              toast.error('No speech detected');
            }
          }
        }, 30000); // 30 second maximum listening time
        
        setListeningTimeout(timeout);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        stopListening();
        toast.error('Voice input error. Please try again.');
      }
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

  // Add new function to process video with selected option
  const processVideoWithOption = async (option: 'auto' | 'frames' | 'audio') => {
    if (!pendingVideoUpload) return;
    
    try {
      const file = pendingVideoUpload;
      const mediaUrl = URL.createObjectURL(file);
      
      // Set loading state to true
      setIsLoading(true);
      
      // Generate a unique ID for this processing request
      const requestId = Date.now().toString();
      
      // Add a temporary message to show the media is being processed
      const tempMessageId = Date.now().toString();
      const tempMessage: Message = {
        id: tempMessageId,
        type: 'video',
        content: `Processing video ${option === 'frames' ? '(visual frames only)' : 
                 option === 'audio' ? '(with audio analysis)' : 
                 '(comprehensive analysis)'}...`,
        sender: 'user',
        timestamp: new Date(),
        mediaUrl,
        status: 'sending'
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Update user message with processing status
      const updateProgress = (progress: string) => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessageId ? { 
            ...msg, 
            content: progress
          } : msg
        ));
      };
      
      // Create FormData and add processing option
      const formData = new FormData();
      formData.append('file', file);
      
      // Add parameters based on video processing type
      if (option === 'frames' || option === 'auto') {
        // For visual/comprehensive analysis, provide a query
        formData.append('query', 'Analyze this health-related video content');
      } else {
        // For audio processing, include language parameter
        formData.append('language', targetLanguage);
      }
      
      // Keep this for backward compatibility
      formData.append('processing_type', option);
      formData.append('request_id', requestId);
      
      // Determine endpoint based on the option
      const endpoint = option === 'frames' ? '/api/upload/video' : 
                     option === 'audio' ? '/api/upload/video/audio' : 
                     '/api/upload/video/comprehensive';
      
      console.log(`Sending video to endpoint: ${endpoint} with option: ${option}`);
      
      // For frames-only analysis, use direct fetch (faster)
      if (option === 'frames') {
        try {
          const response = await apiFetch(endpoint, {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          processVideoResponse(option, data, tempMessageId);
        } catch (error) {
          handleVideoError(error, tempMessageId);
        }
      } else {
        // For audio or comprehensive analysis, use a polling approach
        // First send the file for processing
        try {
          updateProgress(`Starting video ${option === 'audio' ? 'audio' : 'comprehensive'} analysis...`);
          
          // Initial request to start processing
          const initResponse = await apiFetch(endpoint, {
            method: 'POST',
            body: formData,
          });
          
          if (!initResponse.ok) {
            throw new Error(`HTTP error! status: ${initResponse.status}`);
          }
          
          const initData = await initResponse.json();
          
          // If we got a result immediately, process it
          if (initData.status === 'completed') {
            processVideoResponse(option, initData, tempMessageId);
            return;
          }
          
          // If processing is happening in the background
          if (initData.status === 'processing' || initData.job_id) {
            const jobId = initData.job_id || requestId;
            let attempts = 0;
            const maxAttempts = 30; // Try for up to 5 minutes (10 seconds * 30)
            
            // Start polling for results
            const pollForResults = async () => {
              if (attempts >= maxAttempts) {
                throw new Error("Processing timeout - took too long to complete");
              }
              
              attempts++;
              updateProgress(`Processing video... (${attempts}/${maxAttempts})`);
              
              try {
                const pollResponse = await apiFetch(`/api/job_status/${jobId}`);
                
                if (!pollResponse.ok) {
                  throw new Error(`HTTP error! status: ${pollResponse.status}`);
                }
                
                const pollData = await pollResponse.json();
                
                if (pollData.status === 'completed') {
                  processVideoResponse(option, pollData, tempMessageId);
                  return;
                } else if (pollData.status === 'failed') {
                  throw new Error(pollData.error || "Processing failed");
                } else {
                  // Still processing, wait and try again
                  setTimeout(pollForResults, 10000); // Poll every 10 seconds
                }
              } catch (error) {
                console.error("Error polling for results:", error);
                handleVideoError(error, tempMessageId);
              }
            };
            
            // Start polling
            setTimeout(pollForResults, 5000); // Start polling after 5 seconds
          } else {
            // Handle unexpected response
            processVideoResponse(option, initData, tempMessageId);
          }
        } catch (error) {
          handleVideoError(error, tempMessageId);
        }
      }
    } finally {
      // Don't clear loading state here - it will be cleared when processing completes
    }
  };

  // Function to handle processing the video response
  const processVideoResponse = (option: 'auto' | 'frames' | 'audio', data: any, tempMessageId: string) => {
    try {
      if (!data) {
        throw new Error('No response data received');
      }
      
      // Check if this is a pending status message
      if (data.status === 'pending') {
        // Update the message to indicate still processing
        setMessages(prev => prev.map(msg => {
          if (msg.id === tempMessageId) {
            return {
              ...msg,
              content: data.message,
              status: 'pending' as 'pending' // Use type assertion to ensure correct type
            };
          }
          return msg;
        }));
        
        // Don't add a bot response yet - it will appear when processing is complete
        return;
      }
      
      console.log('Received response:', data);
      
      // Update user message status
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId ? { ...msg, status: 'sent' } : msg
      ));
      
      // Process response based on the option
      let botContent = '';
      
      if (option === 'frames') {
        botContent = data.result || data.description || data.visual_analysis || 'Sorry, I could not analyze this video.';
      } else if (option === 'audio') {
        if (data.transcript || data.result) {
          botContent = `
## Audio Analysis

### Transcript
"${data.transcript || data.result || ''}"

### Analysis
${data.analysis || 'No analysis available.'}
          `;
        } else {
          botContent = data.error || 'Sorry, I could not analyze the audio in this video.';
        }
      } else {
        // Comprehensive option
        if (data.has_audio) {
          const audioTranscript = data.audio_transcript || '';
          const audioAnalysis = data.audio_analysis || '';
          const visualAnalysis = data.visual_analysis || data.result || '';
          
          botContent = `## Video Analysis\n\n`;
          botContent += `### Visual Content\n${visualAnalysis}\n\n`;
          
          if (audioTranscript) {
            botContent += `### Audio Transcript\n"${audioTranscript}"\n\n`;
          }
          
          if (audioAnalysis) {
            botContent += `### Audio Analysis\n${audioAnalysis}`;
          }
        } else {
          botContent = data.result || data.visual_analysis || 
                     data.description || 
                     data.error || 
                     'Sorry, I could not analyze this video.';
          
          if (data.audio_error) {
            botContent += `\n\n**Note on audio**: ${data.audio_error}`;
          }
        }
      }
      
      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: botContent,
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error processing video response:', error);
      handleVideoError(error, tempMessageId);
    } finally {
      // Clean up
      setIsLoading(false);
      setMediaPreview(null);
      setPendingVideoUpload(null);
      setVideoProcessingType('auto');
    }
  };

  // Function to handle video processing errors
  const handleVideoError = (error: any, tempMessageId: string) => {
    console.error('Error processing video:', error);
    
    // Format the error message
    const formattedError = formatErrorMessage(error);
    
    // Update the user message to show error
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessageId ? { 
        ...msg, 
        status: 'error',
        error: formattedError.message 
      } : msg
    ));
    
    // Add error message to chat
    const errorMessage: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: formattedError.status === 429 
        ? 'The service is currently busy. Please try again in a moment.'
        : 'Sorry, I encountered an error processing your video. Please try again.',
      sender: 'bot',
      timestamp: new Date(),
      status: 'error',
      error: formattedError.message
    };
    
    setMessages(prev => [...prev, errorMessage]);
    
    // Clean up
    setIsLoading(false);
    setMediaPreview(null);
    setPendingVideoUpload(null);
    setVideoProcessingType('auto');
  };

  // Add the Video Options Modal component
  const VideoOptionsModal = () => {
    if (!showVideoOptions) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold text-purple-700 mb-2">How would you like to analyze this video?</h2>
          <p className="text-sm text-gray-600 mb-4">Choose the most appropriate option for better results:</p>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                setVideoProcessingType('auto');
                setShowVideoOptions(false); // Hide modal immediately
                processVideoWithOption('auto');
              }}
              className="w-full p-4 border border-purple-200 rounded-lg flex items-center space-x-3 hover:bg-purple-50 transition-colors"
            >
              <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                <FiVideo className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-medium">Comprehensive Analysis</div>
                <div className="text-sm text-gray-500">Analyze both visual content and audio if available (default)</div>
              </div>
            </button>
            
            <button
              onClick={() => {
                setVideoProcessingType('frames');
                setShowVideoOptions(false); // Hide modal immediately
                processVideoWithOption('frames');
              }}
              className="w-full p-4 border border-purple-200 rounded-lg flex items-center space-x-3 hover:bg-purple-50 transition-colors"
            >
              <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                <FiImage className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-medium">Visual Analysis Only</div>
                <div className="text-sm text-gray-500">Best for videos with background music or no important speech</div>
              </div>
            </button>
            
            <button
              onClick={() => {
                setVideoProcessingType('audio');
                setShowVideoOptions(false); // Hide modal immediately
                processVideoWithOption('audio');
              }}
              className="w-full p-4 border border-purple-200 rounded-lg flex items-center space-x-3 hover:bg-purple-50 transition-colors"
            >
              <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                <FiHeadphones className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-medium">Audio Analysis</div>
                <div className="text-sm text-gray-500">Focus on speech in the video (educational content, explanations)</div>
              </div>
            </button>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                setShowVideoOptions(false);
                setPendingVideoUpload(null);
                setMediaPreview(null);
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    clearChatHistory,
    openSettings: () => setShowSettings(true)
  }));

  // Add the polling function
  const createVideoPolling = (
    option: 'auto' | 'visual' | 'audio' | 'comprehensive',
    requestId: string,
    updateProgress?: (progress: string) => void
  ) => {
    return async (initialData: any) => {
      try {
        if (updateProgress) {
          updateProgress(`Processing video (0%)...`);
        }
        
        // Initialize variables for polling
        let status = 'processing';
        let attempts = 0;
        const maxAttempts = 60; // Increase from 30 to 60 (up to 10 minutes total with 10s interval)
        const pollingInterval = 10000; // 10 seconds between checks
        
        // If we already have a completed result, return it immediately
        if (initialData.status === 'completed') {
          if (updateProgress) {
            updateProgress(`Video processing complete (100%)`);
          }
          return initialData;
        }
        
        // Get the job ID from the initial response
        const jobId = initialData.job_id || requestId;
        
        // Poll until completion or max attempts reached
        while (status === 'processing' && attempts < maxAttempts) {
          attempts++;
          
          // Calculate a more gradual progress percentage based on attempts
          // Use a logarithmic scale to show faster initial progress and slower later progress
          const progressPercent = Math.min(Math.floor((Math.log(attempts + 1) / Math.log(maxAttempts + 1)) * 100), 95);
          
          if (updateProgress) {
            updateProgress(`Processing video (${progressPercent}%)...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
          
          // Check status
          const statusResponse = await apiFetch(`/api/job-status/${jobId}`);
          
          if (!statusResponse.ok) {
            throw new Error(`Failed to get job status: ${statusResponse.statusText}`);
          }
          
          const statusData = await statusResponse.json();
          
          // If job completed or failed, update status
          if (statusData.status === 'completed') {
            status = 'completed';
            if (updateProgress) {
              updateProgress(`Video processing complete (100%)`);
            }
            return statusData.result;
          } else if (statusData.status === 'failed') {
            status = 'failed';
            throw new Error(statusData.error || 'Video processing failed');
          } else if (statusData.status === 'pending') {
            // Continue polling for 'pending' status
            status = 'processing';
          }
        }
        
        // If we reach here, we've hit the maximum attempts
        if (status === 'processing') {
          if (updateProgress) {
            updateProgress(`Video still processing... The server will continue working, but results will be delivered when ready.`);
          }
          // Instead of throwing an error, return a special status that indicates we're still processing
          return {
            status: 'pending',
            message: 'The video is still being processed. The results will appear when processing completes. You can continue using the chat in the meantime.'
          };
        }
        
        throw new Error('Video processing failed with an unknown error');
      } catch (error) {
        console.error('Error polling video job:', error);
        throw error;
      }
    };
  };

  // Add a visible indicator of what's being recognized
  const ListeningIndicator = () => {
    return (
      <div className="w-full border-2 border-purple-300 rounded-full py-2 px-4 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="text-purple-600 flex items-center">
            <span className="text-sm">Listening</span>
            <span className="ml-1 flex">
              <span className="animate-bounce mx-0.5 delay-0">.</span>
              <span className="animate-bounce mx-0.5 delay-100">.</span>
              <span className="animate-bounce mx-0.5 delay-200">.</span>
            </span>
          </div>
          {speechText && (
            <div className="text-gray-700 dark:text-gray-300 text-sm truncate max-w-[70%]">
              {speechText}
            </div>
          )}
          <div className="text-xs text-gray-500">
            Waiting for you to finish speaking...
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`flex flex-col h-full w-full ${getFontSizeClass()} ${userPreferences.theme === 'dark' ? 'dark:bg-gray-800 dark:text-white' : 'bg-gradient-to-br from-purple-50 via-white to-pink-50'}`}>
        {/* Network status banner */}
        {renderNetworkStatusBanner()}
        
        {/* Chat message area - Add padding at the bottom to account for fixed input area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-24 space-y-3 sm:space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`
                flex items-start
                ${message.sender === 'user' ? 'justify-end' : 'justify-start'}
                ${message.mediaUrl ? 'media-message' : ''}
              `}
              >
                {/* Message content */}
              <div className={`
                max-w-[80%] rounded-lg p-3 
                ${message.sender === 'user' 
                  ? 'bg-purple-600 text-white ml-4 rounded-tr-none'
                  : 'bg-white border border-gray-200 mr-4 rounded-tl-none'}
                ${userPreferences.theme === 'dark' && message.sender === 'bot' ? 'bg-gray-700 border-gray-600 text-white' : ''}
                relative group
              `}>
                {/* Message content based on type */}
                {message.type === 'text' ? (
                    <FormattedResponse 
                      content={message.content} 
                      typingSpeed={userPreferences.typingSpeed}
                      enableAnimations={userPreferences.enableAnimations}
                    />
                ) : message.type === 'image' && message.mediaUrl ? (
                  <div>
                      <img
                        src={message.mediaUrl}
                        alt="Uploaded"
                      className="max-w-full h-auto rounded" 
                      style={{ maxHeight: '300px' }}
                    />
                    {message.content && message.content !== message.mediaUrl && (
                      <div className="mt-2">
                        <FormattedResponse 
                          content={message.content} 
                          typingSpeed={userPreferences.typingSpeed} 
                          enableAnimations={userPreferences.enableAnimations}
                      />
                    </div>
                  )}
                  </div>
                ) : message.type === 'video' && message.mediaUrl ? (
                  <div>
                      <video
                        src={message.mediaUrl}
                        controls
                      className="max-w-full h-auto rounded" 
                      style={{ maxHeight: '300px' }}
                      />
                    {message.content && message.content !== message.mediaUrl && (
                    <div className="mt-2">
                        <FormattedResponse 
                          content={message.content} 
                          typingSpeed={userPreferences.typingSpeed} 
                          enableAnimations={userPreferences.enableAnimations}
                      />
                    </div>
                  )}
                </div>
                ) : message.type === 'audio' && message.mediaUrl ? (
                  <div>
                    <AudioResponse 
                      text={message.content}
                      language={targetLanguage}
                    />
                  </div>
                ) : (
                  <div className="text-sm">{message.content}</div>
                )}
                
                {/* Message status indicator */}
                {getMessageStatus(message)}
                
                {/* Message actions for bot messages (copy, share, etc.) */}
                <MessageActions message={message} />
              </div>
            </div>
          ))}
          
          {/* Empty div for scrolling to bottom */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Media preview */}
        {mediaPreview && (
          <div className="px-4 pt-2 fixed bottom-[70px] left-0 right-0 z-10 bg-white/90 border-t border-gray-200">
            <div className="relative inline-block">
              <img 
                src={mediaPreview} 
                alt="Media preview" 
                className="h-16 w-auto rounded border border-gray-300"
              />
              <button
                onClick={() => setMediaPreview(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                aria-label="Remove media preview"
              >
                <FiX className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        
        {/* Input area - Fixed at the bottom */}
        <div className="p-2 sm:p-3 border-t-2 border-gray-300 bg-white dark:bg-gray-900 fixed bottom-0 left-0 right-0 z-10 shadow-lg">
          <div className="flex flex-col sm:flex-row">
            {/* Media controls for mobile - show in a row above the input on small screens */}
            <div className="flex mb-2 justify-center space-x-2 sm:hidden">
              {userPreferences.enableVoiceInput && (
                <button
                  onClick={toggleSpeechRecognition}
                  className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
                  aria-label={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                </button>
              )}
              
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'image')}
                  accept="image/*"
                icon={<FiImage className="w-5 h-5" />}
                  buttonAriaLabel="Upload image"
                />
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'video')}
                  accept="video/*"
                icon={<FiVideo className="w-5 h-5" />}
                  buttonAriaLabel="Upload video"
                />
                <MediaUpload
                  onFileSelect={(file) => handleMediaUpload(file, 'audio')}
                  accept="audio/*"
                icon={<FiHeadphones className="w-5 h-5" />}
                buttonAriaLabel="Upload audio recording"
              />
              
              {/* Settings and Clear History buttons removed from mobile */}
            </div>
            
            <div className="flex items-center w-full">
              <div className="flex-1 relative">
                {showListeningIndicator ? (
                  <ListeningIndicator />
                ) : (
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your health-related question..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (inputText.trim()) {
                          handleSendMessage(inputText.trim());
                          setInputText('');
                        }
                      }
                    }}
                    className="w-full border-2 border-purple-300 rounded-full py-2 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 resize-none dark:bg-gray-800 dark:border-gray-700 dark:text-white shadow-inner"
                    rows={1}
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                )}
                {!showListeningIndicator && (
            <button
              onClick={() => {
                if (inputText.trim()) {
                        handleSendMessage(inputText.trim());
                  setInputText('');
                }
              }}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-purple-600 p-1 rounded-full hover:bg-purple-50 dark:hover:bg-gray-700"
              aria-label="Send message"
            >
              <FiSend className="w-5 h-5" />
            </button>
                )}
          </div>
          
              {/* Media controls for desktop - show to the right of the input on larger screens */}
              <div className="hidden sm:flex ml-2 space-x-2">
                {userPreferences.enableVoiceInput && (
                  <button
                    onClick={toggleSpeechRecognition}
                    className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
                    aria-label={isRecording ? "Stop recording" : "Start voice input"}
                  >
                    {isRecording ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                  </button>
                )}
                
                <MediaUpload 
                  onFileSelect={(file) => handleMediaUpload(file, 'image')} 
                  accept="image/*"
                  icon={<FiImage className="w-5 h-5" />}
                  buttonAriaLabel="Upload image"
                />
                <MediaUpload 
                  onFileSelect={(file) => handleMediaUpload(file, 'video')} 
                  accept="video/*"
                  icon={<FiVideo className="w-5 h-5" />}
                  buttonAriaLabel="Upload video"
                />
                <MediaUpload 
                  onFileSelect={(file) => handleMediaUpload(file, 'audio')} 
                  accept="audio/*"
                  icon={<FiHeadphones className="w-5 h-5" />}
                  buttonAriaLabel="Upload audio recording"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Settings modal */}
      <SettingsModal />
      
      {/* Video options modal */}
      <VideoOptionsModal />
    </>
  );
});

export default ChatInterface; 