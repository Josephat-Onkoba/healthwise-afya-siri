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

def process_image(image_path: str, target_language: str = "en") -> str:
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
        response = gemini_service.analyze_image(image_data)
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return "An error occurred while processing your image. Please try again."

def extract_audio_from_video(video_path):
    """Extract audio track from a video file."""
    try:
        # Create a temporary file for the audio
        temp_audio_path = f"{video_path}_audio.wav"
        
        logger.info(f"Attempting to extract audio from video: {video_path}")
        
        # Method 1: Try with MoviePy first
        try:
            video_clip = VideoFileClip(video_path)
            logger.info(f"Successfully loaded video clip: {video_path}")
            
            # Check if video has audio
            if video_clip.audio is None:
                logger.warning(f"Video does not have an audio track: {video_path}")
                video_clip.close()
                # Don't return yet, try ffmpeg directly
            else:
                logger.info(f"Video has audio track, extracting to: {temp_audio_path}")
                
                # Extract audio to file with explicit parameters
                try:
                    audio_clip = video_clip.audio
                    # Set logger=None to suppress MoviePy's verbose output
                    # Set codec to pcm_s16le for better compatibility
                    audio_clip.write_audiofile(
                        temp_audio_path, 
                        codec='pcm_s16le',
                        ffmpeg_params=["-ac", "1"],  # Force mono channel
                        logger=None
                    )
                    logger.info(f"Successfully extracted audio to: {temp_audio_path}")
                    
                    # Close the clips to release resources
                    audio_clip.close()
                    video_clip.close()
                    
                    # Check if the file was created and has content
                    if os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
                        logger.info(f"Audio file successfully created: {temp_audio_path} ({os.path.getsize(temp_audio_path)} bytes)")
                        return temp_audio_path
                    else:
                        logger.warning(f"Audio file was not created or is empty: {temp_audio_path}")
                        # Fall through to try ffmpeg directly
                except Exception as audio_e:
                    logger.error(f"Error extracting audio with MoviePy: {str(audio_e)}")
                    # Try to close resources even if extraction failed
                    try:
                        if 'audio_clip' in locals() and audio_clip:
                            audio_clip.close()
                        if video_clip:
                            video_clip.close()
                    except:
                        pass
                    # Fall through to try ffmpeg directly
        except Exception as e:
            logger.error(f"Failed to load video clip with MoviePy: {str(e)}")
            # Fall through to try ffmpeg directly
            
        # Method 2: Try with direct ffmpeg command if MoviePy failed
        logger.info("Trying direct ffmpeg command as fallback")
        try:
            import subprocess
            # Create ffmpeg command
            command = [
                'ffmpeg',
                '-i', video_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # PCM 16-bit output
                '-ar', '44100',  # 44.1kHz
                '-ac', '1',  # Mono
                '-y',  # Overwrite if exists
                temp_audio_path
            ]
            
            # Run the command
            logger.info(f"Running ffmpeg command: {' '.join(command)}")
            result = subprocess.run(command, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"Successfully extracted audio using direct ffmpeg command: {temp_audio_path}")
                # Check if the file was created and has content
                if os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
                    logger.info(f"Audio file successfully created: {temp_audio_path} ({os.path.getsize(temp_audio_path)} bytes)")
                    return temp_audio_path
                else:
                    logger.warning(f"Audio file was not created or is empty: {temp_audio_path}")
                    return None
            else:
                logger.error(f"ffmpeg command failed with code {result.returncode}: {result.stderr}")
                return None
                
        except Exception as ffmpeg_e:
            logger.error(f"Error with direct ffmpeg extraction: {str(ffmpeg_e)}")
            return None
            
    except Exception as e:
        logger.error(f"Error extracting audio from video: {str(e)}")
        return None

def process_video_audio(video_path, target_language="en"):
    """Process the audio from a video file and analyze its content."""
    try:
        logger.info(f"Starting video audio processing: {video_path}")
        
        # Extract audio from video
        logger.info(f"Extracting audio from video: {video_path}")
        audio_path = extract_audio_from_video(video_path)
        
        if not audio_path:
            logger.warning(f"Could not extract audio from video: {video_path}")
            return "Could not extract audio from the video. The video may not have an audio track or the format may be unsupported."
        
        logger.info(f"Successfully extracted audio to: {audio_path}")
            
        # Convert to WAV if needed
        try:
            logger.info(f"Converting audio to suitable WAV format: {audio_path}")
            wav_path = convert_audio_to_wav(audio_path)
            logger.info(f"Audio converted to WAV: {wav_path}")
        except Exception as wav_error:
            logger.error(f"Error converting audio to WAV: {str(wav_error)}")
            return f"Error converting audio: {str(wav_error)}"
        
        # Initialize speech recognizer
        recognizer = sr.Recognizer()
        
        # Process the audio file
        try:
            logger.info(f"Processing WAV file with speech recognition: {wav_path}")
            with sr.AudioFile(wav_path) as source:
                # Adjust for ambient noise
                recognizer.adjust_for_ambient_noise(source)
                
                # Record the audio
                audio_data = recognizer.record(source)
                logger.info("Audio data recorded, starting speech recognition")
                
                # Determine language for recognition
                recognition_language = {
                    'en': 'en-US',
                    'sw': 'sw-KE',
                    'ha': 'ha-NG',
                    'yo': 'yo-NG',
                    'ig': 'ig-NG'
                }.get(target_language, 'en-US')
                
                # Recognize speech
                try:
                    logger.info(f"Starting speech recognition with language: {recognition_language}")
                    transcript = recognizer.recognize_google(audio_data, language=recognition_language)
                    logger.info(f"Speech recognition successful. Transcript length: {len(transcript)}")
                    logger.info(f"Transcript preview: {transcript[:100]}...")
                    
                    if not transcript or len(transcript.strip()) == 0:
                        logger.warning("Transcript is empty despite successful recognition")
                        return "The video's audio track doesn't contain any recognizable speech."
                    
                    # Create a prompt for health-related audio analysis
                    logger.info("Creating analysis prompt for Gemini")
                    prompt = f"""You are Afya Siri, a professional sexual and reproductive health educator.
                    This is the transcript of audio from a video: "{transcript}"
                    
                    Based on this transcript, please:
                    1. Identify any sexual or reproductive health topics discussed
                    2. Analyze the accuracy of any health information provided
                    3. Correct any misinformation or myths
                    4. Provide additional educational context where helpful
                    5. Suggest reliable resources for further information if relevant
                    
                    If the transcript doesn't contain any sexual or reproductive health content, briefly note that and suggest how the user might find relevant information instead.
                    
                    Please be professional, educational, and culturally sensitive in your analysis."""
                    
                    # Process the transcript using Gemini
                    logger.info("Sending transcript to Gemini for analysis")
                    analysis = gemini_service.generate_text_response(prompt, target_language)
                    logger.info("Received analysis from Gemini")
                    
                    # Clean up the temporary audio file
                    try:
                        os.remove(audio_path)
                        if wav_path != audio_path:
                            os.remove(wav_path)
                        logger.info("Cleaned up temporary audio files")
                    except Exception as cleanup_error:
                        logger.warning(f"Error cleaning up audio files: {str(cleanup_error)}")
                    
                    return {
                        "transcript": transcript,
                        "analysis": analysis
                    }
                    
                except sr.UnknownValueError:
                    logger.warning("Speech recognition could not understand the audio")
                    return "I couldn't understand what was said in the video. The audio may be unclear or there might not be any speech."
                    
                except sr.RequestError as e:
                    logger.error(f"Speech recognition service error: {str(e)}")
                    return "There was an error with the speech recognition service. Please try again later."
        except Exception as audio_process_error:
            logger.error(f"Error processing audio data: {str(audio_process_error)}")
            return f"Error processing audio data: {str(audio_process_error)}"
                
    except Exception as e:
        logger.error(f"Error processing video audio: {str(e)}")
        return "An error occurred while processing the audio from your video. Please try again."

def process_video_frames(video_path, target_language="en"):
    """Process video frames only and return visual analysis."""
    try:
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
        
        # Initialize Gemini service
        gemini_service = GeminiService()
        
        # Use OpenCV to read frames from the video
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
                
                # Analyze the frame
                frame_analysis = gemini_service.analyze_image(frame_data, frame_prompt)
                analysis_results.append(frame_analysis)
            except Exception as e:
                logger.error(f"Error analyzing frame {idx}: {str(e)}")
                # Continue with next frame
        
        # Release video capture
        cap.release()
        
        # Generate a summary from all frame analyses
        if analysis_results:
            combined_analysis = "\n\n".join(analysis_results)
            final_analysis = gemini_service.summarize_video_analysis(combined_analysis)
            
            return final_analysis
        else:
            return "Could not analyze any frames from the video. Please try a different file."
            
    except Exception as e:
        logger.error(f"Error extracting frames: {str(e)}")
        return f"An error occurred while processing your video: {str(e)}. Please try again."

def process_comprehensive_video(video_path: str, target_language: str = "en", processing_type: str = "auto") -> dict:
    """
    Process a video file comprehensively - analyzing both visual frames and audio content.
    
    Args:
        video_path: Path to the video file
        target_language: Target language for analysis
        processing_type: Type of processing to perform (auto, frames, audio)
        
    Returns:
        Dictionary containing visual analysis, audio transcript and audio analysis
    """
    try:
        logger.info(f"Starting comprehensive video processing: {video_path} with type: {processing_type}")
        
        result = {
            "visual_analysis": None,
            "has_audio": False,
            "audio_transcript": None,
            "audio_analysis": None
        }
        
        # Check if file exists
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return {"error": "Video file could not be found. Please try uploading again."}
        
        # Process based on the requested type
        if processing_type == "frames" or processing_type == "auto":
            # Process video frames
            logger.info(f"Processing video frames: {video_path}")
            visual_analysis = process_video_frames(video_path, target_language)
            result["visual_analysis"] = visual_analysis
            logger.info("Visual frame analysis completed")
        
        # Process audio if requested or in auto mode
        if processing_type == "audio" or processing_type == "auto":
            # Process audio if available
            logger.info(f"Attempting to process video audio: {video_path}")
            audio_result = process_video_audio(video_path, target_language)
            
            # Check if audio processing was successful
            if isinstance(audio_result, dict):
                logger.info("Audio processing successful")
                result["has_audio"] = True
                result["audio_transcript"] = audio_result.get("transcript")
                result["audio_analysis"] = audio_result.get("analysis")
            else:
                # Audio processing returned an error message
                logger.warning(f"Audio processing returned error or no audio found: {audio_result}")
                result["has_audio"] = False
                result["audio_error"] = audio_result
        
        # Generate combined analysis if both analyses are available
        if result["visual_analysis"] and result.get("audio_analysis") and processing_type == "auto":
            logger.info("Generating combined analysis from visual and audio results")
            # Create a prompt for combined analysis
            combined_prompt = f"""You are Afya Siri, a professional sexual and reproductive health educator.

I have analyzed a video with both visual and audio content. Here's what I found:

VISUAL ANALYSIS:
{result["visual_analysis"]}

AUDIO TRANSCRIPT:
{result["audio_transcript"]}

AUDIO ANALYSIS:
{result["audio_analysis"]}

Please provide a comprehensive summary that:
1. Integrates insights from both the visual and audio analyses
2. Identifies the main sexual and reproductive health topics covered
3. Evaluates the accuracy of the health information presented
4. Addresses any discrepancies between visual and audio content
5. Highlights the most important educational aspects
6. Suggests reliable resources for further information

Make your response professional, educational, and culturally sensitive.
"""
            
            combined_analysis = gemini_service.generate_text_response(combined_prompt, target_language)
            result["combined_analysis"] = combined_analysis
            logger.info("Combined analysis generated successfully")
        
        return result
            
    except Exception as e:
        logger.error(f"Error in comprehensive video processing: {str(e)}")
        return {"error": f"An error occurred while processing your video: {str(e)}. Please try again."}

def process_video(video_path: str, target_language: str = "en") -> str:
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
                    
                    # Analyze the frame
                    frame_analysis = gemini_service.analyze_image(frame_data, frame_prompt)
                    analysis_results.append(frame_analysis)
                except Exception as e:
                    logger.error(f"Error analyzing frame {idx}: {str(e)}")
                    # Continue with next frame
            
            # Release video capture
            cap.release()
            
            # Generate a summary from all frame analyses
            if analysis_results:
                combined_analysis = "\n\n".join(analysis_results)
                final_analysis = gemini_service.summarize_video_analysis(combined_analysis)
                
                return final_analysis
            else:
                return "Could not analyze any frames from the video. Please try a different file."
            
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}")
            return f"An error occurred while processing your video: {str(e)}. Please try again."
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return "An error occurred while processing your video. Please try again."

def process_voice(audio_path: str, target_language: str = "en") -> str:
    """
    Process a voice recording and generate a transcription.
    
    Args:
        audio_path: Path to the audio file
        target_language: Target language for transcription
        
    Returns:
        Transcription of the voice recording
    """
    try:
        # Check if file exists
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return "Audio file could not be found. Please try uploading again."
            
        # Convert to WAV if needed
        wav_path = convert_audio_to_wav(audio_path)
        
        # Initialize speech recognizer
        recognizer = sr.Recognizer()
        
        # Process the audio file
        with sr.AudioFile(wav_path) as source:
            # Adjust for ambient noise
            recognizer.adjust_for_ambient_noise(source)
            
            # Record the audio
            audio_data = recognizer.record(source)
            
            # Determine language for recognition
            recognition_language = {
                'en': 'en-US',
                'sw': 'sw-KE',
                'ha': 'ha-NG',
                'yo': 'yo-NG',
                'ig': 'ig-NG'
            }.get(target_language, 'en-US')
            
            # Recognize speech
            text = recognizer.recognize_google(audio_data, language=recognition_language)
            
            # Process the transcript using Gemini
            response = gemini_service.generate_text_response(text, target_language)
            
            return response
        
    except sr.UnknownValueError:
        logger.warning("Speech recognition could not understand the audio")
        return "I couldn't understand what was said in the recording. Please try again with clearer audio."
    except sr.RequestError as e:
        logger.error(f"Speech recognition service error: {str(e)}")
        return "There was an error with the speech recognition service. Please try again later."
    except Exception as e:
        logger.error(f"Error processing voice recording: {str(e)}")
        return "An error occurred while processing your voice recording. Please try again."

def get_health_info(query: str, language: str = 'en') -> str:
    """Get health information based on the query."""
    try:
        response = gemini_service.generate_text_response(
            message=query,
            language=language
        )
        return response
    except Exception as e:
        logger.error(f"Error getting health info: {str(e)}")
        return "I couldn't retrieve health information at the moment. Please try again later." 