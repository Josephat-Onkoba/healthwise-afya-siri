from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging
from app.routes import api
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configure upload folder
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', 16777216))  # 16MB default
app.config['TIMEOUT'] = 300  # 5 minute timeout for requests

# Apply middleware
app.wsgi_app = ProxyFix(app.wsgi_app)

# Ensure upload directory exists with proper permissions
upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), app.config['UPLOAD_FOLDER'])
os.makedirs(upload_dir, exist_ok=True)
# Set permissions to allow writing
os.chmod(upload_dir, 0o755)

# Register API routes
app.register_blueprint(api, url_prefix='/api')

# Basic health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "HealthFirst API is running",
        "version": "1.0.0"
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

# Add a timeout route for testing
@app.route('/api/test-timeout')
def test_timeout():
    import time
    time.sleep(10)  # Simulate a long request
    return jsonify({"message": "This is a delayed response"})

# Add more API endpoints here as needed

if __name__ == '__main__':
    # Get port from environment variable or use default
    port = int(os.getenv('PORT', 5000))
    
    # Run the app
    app.run(host='0.0.0.0', port=port, debug=True, threaded=True) 