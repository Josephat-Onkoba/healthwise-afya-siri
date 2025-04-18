import os
import google.generativeai as genai
from dotenv import load_dotenv
import base64
from PIL import Image
import io
import tempfile
import moviepy.editor as mp
import numpy as np
from typing import Dict, List, Optional, Union, Any
import cv2
from moviepy.editor import VideoFileClip
import pytesseract
import logging

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

genai.configure(api_key=GEMINI_API_KEY)

logger = logging.getLogger(__name__)

class GeminiService:
    """Service for interacting with Google's Gemini API."""
    
    def __init__(self):
        """Initialize the Gemini service."""
        try:
            # Initialize models with proper configuration
            self.text_model = genai.GenerativeModel('gemini-2.0-flash')
            self.vision_model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Configure safety settings
            self.safety_settings = {
                "HARASSMENT": "block_none",
                "HATE_SPEECH": "block_none",
                "SEXUALLY_EXPLICIT": "block_none",
                "DANGEROUS_CONTENT": "block_none",
            }
            
            # Configure generation settings
            self.generation_config = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 2048,
            }
        except Exception as e:
            print(f"Error initializing Gemini models: {str(e)}")
            raise
    
    def generate_text_response(
        self,
        message: str,
        language: str = "en",
        context: Optional[str] = None
    ) -> str:
        """Generate a text response using the Gemini model."""
        try:
            if not message:
                raise ValueError("Message cannot be empty")

            # Check if the message is a greeting
            greeting_keywords = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "what's up", "how are you", "Habari", "Sasa"]
            is_greeting = any(keyword in message.lower() for keyword in greeting_keywords)
            is_what_you_do = "what do you do" in message.lower() or "what can you do" in message.lower()

            # Construct a prompt that emphasizes African context and cultural sensitivity
            prompt = f"""You are Afya Siri, a professional sexual and reproductive health educator with expertise in African healthcare systems and cultural contexts. Your role is to provide accurate, culturally-sensitive information about sexual and reproductive health.
            Please note: Your role is strictly to provide sexual and reproductive health information. If the user query does not pertain to sexual or reproductive health (for example, general terms like "kuku" or "mayai" which refer to chicken and eggs), politely respond that the query is outside your scope.

User Query: {message}

{f'Context: {context}' if context else ''}

IMPORTANT INSTRUCTIONS FOR RESPONDING:

{
    '- This is a greeting. Respond with a warm, friendly greeting and a VERY BRIEF introduction (1-2 sentences only) about your role as Afya Siri, a sexual and reproductive health educator specializing in African contexts.'
    if is_greeting and not is_what_you_do else
    '- This is a question about your capabilities. Provide a detailed explanation of your role as a sexual and reproductive health educator, including the types of information you can provide, your knowledge of African healthcare systems, and how you can help with questions about reproductive health, contraception, STIs, and other related topics.'
    if is_what_you_do else
    '''- Provide a professional, educational response that is culturally sensitive
- Address common myths and misconceptions
- Provide health literacy tips relevant to the query
- Maintain a professional tone
- Keep the response focused and relevant to the query
- Only answer questions that are **clearly related to sexual health information, sexual health education and reproductive health**. These include topics such as: 
   - STIs, HIV, contraception, puberty, menstruation, pregnancy, fertility, sexual orientation, consent, relationships, and reproductive rights.
- Respect cultural norms and youth-friendly language in your responses. Avoid slang unless asked for definitions.
- If a query is in different language other than english, prompt the user to clarify what they mean before generating a response.
- Never make up medical facts. Only provide accurate, factual information. If unsure, say:"I'm not sure about that. I recommend checking with a health provider or trusted source
- Conclude with a brief reminder about consulting healthcare providers if appropriate
- If the query does not relate to sexual and reproductive health, please ask the user to rephrase their question.'''
}

FORMATTING INSTRUCTIONS:
1. Use proper Markdown formatting in your response.
2. For bold text, use two asterisks on each side with NO spaces between the asterisks and text. Example: **bold text** not ** bold text **.
3. For bullet points, use a dash. Example: "- item".
4. For numbered lists, use numbers followed by a period and space. Example: "1. First item".
5. Use short, clear sentences, Keep paragraphs short and focused.
6. Where needed, use examples and Swahili translations
7. Use bold text for important terms, key concepts, and section headings.
8. If user has texted in language other than english, try to understand the word by transalating it to english and understand the context of it before giving a response. If it is unrelated to sexual health information and education let the user know.
9. Avoid complex jargon. Make responses easy to understand.

Your response should:
1. Be conversational and interactive
2. Directly address the user's query
3. Use culturally appropriate examples and references
4. Present information in a clear, educational manner
5. Make important terms and concepts bold using the format **important term**

Please provide the response in {language} language, using appropriate local terminology and expressions.

Response:"""

            # Configure safety settings to allow health education while maintaining standards
            safety_settings = [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE"
                }
            ]

            # Generate response
            response = self.text_model.generate_content(
                prompt,
                safety_settings=safety_settings,
                generation_config=self.generation_config
            )
            
            # Check if response was blocked
            if response.prompt_feedback.block_reason:
                logger.warning(f"Response blocked: {response.prompt_feedback.block_reason}")
                return "I apologize, but I cannot provide a response to this query due to content safety concerns. Please try rephrasing your question in a more general way."
            
            # Extract text from response
            response_text = ""
            if hasattr(response, 'text') and response.text:
                response_text = response.text
            elif hasattr(response, 'parts') and response.parts:
                response_text = response.parts[0].text
            else:
                return "I apologize, but I couldn't generate a proper response. Please try again."
                
            # Log the response for debugging
            print(f"Generated response: {response_text[:100]}...")
            
            return response_text
                
        except Exception as e:
            logger.error(f"Error generating text response: {str(e)}")
            return f"I apologize, but I encountered an error: {str(e)}. Please try again."
    
    def analyze_image(self, image_data: bytes, prompt: str = None) -> str:
        """Analyze an image using Gemini Vision."""
        try:
            # Convert image data to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Default prompt if none provided
            if not prompt:
                prompt = """You are Afya Siri, a professional sexual and reproductive health educator. 
                Analyze this image from a medical and educational perspective, focusing on:
                1. Any health-related aspects or concerns
                2. Anatomical or physiological information if relevant
                3. Signs or symptoms that might indicate health issues
                4. Educational value for understanding sexual and reproductive health
                
                Provide a professional, clinical analysis that:
                - Uses appropriate medical terminology
                - Maintains a respectful, educational tone
                - Focuses on health information rather than aesthetic descriptions
                - Avoids explicit content while still addressing health concerns
                - Directs to healthcare providers when appropriate
                
                If the image contains text, extract and interpret it from a health perspective."""
            
            # Use explicit safety settings in correct format
            safety_settings = [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE"
                }
            ]
            
            # Generate content with vision model
            response = self.vision_model.generate_content(
                [prompt, image],
                safety_settings=safety_settings,
                generation_config=self.generation_config
            )
            
            # Extract and return the response text
            if hasattr(response, 'text') and response.text:
                return response.text
            elif hasattr(response, 'parts') and response.parts:
                return response.parts[0].text
            else:
                return "I couldn't analyze the image properly. Please try another image."
                
        except Exception as e:
            logger.error(f"Error analyzing image: {str(e)}")
            return f"I encountered an error analyzing this image: {str(e)}"
    
    def summarize_video_analysis(self, analyses: str) -> str:
        """Summarize multiple frame analyses into a coherent description."""
        try:
            summary_prompt = f"""I've analyzed several frames from a video. Here are my observations:

{analyses}

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

            # Generate response
            response = self.text_model.generate_content(
                summary_prompt,
                safety_settings=[
                    {
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_NONE"
                    },
                    {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_NONE"
                    }
                ],
                generation_config=self.generation_config
            )
            
            # Extract text from response
            if hasattr(response, 'text') and response.text:
                return f"Video Analysis Summary:\n\n{response.text}"
            elif hasattr(response, 'parts') and response.parts:
                return f"Video Analysis Summary:\n\n{response.parts[0].text}"
            else:
                return "Could not generate a summary for this video."
                
        except Exception as e:
            logger.error(f"Error summarizing video analysis: {str(e)}")
            return f"Video Analysis Results (Summary unavailable):\n\n{analyses}"

    @staticmethod
    def analyze_video(video_path: str, query: str, max_frames: int = 5) -> str:
        """Analyze a video file and generate a description based on key frames."""
        try:
            # This is a wrapper to make the old static method async-compatible
            gemini_service = GeminiService()
            return gemini_service.analyze_video(video_path, query, max_frames)
        except Exception as e:
            print(f"Error in analyze_video: {str(e)}")
            return f"Error analyzing video: {str(e)}"
    
    @staticmethod
    def extract_text_from_image(image_data: Union[str, bytes]) -> str:
        """
        Extract text from an image using Gemini Pro Vision.
        
        Args:
            image_data: Base64 encoded image or image bytes
            
        Returns:
            Extracted text from the image
        """
        try:
            # Convert base64 to image if needed
            if isinstance(image_data, str):
                image_bytes = base64.b64decode(image_data)
            else:
                image_bytes = image_data
                
            # Open image
            image = Image.open(io.BytesIO(image_bytes))
            
            # Generate response
            response = vision_model.generate_content([
                "Please extract and return all the text visible in this image. " +
                "Return only the text, without any additional commentary or explanation."
            ], image)
            return response.text
        except Exception as e:
            print(f"Error extracting text from image: {str(e)}")
            return "I apologize, but I encountered an error while extracting text from your image. Please try again later." 