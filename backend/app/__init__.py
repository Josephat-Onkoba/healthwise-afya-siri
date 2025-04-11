from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # Load environment variables
    load_dotenv()
    
    # Configure app
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')
    app.config['GOOGLE_API_KEY'] = os.getenv('GOOGLE_API_KEY')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Register blueprints
    from .routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    return app 