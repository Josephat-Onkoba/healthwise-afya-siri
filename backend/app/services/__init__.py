from .gemini_service import GeminiService
from .knowledge_base import KnowledgeBase
import os
from .media_service import (
    process_text_query,
    process_image,
    process_video,
    process_voice,
    translate_text,
    get_health_info
)

# Initialize services
gemini_service = GeminiService()
knowledge_base = KnowledgeBase()

def process_text_query(text: str, target_language: str) -> str:
    """
    Process a text query using the Gemini service and knowledge base.
    
    Args:
        text: The user's query
        target_language: The language to respond in
        
    Returns:
        The generated response
    """
    try:
        # Get relevant information from knowledge base
        context = knowledge_base.get_relevant_info(text, target_language)
        
        # Generate response using Gemini
        response = gemini_service.generate_text_response(
            message=text,
            language=target_language,
            context=context
        )
        
        return response
    except Exception as e:
        print(f"Error in process_text_query: {str(e)}")
        return "I apologize, but I encountered an error processing your query. Please try again."

def process_image(image_path: str, target_language: str) -> str:
    """
    Process an image using the Gemini service.
    
    Args:
        image_path: Path to the image file
        target_language: The language to respond in
        
    Returns:
        The generated response
    """
    try:
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Extract text from image
        extracted_text = gemini_service.extract_text_from_image(image_data)
        
        # Generate response
        response = gemini_service.generate_text_response(
            message=f"Please analyze this image and the extracted text: {extracted_text}",
            language=target_language
        )
        
        return response
    except Exception as e:
        print(f"Error in process_image: {str(e)}")
        return "I apologize, but I encountered an error processing your image. Please try again."

def process_video(video_path: str, target_language: str) -> str:
    """
    Process a video using the Gemini service.
    
    Args:
        video_path: Path to the video file
        target_language: The language to respond in
        
    Returns:
        The generated response
    """
    try:
        response = gemini_service.analyze_video(video_path, "Please analyze this video", target_language)
        return response
    except Exception as e:
        print(f"Error in process_video: {str(e)}")
        return "I apologize, but I encountered an error processing your video. Please try again."

def translate_text(text: str, target_language: str) -> str:
    """
    Translate text to the target language.
    
    Args:
        text: Text to translate
        target_language: Target language code
        
    Returns:
        Translated text
    """
    try:
        response = gemini_service.generate_text_response(
            message=f"Please translate the following text to {target_language}: {text}",
            language=target_language
        )
        return response
    except Exception as e:
        print(f"Error in translate_text: {str(e)}")
        return "I apologize, but I encountered an error translating your text. Please try again."

def get_health_info(topic: str, language: str = "en") -> str:
    """
    Get health information about a specific topic.
    
    Args:
        topic: The health topic to get information about
        language: The language to respond in
        
    Returns:
        Health information
    """
    try:
        info = knowledge_base.get_topic_info(topic, language)
        if not info:
            return f"I apologize, but I don't have specific information about {topic}. Please try a different topic or consult a healthcare professional."
        return info
    except Exception as e:
        print(f"Error in get_health_info: {str(e)}")
        return "I apologize, but I encountered an error retrieving health information. Please try again."

__all__ = [
    'process_text_query',
    'process_image',
    'process_video',
    'process_voice',
    'translate_text',
    'get_health_info',
    'KnowledgeBase'
] 