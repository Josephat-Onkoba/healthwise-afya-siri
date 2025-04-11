@echo off
echo Initializing HealthFirst knowledge base...

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Running initialization script...
python init_knowledge_base.py

pause 