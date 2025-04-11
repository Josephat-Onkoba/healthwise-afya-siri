from quart import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import logging
from .services.gemini_service import GeminiService
from .services.media_service import process_image, process_video, process_voice
from .utils import save_uploaded_file, get_file_extension
from .services.knowledge_base import KnowledgeBase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
gemini_service = GeminiService()
knowledge_base = KnowledgeBase()

# Create Blueprint
api = Blueprint('api', __name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif', 'webp'},
    'video': {'mp4', 'webm', 'mov', 'avi'},
    'audio': {'wav', 'mp3', 'ogg', 'm4a', 'webm', 'aac', 'flac'}
}

def allowed_file(filename, file_type):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS.get(file_type, set())

@api.route('/health', methods=['GET'])
async def health_check():
    return jsonify({"status": "healthy"}), 200

@api.route('/query', methods=['POST'])
async def handle_text_query():
    try:
        data = await request.get_json()
        
        if not data or 'text' not in data or 'target_language' not in data:
            return jsonify({
                "error": "Missing required fields: text and target_language"
            }), 400
            
        text = data['text']
        target_language = data['target_language']
        
        logger.info(f"Processing text query in {target_language}: {text[:100]}...")
        
        # Get health information context from knowledge base
        context = knowledge_base.get_relevant_info(text)
        
        # Generate response
        response = await gemini_service.generate_text_response(text, target_language, context)
        
        if not response or response.startswith("I apologize"):
            return jsonify({
                "error": "Failed to generate a response. Please try again."
            }), 500
            
        return jsonify({"response": response}), 200
        
    except Exception as e:
        logger.error(f"Error processing text query: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing your request. Please try again."
        }), 500

@api.route('/upload/image', methods=['POST'])
async def handle_image_upload():
    try:
        if 'file' not in (await request.files):
            return jsonify({"error": "No file provided"}), 400
            
        file = (await request.files)['file']
        target_language = (await request.form).get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'image'):
            return jsonify({"error": "Invalid file type. Please upload an image file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = await save_uploaded_file(file, filename, 'image')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the image
        description = await process_image(file_path, target_language)
        
        return jsonify({
            "message": "Image processed successfully",
            "description": description
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the image. Please try again."
        }), 500

@api.route('/upload/video', methods=['POST'])
async def handle_video_upload():
    try:
        if 'file' not in (await request.files):
            return jsonify({"error": "No file provided"}), 400
            
        file = (await request.files)['file']
        target_language = (await request.form).get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'video'):
            return jsonify({"error": "Invalid file type. Please upload a video file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = await save_uploaded_file(file, filename, 'video')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the video
        description = await process_video(file_path, target_language)
        
        return jsonify({
            "message": "Video processed successfully",
            "description": description
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the video. Please try again."
        }), 500

@api.route('/upload/voice', methods=['POST'])
async def handle_voice_upload():
    try:
        if 'file' not in (await request.files):
            return jsonify({"error": "No file provided"}), 400
            
        file = (await request.files)['file']
        target_language = (await request.form).get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'audio'):
            return jsonify({"error": "Invalid file type. Please upload an audio file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = await save_uploaded_file(file, filename, 'audio')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the voice recording
        transcription = await process_voice(file_path, target_language)
        
        return jsonify({
            "message": "Voice recording processed successfully",
            "transcription": transcription
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing voice recording: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the voice recording. Please try again."
        }), 500 