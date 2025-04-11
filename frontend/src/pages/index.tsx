import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiMessageCircle, FiChevronRight, FiHeart, FiShield, FiGlobe, FiMapPin, FiHelpCircle, FiLock, FiArrowRight, FiHome, FiAlertCircle, FiBookOpen, FiMenu } from 'react-icons/fi';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const languages = {
    en: 'English',
    sw: 'Swahili',
    ha: 'Hausa',
    yo: 'Yoruba',
    ig: 'Igbo'
  };

  const startChat = () => {
    router.push('/chat');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Mobile Menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center">
            <div className="bg-purple-100 p-1.5 rounded-full">
              <FiMessageCircle className="h-5 w-5 text-purple-600" />
            </div>
            <span className="ml-2 text-lg font-bold text-gray-900">Afya Siri</span>
          </div>
          <button className="text-gray-500 hover:text-purple-600 transition-colors">
            <FiMenu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-16 lg:pt-0">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center lg:text-left"
              >
                <h1 className="text-3xl sm:text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">Afya Siri</span>
                  <span className="block text-purple-600">Your Private Health Companion</span>
                </h1>
                <p className="mt-3 text-sm sm:text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Get accurate, free sexual health information and education in your preferred language. Ask questions anonymously and find nearby services.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="mt-5 sm:mt-8 flex justify-center lg:justify-start"
              >
                <div className="rounded-md shadow">
                  <Link 
                    href="/chat" 
                    className="w-full flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 md:py-4 md:text-lg md:px-8 transform transition-all duration-200 hover:scale-105"
                  >
                    <FiMessageCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Start Chatting
                    <FiChevronRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                </div>
              </motion.div>
            </main>
          </div>
        </div>
      </div>

      {/* Problem & Solution Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Problem Column */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-lg"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">The Challenge</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-red-100 p-1.5 sm:p-2 rounded-full">
                    <FiAlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Misinformation</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Widespread myths and incorrect information about sexual health.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-red-100 p-1.5 sm:p-2 rounded-full">
                    <FiShield className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Fear of Judgment</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Embarrassment preventing access to accurate information.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Solution Column */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-lg"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Our Solution</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-green-100 p-1.5 sm:p-2 rounded-full">
                    <FiBookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Easy-to-Understand Information</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Clear, accurate answers to your health questions.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-green-100 p-1.5 sm:p-2 rounded-full">
                    <FiLock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Anonymous Interaction</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Ask questions without fear of judgment.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-green-100 p-1.5 sm:p-2 rounded-full">
                    <FiGlobe className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Local Language Support</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Get information in your preferred language.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="bg-green-100 p-1.5 sm:p-2 rounded-full">
                    <FiMapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Nearby Services</h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-500">Find local healthcare providers when needed.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Call to Action */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
      >
        <div className="bg-purple-600 rounded-2xl shadow-xl overflow-hidden p-4 sm:p-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Ready to Get Started?</h2>
          <p className="text-purple-100 mb-4 sm:mb-6 max-w-2xl mx-auto text-sm sm:text-base">
            Join thousands of users who have found accurate, free sexual health information and education through Afya Siri.
          </p>
          <div className="flex justify-center">
            <Link 
              href="/chat" 
              className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 border border-transparent text-sm sm:text-base font-medium rounded-md text-purple-600 bg-white hover:bg-purple-50 md:py-4 md:text-lg md:px-10 transform transition-all duration-200 hover:scale-105"
            >
              Start Chat
              <FiMessageCircle className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              <FiChevronRight className="ml-1 h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 