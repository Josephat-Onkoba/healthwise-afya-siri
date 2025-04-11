@echo off
echo Starting HealthFirst backend server...

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Starting server...
python app.py

pause 