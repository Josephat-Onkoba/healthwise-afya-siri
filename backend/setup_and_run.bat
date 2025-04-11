@echo off
echo Setting up HealthFirst backend...

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing required packages...
pip install flask flask-cors python-dotenv google-generativeai
pip install chromadb pytesseract moviepy deep-translator
pip install Pillow numpy pandas sentence-transformers scikit-learn

echo Starting server...
python app.py

pause 