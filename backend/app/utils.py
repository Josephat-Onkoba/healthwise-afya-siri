import os
import uuid
import logging
from werkzeug.utils import secure_filename
# import magic  # Removed magic import
from moviepy.editor import VideoFileClip
import cv2
import numpy as np
import pytesseract
from typing import Dict, Set
from pydub import AudioSegment

logger = logging.getLogger(__name__)

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS: Dict[str, Set[str]] = {
    'image': {'.jpg', '.jpeg', '.png', '.gif'},
    'video': {'.mp4', '.webm', '.mov'},
    'audio': {'.wav', '.mp3', '.ogg', '.m4a', '.webm', '.aac', '.flac'}
}

# Set Tesseract command path if specified in environment
tesseract_cmd = os.getenv('TESSERACT_CMD')
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

def validate_file_type(file, allowed_types: Set[str]) -> bool:
    """
    Validate if the file has an allowed extension.
    
    Args:
        file: The file to validate
        allowed_types: Set of allowed file extensions
        
    Returns:
        True if file type is allowed, False otherwise
    """
    if not file or not file.filename:
        return False
        
    # Get file extension
    ext = os.path.splitext(file.filename.lower())[1]
    return ext in allowed_types

async def save_uploaded_file(file, filename: str, file_type: str) -> str:
    """
    Save an uploaded file to a temporary location.
    
    Args:
        file: The file to save
        filename: The filename to use
        file_type: The type of file (image, video, audio)
        
    Returns:
        Path to the saved file
    """
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        await file.save(file_path)
        
        # Set proper permissions
        os.chmod(file_path, 0o644)
        
        return file_path
    except Exception as e:
        logger.error(f"Error saving uploaded file: {str(e)}")
        raise

def extract_frames_from_video(video_path, frame_interval=1):
    """Extract frames from video at specified intervals."""
    frames = []
    frame_paths = []
    
    # Create frames directory if it doesn't exist
    frames_dir = os.path.join(UPLOAD_FOLDER, 'frames')
    if not os.path.exists(frames_dir):
        os.makedirs(frames_dir)
    
    # Open video file
    video = cv2.VideoCapture(video_path)
    fps = video.get(cv2.CAP_PROP_FPS)
    frame_count = 0
    
    while True:
        success, frame = video.read()
        if not success:
            break
        
        # Save frame at specified intervals
        if frame_count % int(fps * frame_interval) == 0:
            frame_path = os.path.join(frames_dir, f"frame_{frame_count}.jpg")
            cv2.imwrite(frame_path, frame)
            frame_paths.append(frame_path)
        
        frame_count += 1
    
    video.release()
    return frame_paths

async def convert_audio_to_wav(audio_path):
    """Convert audio file to WAV format for speech recognition."""
    try:
        # Get file extension
        ext = os.path.splitext(audio_path)[1].lower()
        
        # If already WAV, return the path
        if ext == '.wav':
            return audio_path
            
        # Create a temporary WAV file
        wav_path = os.path.splitext(audio_path)[0] + '.wav'
        
        # Convert to WAV using pydub
        try:
            audio = AudioSegment.from_file(audio_path)
            audio.export(wav_path, format='wav')
            return wav_path
        except Exception as e:
            logger.error(f"Error converting audio to WAV: {str(e)}")
            # If conversion fails, try to use the original file
            return audio_path
            
    except Exception as e:
        logger.error(f"Error in convert_audio_to_wav: {str(e)}")
        # If all else fails, return the original path
        return audio_path

def cleanup_files(file_paths):
    """Clean up temporary files."""
    for path in file_paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            print(f"Error cleaning up file {path}: {str(e)}")

def get_file_extension(filename):
    """Get file extension from filename."""
    return os.path.splitext(filename)[1].lower()

def is_allowed_file(filename, file_type):
    """Check if file extension is allowed."""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS.get(file_type, set()) 