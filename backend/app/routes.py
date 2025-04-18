from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
import os
import logging
import time
import uuid
import threading
from .services.gemini_service import GeminiService
from .services.media_service import process_image, process_video, process_voice, process_video_audio, process_comprehensive_video, process_video_frames
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

# In-memory job storage (for a production app, use Redis or a database)
processing_jobs = {}

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

# Function to process video in the background
def process_video_in_background(job_id, video_path, target_language, processing_type):
    try:
        logger.info(f"Starting background processing for job {job_id}")
        processing_jobs[job_id]['status'] = 'processing'
        
        if processing_type == 'audio':
            result = process_video_audio(video_path, target_language)
            if isinstance(result, str):
                processing_jobs[job_id]['status'] = 'failed'
                processing_jobs[job_id]['error'] = result
            else:
                processing_jobs[job_id]['status'] = 'completed'
                processing_jobs[job_id]['result'] = {
                    'transcript': result.get('transcript', ''),
                    'analysis': result.get('analysis', '')
                }
        elif processing_type == 'auto' or processing_type == 'comprehensive':
            result = process_comprehensive_video(video_path, target_language, processing_type)
            if 'error' in result:
                processing_jobs[job_id]['status'] = 'failed'
                processing_jobs[job_id]['error'] = result['error']
            else:
                processing_jobs[job_id]['status'] = 'completed'
                processing_jobs[job_id]['result'] = result
        else:
            # Frames only
            result = process_video_frames(video_path, target_language)
            processing_jobs[job_id]['status'] = 'completed'
            processing_jobs[job_id]['result'] = {'visual_analysis': result}
            
        logger.info(f"Completed background processing for job {job_id}")
    except Exception as e:
        logger.error(f"Error in background processing for job {job_id}: {str(e)}")
        processing_jobs[job_id]['status'] = 'failed'
        processing_jobs[job_id]['error'] = str(e)

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@api.route('/query', methods=['POST'])
def handle_text_query():
    try:
        data = request.get_json()
        
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
        response = gemini_service.generate_text_response(text, target_language, context)
        
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
def handle_image_upload():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        target_language = request.form.get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'image'):
            return jsonify({"error": "Invalid file type. Please upload an image file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = save_uploaded_file(file, filename, 'image')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the image
        description = process_image(file_path, target_language)
        
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
def handle_video_upload():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        target_language = request.form.get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'video'):
            return jsonify({"error": "Invalid file type. Please upload a video file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = save_uploaded_file(file, filename, 'video')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the video (frames only)
        description = process_video_frames(file_path, target_language)
        
        return jsonify({
            "message": "Video processed successfully",
            "visual_analysis": description
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the video. Please try again."
        }), 500

@api.route('/job_status/<job_id>', methods=['GET'])
def check_job_status(job_id):
    """Check the status of an asynchronous job"""
    try:
        if job_id not in processing_jobs:
            return jsonify({
                "status": "not_found",
                "error": "Job not found"
            }), 404
            
        job = processing_jobs[job_id]
        
        if job['status'] == 'completed':
            return jsonify({
                "status": "completed",
                **job['result']
            }), 200
        elif job['status'] == 'failed':
            return jsonify({
                "status": "failed",
                "error": job.get('error', 'Unknown error')
            }), 200
        else:
            return jsonify({
                "status": "processing",
                "progress": job.get('progress', 0)
            }), 200
            
    except Exception as e:
        logger.error(f"Error checking job status: {str(e)}")
        return jsonify({
            "error": "An error occurred while checking job status. Please try again."
        }), 500

@api.route('/upload/video/comprehensive', methods=['POST'])
def handle_comprehensive_video():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        target_language = request.form.get('target_language', 'en')
        processing_type = request.form.get('processing_type', 'auto')
        request_id = request.form.get('request_id', str(uuid.uuid4()))
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'video'):
            return jsonify({"error": "Invalid file type. Please upload a video file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = save_uploaded_file(file, filename, 'video')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Create a job entry
        job_id = request_id
        processing_jobs[job_id] = {
            'status': 'queued',
            'type': 'comprehensive',
            'file_path': file_path,
            'created_at': time.time(),
            'progress': 0
        }
        
        # Start background processing
        thread = threading.Thread(
            target=process_video_in_background,
            args=(job_id, file_path, target_language, processing_type)
        )
        thread.daemon = True
        thread.start()
        
        # Return job information
        return jsonify({
            "message": "Video processing started",
            "status": "processing",
            "job_id": job_id
        }), 202
        
    except Exception as e:
        logger.error(f"Error processing comprehensive video: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the video. Please try again."
        }), 500

@api.route('/upload/video/audio', methods=['POST'])
def handle_video_audio():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        target_language = request.form.get('target_language', 'en')
        request_id = request.form.get('request_id', str(uuid.uuid4()))
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'video'):
            return jsonify({"error": "Invalid file type. Please upload a video file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = save_uploaded_file(file, filename, 'video')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Create a job entry
        job_id = request_id
        processing_jobs[job_id] = {
            'status': 'queued',
            'type': 'audio',
            'file_path': file_path,
            'created_at': time.time(),
            'progress': 0
        }
        
        # Start background processing
        thread = threading.Thread(
            target=process_video_in_background,
            args=(job_id, file_path, target_language, 'audio')
        )
        thread.daemon = True
        thread.start()
        
        # Return job information
        return jsonify({
            "message": "Video audio processing started",
            "status": "processing",
            "job_id": job_id
        }), 202
        
    except Exception as e:
        logger.error(f"Error processing video audio: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the video audio. Please try again."
        }), 500

@api.route('/upload/voice', methods=['POST'])
def handle_voice_upload():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        target_language = request.form.get('target_language', 'en')
        
        if not file or not file.filename:
            return jsonify({"error": "Invalid file"}), 400
            
        if not allowed_file(file.filename, 'audio'):
            return jsonify({"error": "Invalid file type. Please upload an audio file."}), 400
            
        # Save the file
        filename = secure_filename(file.filename)
        file_path = save_uploaded_file(file, filename, 'audio')
        
        if not file_path:
            return jsonify({"error": "Failed to save file"}), 500
            
        # Process the voice recording
        transcription = process_voice(file_path, target_language)
        
        return jsonify({
            "message": "Voice recording processed successfully",
            "transcription": transcription
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing voice recording: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing the voice recording. Please try again."
        }), 500 