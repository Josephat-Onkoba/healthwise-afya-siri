@echo off
echo Running HealthFirst backend tests...

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Running test script...
python test_backend.py

pause 