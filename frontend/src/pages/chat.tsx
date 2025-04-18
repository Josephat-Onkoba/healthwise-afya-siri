import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiGlobe, FiHome, FiMessageCircle, FiLock, FiTrash2, FiSettings
} from 'react-icons/fi';
import ChatInterface from '../components/ChatInterface';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Chat() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const chatInterfaceRef = useRef<any>(null);

  const languages = {
    en: 'English',
    sw: 'Swahili',
    ha: 'Hausa',
    yo: 'Yoruba',
    ig: 'Igbo'
  };
  
  // Function to clear chat history from the navigation bar
  const handleClearHistory = () => {
    if (chatInterfaceRef.current && chatInterfaceRef.current.clearChatHistory) {
      chatInterfaceRef.current.clearChatHistory();
    } else {
      toast.error("Couldn't clear chat history");
    }
  };

  // Function to open settings modal
  const handleOpenSettings = () => {
    if (chatInterfaceRef.current && chatInterfaceRef.current.openSettings) {
      chatInterfaceRef.current.openSettings();
    } else {
      toast.error("Couldn't open settings");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <Head>
        <title>Chat with Afya Siri | Your Private Health Companion</title>
        <meta name="description" content="Get accurate, judgment-free sexual health information in your preferred language. Ask questions anonymously and find nearby services." />
      </Head>

      {/* Chat Header - Make it fixed at the top */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-md p-3 sm:p-4 flex items-center justify-between fixed top-0 left-0 right-0 z-10">
        <div className="flex items-center">
          <Link href="/" className="mr-2 sm:mr-3 text-white hover:text-purple-100 transition-colors">
            <FiHome className="h-5 w-5 sm:h-6 sm:w-6" />
          </Link>
          <div className="flex items-center">
            <div className="bg-purple-100 p-1.5 sm:p-2 rounded-full">
              <FiMessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="ml-3 sm:ml-4">
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">Afya Siri</h1>
              <p className="text-xs sm:text-sm text-purple-100 mt-0.5">Your Private Health Companion</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden sm:flex items-center">
            <FiLock className="h-3 w-3 sm:h-4 sm:w-4 text-purple-100 mr-1" />
            <span className="text-xs text-purple-100">Anonymous</span>
          </div>
          
          {/* Settings button */}
          <button 
            onClick={handleOpenSettings}
            className="p-2 rounded-full hover:bg-purple-500 text-white transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <FiSettings className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          
          {/* Clear history button */}
          <button 
            onClick={handleClearHistory}
            className="p-2 rounded-full hover:bg-purple-500 text-white transition-colors"
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            <FiTrash2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="text-xs sm:text-sm border border-purple-400 bg-purple-500 text-white rounded-md focus:ring-purple-300 focus:border-purple-300 py-1"
          >
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add spacing to account for fixed header */}
      <div className="pt-16 sm:pt-20"></div>

      {/* Full height chat interface */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface 
          targetLanguage={selectedLanguage} 
          ref={chatInterfaceRef}
        />
      </div>
    </div>
  );
} 