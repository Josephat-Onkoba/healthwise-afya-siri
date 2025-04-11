import google.generativeai as genai
from deep_translator import GoogleTranslator
import os
import numpy as np
from typing import Dict, List, Optional, Union, Any
from PIL import Image
import io
import base64
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
from .gemini_service import GeminiService
from ..utils import convert_audio_to_wav
import logging
from moviepy.editor import VideoFileClip
import cv2

# Initialize Gemini service
gemini_service = GeminiService()

# Supported languages
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'sw': 'Swahili',
    'ha': 'Hausa',
    'yo': 'Yoruba',
    'ig': 'Igbo'
}

logger = logging.getLogger(__name__)

def translate_text(text: str, target_language: str) -> str:
    """Translate text to target language."""
    if target_language == 'en':
        return text
    
    translator = GoogleTranslator(source='en', target=target_language)
    return translator.translate(text)

def process_text_query(text: str, target_language: str) -> dict:
    """Process text query using Gemini AI and translate response."""
    try:
        # Generate response using Gemini
        response = gemini_service.generate_text_response(
            message=text,
            language=target_language
        )
        
        return {
            'response': response,
            'sources': []
        }
    except Exception as e:
        print(f"Error processing text query: {str(e)}")
        return {
            'response': "I'm sorry, I couldn't process your query. Please try again.",
            'sources': []
        }

async def process_image(image_path: str, target_language: str = "en") -> str:
    """
    Process an image and generate a description.
    
    Args:
        image_path: Path to the image file
        target_language: Target language for description
        
    Returns:
        Image description
    """
    try:
        # Load the image
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
            
        # Create a prompt for image analysis
        prompt = f"""Analyze this image in the context of sexual and reproductive health. Consider:
        1. Health-related aspects and concerns
        2. Educational value for understanding sexual and reproductive health
        3. Signs or symptoms that might indicate health issues
        4. Appropriate healthcare resources and recommendations
        
        Provide a description that:
        - Uses appropriate medical terminology
        - Maintains a professional, educational tone
        - Focuses on health information
        - Suggests appropriate healthcare resources
        - Uses clear and accessible language
        
        Please describe what you see in the image, focusing on health-related aspects."""
        
        # Use the Gemini service to analyze the image
        gemini_service = GeminiService()
        response = await gemini_service.analyze_image(image_data)
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return "An error occurred while processing your image. Please try again."

async def process_video(video_path: str, target_language: str = "en") -> str:
    """
    Process a video file and generate a description.
    
    Args:
        video_path: Path to the video file
        target_language: Target language for description
        
    Returns:
        Video description
    """
    try:
        # Check if file exists
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return "Video file could not be found. Please try uploading again."
            
        # Create a prompt for video analysis
        prompt = f"""Analyze this video frame in the context of sexual and reproductive health. Consider:
        1. Health-related aspects and concerns
        2. Educational value for understanding sexual and reproductive health
        3. Signs or symptoms that might indicate health issues
        4. Appropriate healthcare resources and recommendations
        
        Provide a description that:
        - Uses appropriate medical terminology
        - Maintains a professional, educational tone
        - Focuses on health information
        - Suggests appropriate healthcare resources
        - Uses clear and accessible language
        
        Please describe what you see in the image, focusing on health-related aspects."""
        
        # Initialize Gemini service outside of the loop
        gemini_service = GeminiService()
        
        # Use OpenCV to read frames from the video
        try:
            # Create a video capture object
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                logger.error(f"Could not open video file: {video_path}")
                return "Could not open the video file. The format may be unsupported."
            
            # Get video properties
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            duration = frame_count / fps if fps > 0 else 0
            
            logger.info(f"Video info: {frame_count} frames, {fps} fps, {duration:.2f} seconds")
            
            # Check if we could read the video
            if frame_count <= 0:
                logger.error("No frames found in video")
                return "This video appears to be empty or corrupted. Please try a different file."
            
            # Extract frames at regular intervals (up to 5 frames)
            max_frames = min(5, frame_count)
            frame_indices = [int(i * frame_count / max_frames) for i in range(max_frames)]
            
            # Analyze frames
            analysis_results = []
            
            for idx, frame_idx in enumerate(frame_indices):
                # Set position to the selected frame
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                
                if not ret:
                    logger.warning(f"Failed to read frame at index {frame_idx}")
                    continue
                
                # Convert BGR to RGB for PIL
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                # Save frame to temporary file
                temp_frame_path = f"{video_path}_frame_{idx}.jpg"
                pil_image.save(temp_frame_path)
                
                # Read image as bytes
                with open(temp_frame_path, "rb") as f:
                    frame_data = f.read()
                
                # Clean up temporary file
                try:
                    os.remove(temp_frame_path)
                except:
                    pass
                
                # Analyze frame
                try:
                    # Create a frame-specific prompt
                    frame_prompt = f"Frame {idx+1}/{max_frames} at {frame_idx/fps:.2f} seconds: {prompt}"
                    
                    # Initialize gemini_service inside the loop for each frame
                    local_gemini_service = GeminiService()
                    
                    # Analyze the frame
                    frame_analysis = await local_gemini_service.analyze_image(frame_data)
                    
                    if frame_analysis:
                        analysis_results.append(f"Frame {idx+1} Analysis (at {frame_idx/fps:.2f}s):\n{frame_analysis}")
                except Exception as frame_error:
                    logger.error(f"Error analyzing frame {idx}: {str(frame_error)}")
            
            # Release the video capture
            cap.release()
            
            # If we have some frame analysis results
            if analysis_results:
                combined_analysis = "\n\n".join(analysis_results)
                
                # Generate a summary
                summary_prompt = f"""I've analyzed {len(analysis_results)} frames from a video. Here are my observations:

{combined_analysis}

Please provide a comprehensive summary that:
1. Identifies the main health-related themes or topics
2. Highlights any educational content about sexual and reproductive health
3. Notes any potential health concerns or symptoms shown
4. Provides context for understanding the health implications
5. Maintains a professional, clinical tone throughout

The summary should be well-structured with:
- A brief introduction
- Key health observations and educational points
- Any recommendations related to sexual and reproductive health
- A conclusion that emphasizes the importance of professional healthcare consultation when needed"""
                
                try:
                    # Create a local instance of GeminiService for summary generation
                    summary_service = GeminiService()
                    summary = await summary_service.generate_text_response(summary_prompt, target_language)
                    
                    if summary:
                        return f"Video Analysis Summary:\n\n{summary}"
                    else:
                        return "Unfortunately, I couldn't generate a meaningful summary for this video."
                except Exception as summary_error:
                    logger.error(f"Error generating summary: {str(summary_error)}")
                    return f"Video Analysis Results:\n\n{combined_analysis}"
            else:
                return "I couldn't extract meaningful information from the video frames. The video may be too dark, blurry, or not contain relevant health information."
                
        except Exception as video_error:
            logger.error(f"Error processing video: {str(video_error)}")
            return f"Error analyzing video: {str(video_error)}"
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return f"An error occurred while processing your video: {str(e)}"

async def process_voice(audio_path: str, target_language: str = "en") -> str:
    """
    Process a voice recording and convert it to text.
    
    Args:
        audio_path: Path to the audio file
        target_language: Target language for transcription
        
    Returns:
        Transcribed text
    """
    try:
        # Convert audio to WAV format if needed
        wav_path = await convert_audio_to_wav(audio_path)
        
        recognizer = sr.Recognizer()
        
        # Load the audio file
        with sr.AudioFile(wav_path) as source:
            # Adjust for ambient noise
            recognizer.adjust_for_ambient_noise(source)
            # Record the audio
            audio = recognizer.record(source)
            
        # Perform the transcription
        text = recognizer.recognize_google(audio, language=target_language)
        
        # Add context about Afya Siri's role
        context = f"""This is a voice message from a user seeking information about sexual and reproductive health. 
        As Afya Siri, a professional sexual and reproductive health educator, please provide a response that:
        1. Acknowledges the user's question or concern
        2. Provides accurate, evidence-based information
        3. Addresses any myths or misconceptions
        4. Offers practical recommendations
        5. Encourages consultation with healthcare providers
        6. Uses appropriate terminology and examples
        
        User's message: {text}"""
        
        return context
        
    except sr.UnknownValueError:
        logger.error("Speech recognition could not understand audio")
        return "I couldn't understand the audio. Please try speaking more clearly."
    except sr.RequestError as e:
        logger.error(f"Could not request results from speech recognition service: {str(e)}")
        return "Sorry, there was an error processing your voice message. Please try again."
    except Exception as e:
        logger.error(f"Error processing voice: {str(e)}")
        return "An error occurred while processing your voice message. Please try again."

def get_health_info(query: str, language: str = 'en') -> str:
    """Get health information from knowledge base."""
    try:
        # This is a placeholder for now
        # In a real implementation, this would query a knowledge base
        return f"Information about: {query}"
    except Exception as e:
        print(f"Error getting health info: {str(e)}")
        return "" 